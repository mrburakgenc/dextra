// Yetki kapısı - okuma: satır süzgeci ve yetenek başına kolon indirimi (GV-033; TS-002 AK-19; KR-010
// Seçim 26, 37, 40 ve "Derleme eşlemesi"; KR-008 Seçim 4, 44, 45). Koşturma:
//   pnpm -C backend test:e2e test/yetki-kapisi-okuma.e2e-spec.ts --reporter=verbose
// Göçleri uygulanmış geçici veritabanında koşar. Katalog birimli bir kaynağı (Uyelik; birim kolonu
// grupId) ve birimsiz bir kaynağı (Kullanici) bildirir. Satırlar ayrı bir bağlantıdan (gözlemci) SQL ile
// yazılır. Kişinin derlenmiş yetkisi yetki belleğinden, testin verdiği yetki verisiyle alınır ve istek
// bağlamı istek bağlamı ara katmanıyla testte kurulur. Kapının gönderdiği sorgular Prisma'nın sorgu
// olaylarından sayılır.
import { execFile } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import {
  istekBaglamiAraKatmani,
  istekYetkisiniYaz,
} from '../src/shared/http/istek-baglami.js';
import { KodluHata } from '../src/shared/http/kodlu-hata.js';
import type {
  KisininSatirlari,
  SartOgesi,
  UyelikSatiri,
  YetenekSatiri,
} from '../src/shared/kimlik/yetki-verisi.contract.js';
import { prismaKaynakKatalogu } from '../src/shared/yetki/kaynak-katalogu.js';
import {
  type Kayit,
  OkumaKapisi,
  okumaBirikimi,
} from '../src/shared/yetki/okuma-kapisi.js';
import type { DerlemeSonucu } from '../src/shared/yetki/yetenek-derleyici.js';
import { YetkiBellegi } from '../src/shared/yetki/yetki-bellegi.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const KATALOG = prismaKaynakKatalogu(['Uyelik', 'Kullanici']);

// Kimlikler sıralıdır: kimliğe göre sıra adların sırasıyla aynıdır.
const AYSE = '70000000-0000-4000-8000-000000000001';
const BANU = '70000000-0000-4000-8000-000000000002';
const CEM = '70000000-0000-4000-8000-000000000003';
const DENIZ = '70000000-0000-4000-8000-000000000004';
const ECE = '70000000-0000-4000-8000-000000000005';
const KISILER = [
  [AYSE, 'ayse', 'Ayşe'],
  [BANU, 'banu', 'Banu'],
  [CEM, 'cem', 'Cem'],
  [DENIZ, 'deniz', 'Deniz'],
  [ECE, 'ece', 'Ece'],
] as const;

// Ağaç: KOK → A → A1; KOK → B (A'nın kardeşi).
const G_KOK = '71000000-0000-4000-8000-000000000000';
const G_A = '71000000-0000-4000-8000-00000000000a';
const G_A1 = '71000000-0000-4000-8000-0000000000a1';
const G_B = '71000000-0000-4000-8000-00000000000b';

const R1 = '72000000-0000-4000-8000-000000000001';
const R2 = '72000000-0000-4000-8000-000000000002';

// Kaynak olarak okunan üyelik satırları; isteyenlerin yetki üyelikleri de bunlardır.
const UY_A = '73000000-0000-4000-8000-000000000001';
const UY_A1 = '73000000-0000-4000-8000-000000000002';
const UY_B = '73000000-0000-4000-8000-000000000003';
const UY_KOK = '73000000-0000-4000-8000-000000000004';
const UY_A_R2 = '73000000-0000-4000-8000-000000000005';
// Yalnız canlılık testinde bulunan silinmiş üyelik.
const UY_SILINMIS = '73000000-0000-4000-8000-000000000006';

const Y1 = '74000000-0000-4000-8000-000000000001';
const Y2 = '74000000-0000-4000-8000-000000000002';

const AYSE_A: UyelikSatiri = { uyelikId: UY_A, grupId: G_A, rolId: R1 };
const ECE_A_R2: UyelikSatiri = { uyelikId: UY_A_R2, grupId: G_A, rolId: R2 };
const CEM_B: UyelikSatiri = { uyelikId: UY_B, grupId: G_B, rolId: R1 };
const ALT_GRUPLAR = { [G_A]: [G_A, G_A1], [G_B]: [G_B] };

let db: TestDatabase;
let gozlemci: pg.Client;
let gozlemciPid: number;
let prisma: PrismaClient<'query'>;
const sorgular: string[] = [];
const kapi = new OkumaKapisi(KATALOG);

function yetenek(degisen: Partial<YetenekSatiri>): YetenekSatiri {
  return {
    yetenekId: Y1,
    grupId: G_A,
    rolId: R1,
    kaynak: 'Kullanici',
    eylem: 'oku',
    sart: [],
    butunKayitlar: false,
    butunBirimler: false,
    kolonlar: [],
    butunKolonlar: false,
    ...degisen,
  };
}

// Kişinin derlenmiş yetkisi, yetki guard'ının kullandığı yetki belleğinden.
function yetkiAl(
  kisi: string,
  uyelikler: readonly UyelikSatiri[],
  yetenekler: readonly YetenekSatiri[],
): Promise<DerlemeSonucu> {
  const surumler = { kisiSurumu: 0, genelSurum: 0 };
  const satirlar: KisininSatirlari = {
    ...surumler,
    uyelikler,
    yetenekler,
    altGruplar: ALT_GRUPLAR,
  };
  const bellek = new YetkiBellegi(
    {
      surumler: () => Promise.resolve(surumler),
      kisininSatirlari: () => Promise.resolve(satirlar),
    },
    KATALOG,
  );
  return bellek.al(kisi, surumler);
}

// İşi, yetkisi yazılmış bir istek bağlamının içinde koşturur.
function istekte<T>(yetki: DerlemeSonucu, is: () => Promise<T>): Promise<T> {
  return new Promise<T>((coz, reddet) => {
    // Ara katman istekten bir şey okumaz, cevaba yalnız başlık yazar.
    const cevap = { setHeader: () => undefined };
    istekBaglamiAraKatmani(
      {} as unknown as IncomingMessage,
      cevap as unknown as ServerResponse,
      () => {
        istekYetkisiniYaz(yetki);
        is().then(coz, reddet);
      },
    );
  });
}

const adlar = (kayitlar: readonly Kayit[]): unknown[] =>
  kayitlar.map((k) => k['gorunenAd']);

const kimlikler = (kayitlar: readonly Kayit[]): unknown[] =>
  kayitlar.map((k) => k['id']);

function lintStdin(
  dosya: string,
  kod: string,
): Promise<{ cikis: number; cikti: string }> {
  return new Promise((coz) => {
    const surec = execFile(
      `${BACKEND}node_modules/.bin/eslint`,
      ['--stdin', '--stdin-filename', dosya],
      { cwd: BACKEND },
      (hata, cikti) => {
        coz({
          cikis: hata === null ? 0 : Number(hata.code),
          cikti,
        });
      },
    );
    surec.stdin?.end(kod);
  });
}

beforeAll(async () => {
  db = await createTestDatabase([], { migrations: true });
  gozlemci = new pg.Client({ connectionString: db.url });
  await gozlemci.connect();
  gozlemciPid = (
    await gozlemci.query<{ pid: number }>('select pg_backend_pid() as pid')
  ).rows[0]?.pid ?? -1;
  for (const [id, kullaniciAdi, ad] of KISILER) {
    await gozlemci.query(
      'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $3)',
      [id, kullaniciAdi, ad],
    );
  }
  for (const [id, ust] of [
    [G_KOK, null],
    [G_A, G_KOK],
    [G_A1, G_A],
    [G_B, G_KOK],
  ] as const) {
    await gozlemci.query(
      'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
      [id, ust, `Grup ${id}`],
    );
  }
  await gozlemci.query(
    "insert into rol (id, ad) values ($1, 'Rol 1'), ($2, 'Rol 2')",
    [R1, R2],
  );
  for (const [id, kisi, grup, rol] of [
    [UY_A, AYSE, G_A, R1],
    [UY_A1, BANU, G_A1, R1],
    [UY_B, CEM, G_B, R1],
    [UY_KOK, DENIZ, G_KOK, R1],
    [UY_A_R2, ECE, G_A, R2],
  ] as const) {
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [id, kisi, grup, rol],
    );
  }
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
    log: [{ emit: 'event', level: 'query' }],
  });
  prisma.$on('query', (olay) => {
    sorgular.push(olay.query);
  });
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
  try {
    expect(await kalanBaglantiSayisi(gozlemci, db.name, [gozlemciPid])).toBe(
      0,
    );
  } finally {
    await gozlemci.end();
    await db.drop();
  }
});

beforeEach(() => {
  sorgular.length = 0;
});

describe('yetki kapısı - okuma', () => {
  it('a) bütün kayıtlar ve bütün kolonlar yeteneği bütün satırları ve kolonları tek sorguyla döndürür', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({ butunKayitlar: true, butunKolonlar: true }),
    ]);

    const kayitlar = await istekte(yetki, () =>
      kapi.liste(prisma, 'Kullanici'),
    );

    expect(kimlikler(kayitlar)).toEqual([AYSE, BANU, CEM, DENIZ, ECE]);
    for (const kayit of kayitlar) {
      expect(Object.keys(kayit).sort()).toEqual(
        [...(KATALOG.alanlar('Kullanici') ?? [])].sort(),
      );
    }
    expect(kayitlar[0]).toMatchObject({
      id: AYSE,
      kullaniciAdi: 'ayse',
      gorunenAd: 'Ayşe',
      sistemAktoru: false,
    });
    expect(sorgular).toHaveLength(1);
  });

  it('b) şartlı yetenekle yalnız şarta uyan satırlar döner; isteyen yer tutucusu isteğin kişisine çözülür', async () => {
    const listeli = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({
        sart: [{ alan: 'gorunenAd', islec: 'listede', deger: ['Ayşe', 'Cem'] }],
        butunKolonlar: true,
      }),
    ]);
    expect(
      adlar(await istekte(listeli, () => kapi.liste(prisma, 'Kullanici'))),
    ).toEqual(['Ayşe', 'Cem']);

    const kendisi = await yetkiAl(BANU, [AYSE_A], [
      yetenek({
        sart: [{ alan: 'id', islec: 'esit', deger: { yerTutucu: 'isteyen' } }],
        butunKolonlar: true,
      }),
    ]);
    expect(
      adlar(await istekte(kendisi, () => kapi.liste(prisma, 'Kullanici'))),
    ).toEqual(['Banu']);
  });

  describe('c) birim', () => {
    const grupVeAlti = {
      alan: 'grupId',
      islec: 'listede',
      deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
    } as const;

    it('yeteneğin grubu ve altı: kendi birimi ve alt birimleri görülür, kardeş birim görülmez; aynı çağrı başka birimdeki kişide kendi birimini verir', async () => {
      const aBirimi = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ kaynak: 'Uyelik', sart: [grupVeAlti], butunKolonlar: true }),
      ]);
      const bBirimi = await yetkiAl(CEM, [CEM_B], [
        yetenek({
          yetenekId: Y2,
          grupId: G_B,
          kaynak: 'Uyelik',
          sart: [grupVeAlti],
          butunKolonlar: true,
        }),
      ]);
      const cagri = (): Promise<Kayit[]> => kapi.liste(prisma, 'Uyelik');

      expect(kimlikler(await istekte(aBirimi, cagri))).toEqual([
        UY_A,
        UY_A1,
        UY_A_R2,
      ]);
      expect(kimlikler(await istekte(bBirimi, cagri))).toEqual([UY_B]);
    });

    it('yeteneğin grubu: alt birim görülmez', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({
          kaynak: 'Uyelik',
          sart: [
            {
              alan: 'grupId',
              islec: 'esit',
              deger: { yerTutucu: 'yetenek_grubu' },
            },
          ],
          butunKolonlar: true,
        }),
      ]);

      expect(
        kimlikler(await istekte(yetki, () => kapi.liste(prisma, 'Uyelik'))),
      ).toEqual([UY_A, UY_A_R2]);
    });

    it('bütün birimler işaretli yetenekte birim koşulu yoktur: şart bütün birimlerde uygulanır', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({
          kaynak: 'Uyelik',
          sart: [{ alan: 'rolId', islec: 'esit', deger: R1 }],
          butunBirimler: true,
          butunKolonlar: true,
        }),
      ]);

      expect(
        kimlikler(await istekte(yetki, () => kapi.liste(prisma, 'Uyelik'))),
      ).toEqual([UY_A, UY_A1, UY_B, UY_KOK]);
    });
  });

  it('d) kolon sınırı: yalnız izinli kolonlar ve her zaman görünen kimlik döner, öbürleri cevapta hiç yoktur', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({ butunKayitlar: true, kolonlar: ['gorunenAd'] }),
    ]);

    await istekte(yetki, async () => {
      expect(await kapi.liste(prisma, 'Kullanici')).toEqual([
        { id: AYSE, gorunenAd: 'Ayşe' },
        { id: BANU, gorunenAd: 'Banu' },
        { id: CEM, gorunenAd: 'Cem' },
        { id: DENIZ, gorunenAd: 'Deniz' },
        { id: ECE, gorunenAd: 'Ece' },
      ]);
      // Kimliğe göre süzme ve sıralama serbesttir (TS-002 AK-38).
      expect(
        kimlikler(
          await kapi.liste(prisma, 'Kullanici', {
            kosul: [{ alan: 'id', islec: 'listede', deger: [BANU, DENIZ] }],
            siralama: [{ alan: 'id', yon: 'azalan' }],
          }),
        ),
      ).toEqual([DENIZ, BANU]);
      expect(await kapi.tek(prisma, 'Kullanici', CEM)).toEqual({
        id: CEM,
        gorunenAd: 'Cem',
      });
      // Görünmeyen kolona göre süzme ve sıralama yeteneği okumadan düşürür.
      expect(
        await kapi.liste(prisma, 'Kullanici', {
          kosul: [{ alan: 'kullaniciAdi', islec: 'esit', deger: 'cem' }],
        }),
      ).toEqual([]);
      expect(
        await kapi.liste(prisma, 'Kullanici', {
          siralama: [{ alan: 'kullaniciAdi', yon: 'artan' }],
        }),
      ).toEqual([]);
    });
  });

  describe('e) iki yetenek', () => {
    // Y1 Ayşe ve Banu'nun adını, Y2 Banu ve Cem'in kullanıcı adını görür.
    const ikiYetenek = (): Promise<DerlemeSonucu> =>
      yetkiAl(AYSE, [AYSE_A, ECE_A_R2], [
        yetenek({
          sart: [
            { alan: 'gorunenAd', islec: 'listede', deger: ['Ayşe', 'Banu'] },
          ],
          kolonlar: ['gorunenAd'],
        }),
        yetenek({
          yetenekId: Y2,
          rolId: R2,
          sart: [
            { alan: 'gorunenAd', islec: 'listede', deger: ['Banu', 'Cem'] },
          ],
          kolonlar: ['kullaniciAdi'],
        }),
      ]);

    it('aynı kayıt bir kez ve kolonların birleşimiyle, ayrı kayıtlar kendi yeteneğinin kolonlarıyla döner', async () => {
      const kayitlar = await istekte(await ikiYetenek(), () =>
        kapi.liste(prisma, 'Kullanici'),
      );

      expect(kayitlar).toEqual([
        { id: AYSE, gorunenAd: 'Ayşe' },
        { id: BANU, gorunenAd: 'Banu', kullaniciAdi: 'banu' },
        { id: CEM, kullaniciAdi: 'cem' },
      ]);
      // Sayfa sorgusu ve yetenek başına birer kolon sorgusu.
      expect(sorgular).toHaveLength(3);
    });

    it('tek kayıt bütün okuma yeteneklerinin kolonlarının birleşimiyle döner; kimlikle süzen listeyle aynı cevabı verir', async () => {
      await istekte(await ikiYetenek(), async () => {
        expect(await kapi.tek(prisma, 'Kullanici', BANU)).toEqual({
          id: BANU,
          gorunenAd: 'Banu',
          kullaniciAdi: 'banu',
        });
        expect(
          await kapi.liste(prisma, 'Kullanici', {
            kosul: [{ alan: 'id', islec: 'esit', deger: BANU }],
          }),
        ).toEqual([{ id: BANU, gorunenAd: 'Banu', kullaniciAdi: 'banu' }]);
        expect(await kapi.tek(prisma, 'Kullanici', CEM)).toEqual({
          id: CEM,
          kullaniciAdi: 'cem',
        });
        await expect(
          kapi.tek(prisma, 'Kullanici', DENIZ),
        ).rejects.toMatchObject({ kod: 'bulunamadi' });
      });
    });

    it('çağıranın sıraladığı ya da süzdüğü kolonu göremeyen yetenek okumaya katılmaz', async () => {
      await istekte(await ikiYetenek(), async () => {
        expect(
          await kapi.liste(prisma, 'Kullanici', {
            siralama: [{ alan: 'gorunenAd', yon: 'azalan' }],
          }),
        ).toEqual([
          { id: BANU, gorunenAd: 'Banu' },
          { id: AYSE, gorunenAd: 'Ayşe' },
        ]);
        expect(
          await kapi.liste(prisma, 'Kullanici', {
            kosul: [{ alan: 'kullaniciAdi', islec: 'esit', deger: 'banu' }],
          }),
        ).toEqual([{ id: BANU, kullaniciAdi: 'banu' }]);
      });
    });
  });

  it('f) hiç kuralı olmayan kişi boş liste alır ve veritabanı hiçbir satır döndürmez', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], []);

    const kayitlar = await istekte(yetki, () =>
      kapi.liste(prisma, 'Kullanici'),
    );

    expect(kayitlar).toEqual([]);
    // Sorgu gider ve koşulu hiçbir satıra uymaz.
    expect(sorgular).toHaveLength(1);
    expect(sorgular[0]).toContain('WHERE 1=0');
    // Kapının boş "veya" kullanmamasının nedeni (Prisma 7.10.1): en üstteki boş "veya" hiçbir satır
    // döndürmez, ama "ve"nin içindeki boş "veya" koşulsuz sayılır ve bütün satırları döndürür.
    expect(await prisma.kullanici.findMany({ where: { OR: [] } })).toEqual([]);
    expect(
      await prisma.kullanici.count({ where: { AND: [{ OR: [] }] } }),
    ).toBe(KISILER.length);
    await expect(
      istekte(yetki, () => kapi.tek(prisma, 'Kullanici', AYSE)),
    ).rejects.toMatchObject({ kod: 'bulunamadi' });
  });

  it('g) çağıranın koşulu yetkiyi genişletemez', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({
        sart: [{ alan: 'id', islec: 'esit', deger: { yerTutucu: 'isteyen' } }],
        butunKolonlar: true,
      }),
    ]);

    await istekte(yetki, async () => {
      expect(
        await kapi.liste(prisma, 'Kullanici', {
          kosul: [{ alan: 'id', islec: 'esit', deger: CEM }],
        }),
      ).toEqual([]);
      expect(
        adlar(
          await kapi.liste(prisma, 'Kullanici', {
            kosul: [{ alan: 'id', islec: 'listede', deger: [AYSE, CEM] }],
          }),
        ),
      ).toEqual(['Ayşe']);
      const hata: unknown = await kapi
        .tek(prisma, 'Kullanici', CEM)
        .catch((e: unknown) => e);
      expect(hata).toBeInstanceOf(KodluHata);
      expect(hata).toMatchObject({ kod: 'bulunamadi' });
      expect(await kapi.tek(prisma, 'Kullanici', AYSE)).toMatchObject({
        id: AYSE,
      });
    });
  });

  it('h) sayfalama ve sıralama birleşik sonuçta tutarlıdır', async () => {
    // İki yetenek farklı kolonlarla örtüşen kayıtları görür; ikisi de ada bakabilir, kimlik listede
    // olmasa da görünür.
    const yetki = await yetkiAl(AYSE, [AYSE_A, ECE_A_R2], [
      yetenek({
        sart: [
          { alan: 'gorunenAd', islec: 'listede', deger: ['Ayşe', 'Banu', 'Cem'] },
        ],
        kolonlar: ['gorunenAd', 'sistemAktoru'],
      }),
      yetenek({
        yetenekId: Y2,
        rolId: R2,
        sart: [
          { alan: 'gorunenAd', islec: 'listede', deger: ['Cem', 'Deniz', 'Ece'] },
        ],
        kolonlar: ['gorunenAd', 'sistemAktoru', 'kullaniciAdi'],
      }),
    ]);

    await istekte(yetki, async () => {
      // Ada göre azalan.
      const siralama = [{ alan: 'gorunenAd', yon: 'azalan' }] as const;
      const tam = await kapi.liste(prisma, 'Kullanici', { siralama });
      expect(adlar(tam)).toEqual(['Ece', 'Deniz', 'Cem', 'Banu', 'Ayşe']);
      expect(tam[2]).toEqual({
        id: CEM,
        gorunenAd: 'Cem',
        sistemAktoru: false,
        kullaniciAdi: 'cem',
      });
      const sayfalar = [];
      for (const atla of [0, 2, 4]) {
        sayfalar.push(
          await kapi.liste(prisma, 'Kullanici', {
            siralama,
            sayfa: { atla, al: 2 },
          }),
        );
      }
      expect(sayfalar.map((s) => s.length)).toEqual([2, 2, 1]);
      expect(sayfalar.flat()).toEqual(tam);
      expect(new Set(kimlikler(sayfalar.flat())).size).toBe(KISILER.length);

      // Bütün değerleri eşit kolona göre: eşitlik kimlikle bozulur, sayfalar yine çakışmaz.
      const esit = [{ alan: 'sistemAktoru', yon: 'artan' }] as const;
      const tamEsit = await kapi.liste(prisma, 'Kullanici', {
        siralama: esit,
      });
      const ilk = await kapi.liste(prisma, 'Kullanici', {
        siralama: esit,
        sayfa: { atla: 0, al: 3 },
      });
      const son = await kapi.liste(prisma, 'Kullanici', {
        siralama: esit,
        sayfa: { atla: 3, al: 3 },
      });
      expect([...ilk, ...son]).toEqual(tamEsit);
      expect(kimlikler(tamEsit)).toEqual([AYSE, BANU, CEM, DENIZ, ECE]);

      // Kimliğe göre azalan: kimlik listede olmasa da iki yetenek de katılır.
      const kimlikSirasi = [{ alan: 'id', yon: 'azalan' }] as const;
      const ilkKimlik = await kapi.liste(prisma, 'Kullanici', {
        siralama: kimlikSirasi,
        sayfa: { atla: 0, al: 3 },
      });
      const sonKimlik = await kapi.liste(prisma, 'Kullanici', {
        siralama: kimlikSirasi,
        sayfa: { atla: 3, al: 3 },
      });
      expect(kimlikler([...ilkKimlik, ...sonKimlik])).toEqual([
        ECE,
        DENIZ,
        CEM,
        BANU,
        AYSE,
      ]);
    });
  });

  it('i) okumadan sonra istek bağlamında kullanılan yetenek ve üyelik kimlikleri ve kayıt sayısı vardır', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A, ECE_A_R2], [
      yetenek({
        kaynak: 'Uyelik',
        sart: [
          {
            alan: 'grupId',
            islec: 'listede',
            deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
          },
        ],
        butunKolonlar: true,
      }),
      yetenek({
        yetenekId: Y2,
        rolId: R2,
        sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Ece' }],
        kolonlar: ['gorunenAd'],
      }),
    ]);

    const birikim = await istekte(yetki, async () => {
      expect(okumaBirikimi()).toEqual({
        yetenekIdleri: [],
        uyelikIdleri: [],
        kayitSayisi: 0,
      });
      await kapi.liste(prisma, 'Uyelik');
      await kapi.liste(prisma, 'Kullanici');
      return okumaBirikimi();
    });

    expect(birikim).toEqual({
      yetenekIdleri: [Y1, Y2],
      uyelikIdleri: [UY_A, UY_A_R2],
      kayitSayisi: 4,
    });
  });

  describe('k) yalnız canlı kayıtlar (TS-002 AK-42)', () => {
    beforeEach(async () => {
      await gozlemci.query(
        'insert into uyelik (id, kullanici_id, grup_id, rol_id, silinme_zamani) values ($1, $2, $3, $4, now())',
        [UY_SILINMIS, BANU, G_A, R2],
      );
    });

    afterEach(async () => {
      await gozlemci.query('delete from uyelik where id = $1', [UY_SILINMIS]);
    });

    it('seçenek açıkken silinmiş kayıt gelmez; silinme zamanını görmeyen yetenek de katılır ve yalnız kendi kolonlarını ve kimliği verir', async () => {
      const dar = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ kaynak: 'Uyelik', butunKayitlar: true, kolonlar: ['grupId'] }),
      ]);

      await istekte(dar, async () => {
        expect(
          await kapi.liste(prisma, 'Uyelik', { yalnizCanli: true }),
        ).toEqual([
          { id: UY_A, grupId: G_A },
          { id: UY_A1, grupId: G_A1 },
          { id: UY_B, grupId: G_B },
          { id: UY_KOK, grupId: G_KOK },
          { id: UY_A_R2, grupId: G_A },
        ]);
        // Sayfa canlı kayıtlar üzerindedir.
        expect(
          kimlikler(
            await kapi.liste(prisma, 'Uyelik', {
              yalnizCanli: true,
              sayfa: { atla: 4, al: 2 },
            }),
          ),
        ).toEqual([UY_A_R2]);
        // Seçenek kapalıyken silinmiş kayıt da gelir; tek kayıt okuması değişmez.
        expect(kimlikler(await kapi.liste(prisma, 'Uyelik'))).toEqual([
          UY_A,
          UY_A1,
          UY_B,
          UY_KOK,
          UY_A_R2,
          UY_SILINMIS,
        ]);
        expect(await kapi.tek(prisma, 'Uyelik', UY_SILINMIS)).toEqual({
          id: UY_SILINMIS,
          grupId: G_A,
        });
      });
    });

    it('seçenek kapalıyken silinmiş kayıt silinme zamanıyla gelir', async () => {
      const tam = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ kaynak: 'Uyelik', butunKayitlar: true, butunKolonlar: true }),
      ]);

      const kayitlar = await istekte(tam, () => kapi.liste(prisma, 'Uyelik'));

      expect(kimlikler(kayitlar)).toContain(UY_SILINMIS);
      expect(
        kayitlar.find((k) => k['id'] === UY_SILINMIS)?.['silinmeZamani'],
      ).toBeInstanceOf(Date);
    });

    it('silinme zamanı alanı olmayan kaynakta seçenek hatadır ve sorgu gitmez', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ butunKayitlar: true, butunKolonlar: true }),
      ]);

      await expect(
        istekte(yetki, () =>
          kapi.liste(prisma, 'Kullanici', { yalnizCanli: true }),
        ),
      ).rejects.toThrow('Silinme zamanı alanı olmayan kaynak: Kullanici');
      expect(sorgular).toEqual([]);
    });
  });

  describe('l) boş ve dolu işleçleri (TS-002 AK-42)', () => {
    beforeEach(async () => {
      await gozlemci.query(
        'update kullanici set pasif_zamani = now() where id = $1',
        [DENIZ],
      );
    });

    afterEach(async () => {
      await gozlemci.query('update kullanici set pasif_zamani = null');
    });

    it('çağıranın koşulunda boş ve dolu doğru süzer', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ butunKayitlar: true, butunKolonlar: true }),
      ]);

      await istekte(yetki, async () => {
        expect(
          adlar(
            await kapi.liste(prisma, 'Kullanici', {
              kosul: [{ alan: 'pasifZamani', islec: 'dolu' }],
            }),
          ),
        ).toEqual(['Deniz']);
        expect(
          adlar(
            await kapi.liste(prisma, 'Kullanici', {
              kosul: [{ alan: 'pasifZamani', islec: 'bos' }],
            }),
          ),
        ).toEqual(['Ayşe', 'Banu', 'Cem', 'Ece']);
        // Değerli öğelerle "ve" ile bağlanır.
        expect(
          adlar(
            await kapi.liste(prisma, 'Kullanici', {
              kosul: [
                { alan: 'pasifZamani', islec: 'bos' },
                { alan: 'gorunenAd', islec: 'listede', deger: ['Ayşe', 'Deniz'] },
              ],
            }),
          ),
        ).toEqual(['Ayşe']);
        await expect(
          kapi.liste(prisma, 'Kullanici', {
            kosul: [{ alan: 'parolaOzeti', islec: 'bos' }],
          }),
        ).rejects.toThrow('bilinmeyen alan: parolaOzeti');
      });
    });

    it('baktıkları kolonu göremeyen yetenek okumaya katılmaz', async () => {
      // Y1 yalnız adı, Y2 adı ve pasif zamanını görür.
      const yetki = await yetkiAl(AYSE, [AYSE_A, ECE_A_R2], [
        yetenek({ butunKayitlar: true, kolonlar: ['gorunenAd'] }),
        yetenek({
          yetenekId: Y2,
          rolId: R2,
          butunKayitlar: true,
          kolonlar: ['gorunenAd', 'pasifZamani'],
        }),
      ]);

      const { dolu, bos, birikim } = await istekte(yetki, async () => ({
        dolu: await kapi.liste(prisma, 'Kullanici', {
          kosul: [{ alan: 'pasifZamani', islec: 'dolu' }],
        }),
        bos: await kapi.liste(prisma, 'Kullanici', {
          kosul: [{ alan: 'pasifZamani', islec: 'bos' }],
        }),
        birikim: okumaBirikimi(),
      }));

      expect(dolu).toEqual([
        { id: DENIZ, gorunenAd: 'Deniz', pasifZamani: expect.any(Date) as Date },
      ]);
      expect(bos).toEqual(
        ['Ayşe', 'Banu', 'Cem', 'Ece'].map((ad) => ({
          id: expect.any(String) as string,
          gorunenAd: ad,
          pasifZamani: null,
        })),
      );
      expect(birikim.yetenekIdleri).toEqual([Y2]);

      const yalnizAd = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ butunKayitlar: true, kolonlar: ['gorunenAd'] }),
      ]);
      expect(
        await istekte(yalnizAd, () =>
          kapi.liste(prisma, 'Kullanici', {
            kosul: [{ alan: 'pasifZamani', islec: 'dolu' }],
          }),
        ),
      ).toEqual([]);
    });

    it('saklanan yetenek şartında boş ve dolu derlenmez', async () => {
      // Saklanan şartın dilinde (Islec) bu işleçler yoktur; veri yine de gelirse derleyici reddeder.
      const saklanan = (islec: string): SartOgesi =>
        ({ alan: 'pasifZamani', islec, deger: true }) as unknown as SartOgesi;
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ sart: [saklanan('bos')], butunKolonlar: true }),
        yetenek({ yetenekId: Y2, sart: [saklanan('dolu')], butunKolonlar: true }),
      ]);

      expect(yetki.kurallar).toEqual([]);
      expect(yetki.derlenmeyenler).toEqual([
        { yetenekId: Y1, neden: 'bilinmeyen işleç: bos' },
        { yetenekId: Y2, neden: 'bilinmeyen işleç: dolu' },
      ]);
    });
  });

  describe('m) koşulsuz ve koşullu kural birlikte (TS-002 AK-52)', () => {
    // Y1 bütün kayıtları görür; Y2 yalnız isteyenin kendi kaydını.
    const kosulsuzVeKosullu = (
      y1Kolonlar: readonly string[],
      y2Kolonlar: readonly string[],
    ): Promise<DerlemeSonucu> =>
      yetkiAl(AYSE, [AYSE_A, ECE_A_R2], [
        yetenek({
          butunKayitlar: true,
          ...(y1Kolonlar.length === 0
            ? { butunKolonlar: true }
            : { kolonlar: [...y1Kolonlar] }),
        }),
        yetenek({
          yetenekId: Y2,
          rolId: R2,
          sart: [
            { alan: 'id', islec: 'esit', deger: { yerTutucu: 'isteyen' } },
          ],
          ...(y2Kolonlar.length === 0
            ? { butunKolonlar: true }
            : { kolonlar: [...y2Kolonlar] }),
        }),
      ]);

    it('liste: koşulsuz kural bütün kayıtları verir; çağıranın koşulu yine uygulanır', async () => {
      const yetki = await kosulsuzVeKosullu([], []);

      await istekte(yetki, async () => {
        expect(adlar(await kapi.liste(prisma, 'Kullanici'))).toEqual([
          'Ayşe',
          'Banu',
          'Cem',
          'Deniz',
          'Ece',
        ]);
        expect(
          adlar(
            await kapi.liste(prisma, 'Kullanici', {
              kosul: [
                { alan: 'gorunenAd', islec: 'listede', deger: ['Banu', 'Deniz'] },
              ],
            }),
          ),
        ).toEqual(['Banu', 'Deniz']);
      });
    });

    it('tek kayıt: koşullu kuralın tutmadığı kayıt kimliğiyle okunur', async () => {
      const yetki = await kosulsuzVeKosullu([], []);

      await istekte(yetki, async () => {
        expect(await kapi.tek(prisma, 'Kullanici', CEM)).toMatchObject({
          id: CEM,
          gorunenAd: 'Cem',
          kullaniciAdi: 'cem',
        });
      });
    });

    it('kolonlar: koşulun tuttuğu satır iki kuralın kolonlarını, tutmayan satır yalnız koşulsuz kuralın kolonlarını taşır', async () => {
      const yetki = await kosulsuzVeKosullu(
        ['gorunenAd'],
        ['gorunenAd', 'kullaniciAdi', 'sistemAktoru'],
      );

      await istekte(yetki, async () => {
        expect(await kapi.liste(prisma, 'Kullanici')).toEqual([
          {
            id: AYSE,
            gorunenAd: 'Ayşe',
            kullaniciAdi: 'ayse',
            sistemAktoru: false,
          },
          { id: BANU, gorunenAd: 'Banu' },
          { id: CEM, gorunenAd: 'Cem' },
          { id: DENIZ, gorunenAd: 'Deniz' },
          { id: ECE, gorunenAd: 'Ece' },
        ]);
        expect(await kapi.tek(prisma, 'Kullanici', AYSE)).toEqual({
          id: AYSE,
          gorunenAd: 'Ayşe',
          kullaniciAdi: 'ayse',
          sistemAktoru: false,
        });
        expect(await kapi.tek(prisma, 'Kullanici', DENIZ)).toEqual({
          id: DENIZ,
          gorunenAd: 'Deniz',
        });
      });
    });

    it('koşulsuz kural yoksa iki koşulun birleşimi döner; kuralı olmayan kişi hiçbir satır almaz', async () => {
      const ikiKosullu = await yetkiAl(AYSE, [AYSE_A, ECE_A_R2], [
        yetenek({
          sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Banu' }],
          butunKolonlar: true,
        }),
        yetenek({
          yetenekId: Y2,
          rolId: R2,
          sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Deniz' }],
          butunKolonlar: true,
        }),
      ]);
      const kuralsiz = await yetkiAl(AYSE, [AYSE_A], []);

      await istekte(ikiKosullu, async () => {
        expect(adlar(await kapi.liste(prisma, 'Kullanici'))).toEqual([
          'Banu',
          'Deniz',
        ]);
        await expect(
          kapi.tek(prisma, 'Kullanici', CEM),
        ).rejects.toMatchObject({ kod: 'bulunamadi' });
      });
      await istekte(kuralsiz, async () => {
        expect(await kapi.liste(prisma, 'Kullanici')).toEqual([]);
      });
    });
  });

  it('kapı yalnız katalogdaki kaynak ve kolonlarla çalışır', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({ butunKayitlar: true, butunKolonlar: true }),
    ]);

    await istekte(yetki, async () => {
      await expect(kapi.liste(prisma, 'Grup')).rejects.toThrow(
        'Kaynak kataloğunda olmayan kaynak: Grup',
      );
      await expect(
        kapi.liste(prisma, 'Kullanici', {
          kosul: [{ alan: 'parolaOzeti', islec: 'esit', deger: 'x' }],
        }),
      ).rejects.toThrow('bilinmeyen alan: parolaOzeti');
      await expect(
        kapi.liste(prisma, 'Kullanici', {
          siralama: [{ alan: 'uyelikler', yon: 'artan' }],
        }),
      ).rejects.toThrow('Sıralama için bilinmeyen alan: uyelikler');
    });
    expect(sorgular).toEqual([]);
  });

  it('j) kayıt üzerinde karar veren kütüphane çağrısı lint hatasıdır', async () => {
    const yasak = [
      "import { permittedFieldsOf } from '@casl/ability/extra';",
      "import type { YetkiYetenegi } from './yetenek-derleyici.js';",
      'export function f(y: YetkiYetenegi): boolean {',
      "  return y.can('oku', 'Grup');",
      '}',
      'export { permittedFieldsOf };',
      '',
    ].join('\n');
    const izinli = [
      "import type { YetkiYetenegi } from './yetenek-derleyici.js';",
      'export function f(y: YetkiYetenegi): boolean {',
      "  return y.possibleRulesFor('oku', 'Grup').length > 0;",
      '}',
      '',
    ].join('\n');

    const ortak = await lintStdin('src/shared/yetki/okuma-kapisi.ts', yasak);
    expect(ortak.cikis).toBe(1);
    expect(
      ortak.cikti.match(/Kayıt üzerinde karar veren yetki çağrısı/g),
    ).toHaveLength(2);

    const feature = await lintStdin(
      'src/features/kimlik/kimlik.module.ts',
      "import { ForbiddenError } from '@casl/ability';\nexport const f = (y: Parameters<typeof ForbiddenError.from>[0]): void => {\n  ForbiddenError.from(y).throwUnlessCan('oku', 'Grup');\n};\n",
    );
    expect(feature.cikis).toBe(1);
    expect(feature.cikti).toContain('Kayıt üzerinde karar veren yetki çağrısı');

    expect(await lintStdin('src/shared/yetki/okuma-kapisi.ts', izinli)).toEqual(
      { cikis: 0, cikti: '' },
    );
  }, 120_000);
});
