// Yetki kapısı - yazma: şartlı yazma, kolon sınırı, oluşturma denetimi ve değişiklik kaydı (GV-034;
// TS-002 AK-19; KR-010 Seçim 26, 37, 40 ve "Derleme eşlemesi"; KR-008 Seçim 10, 34, 42). Koşturma:
//   pnpm -C backend test:e2e test/yetki-kapisi-yazma.e2e-spec.ts --reporter=verbose
// Kurulum okuma testlerindekiyle aynıdır: göçleri uygulanmış geçici veritabanı; birimli (Uyelik) ve
// birimsiz (Kullanici) kaynak; satırlar ayrı bir bağlantıdan (gözlemci) SQL ile yazılır ve okunur;
// derlenmiş yetki yetki belleğinden, testin verdiği yetki verisiyle alınır; istek bağlamı ara katmanla
// testte kurulur. Yazma Unit of Work'ün run'ı içinde, işin işlem nesnesiyle yapılır; değişiklik kaydı
// notları outbox_iz tablosundan okunur.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { RepoKayitlari } from '../src/shared/database/infrastructure/registrar.js';
import type { Islem } from '../src/shared/database/domain/islem.js';
import { UnitOfWork } from '../src/shared/database/infrastructure/unit-of-work.js';
import {
  istekBaglami,
  istekBaglamiAraKatmani,
  istekOturumunuYaz,
  istekYetkisiniYaz,
} from '../src/shared/observability/istek-baglami/istek-baglami.js';
import type {
  KisininSatirlari,
  UyelikSatiri,
  YetenekSatiri,
} from '../src/shared/kimlik/domain/i-yetki-verisi.contract.js';
import {
  OUTBOX_REPO,
  outboxRepo,
} from '../src/shared/messaging/infrastructure/outbox/outbox-repo.js';
import { OutboxYazici } from '../src/shared/messaging/infrastructure/outbox/outbox-yazici.js';
import { prismaKaynakKatalogu } from '../src/shared/yetki/infrastructure/prisma-kaynak-katalogu.js';
import type { DerlemeSonucu } from '../src/shared/yetki/application/yetenek-derleyici.js';
import { YazmaKapisi } from '../src/shared/yetki/infrastructure/yazma-kapisi.js';
import { YetkiBellegi } from '../src/shared/yetki/infrastructure/yetki-bellegi.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { EskiYazmaKapisi } from './yardimci/eski-yuz.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

// Kullanıcının sistemin yazdığı alanları (TS-002 "Veri modeli", çürütme 17) katalogda işaretlidir.
const KATALOG = prismaKaynakKatalogu(['Uyelik', 'Kullanici'], {
  Kullanici: ['yetkiSurumu', 'sistemAktoru', 'pasifZamani', 'unutulmaZamani'],
});

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
const KISI_IDLERI = KISILER.map(([id]) => id);

// Ağaç: KOK → A → A1; KOK → B (A'nın kardeşi).
const G_KOK = '71000000-0000-4000-8000-000000000000';
const G_A = '71000000-0000-4000-8000-00000000000a';
const G_A1 = '71000000-0000-4000-8000-0000000000a1';
const G_B = '71000000-0000-4000-8000-00000000000b';

const R1 = '72000000-0000-4000-8000-000000000001';
const R2 = '72000000-0000-4000-8000-000000000002';

const UY_A = '73000000-0000-4000-8000-000000000001';
const UY_A1 = '73000000-0000-4000-8000-000000000002';
const UY_B = '73000000-0000-4000-8000-000000000003';
const UY_KOK = '73000000-0000-4000-8000-000000000004';
const UY_A_R2 = '73000000-0000-4000-8000-000000000005';
const UYELIKLER = [
  [UY_A, AYSE, G_A, R1],
  [UY_A1, BANU, G_A1, R1],
  [UY_B, CEM, G_B, R1],
  [UY_KOK, DENIZ, G_KOK, R1],
  [UY_A_R2, ECE, G_A, R2],
] as const;
const UYELIK_IDLERI = UYELIKLER.map(([id]) => id);

const Y1 = '74000000-0000-4000-8000-000000000001';
const Y2 = '74000000-0000-4000-8000-000000000002';
const Y3 = '74000000-0000-4000-8000-000000000003';

const OTURUM = '75000000-0000-4000-8000-000000000001';

const AYSE_A: UyelikSatiri = { uyelikId: UY_A, grupId: G_A, rolId: R1 };
const ECE_A_R2: UyelikSatiri = { uyelikId: UY_A_R2, grupId: G_A, rolId: R2 };
const ALT_GRUPLAR = { [G_A]: [G_A, G_A1], [G_B]: [G_B] };

const GRUP_VE_ALTI = {
  alan: 'grupId',
  islec: 'listede',
  deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
} as const;

interface KisiSatiri {
  id: string;
  kullanici_adi: string | null;
  gorunen_ad: string;
  sistem_aktoru: boolean;
  yetki_surumu: number;
  pasif_zamani: Date | null;
}

interface UyelikDurumu {
  id: string;
  kullanici_id: string;
  grup_id: string;
  rol_id: string;
  silinme_zamani: Date | null;
}

type Not = Record<string, unknown>;

let db: TestDatabase;
let gozlemci: pg.Client;
let gozlemciPid: number;
let prisma: PrismaClient<'query'>;
let uow: UnitOfWork;
let kapi: EskiYazmaKapisi;
const sorgular: string[] = [];

function yetenek(degisen: Partial<YetenekSatiri>): YetenekSatiri {
  return {
    yetenekId: Y1,
    grupId: G_A,
    rolId: R1,
    kaynak: 'Kullanici',
    eylem: 'guncelle',
    sart: [],
    butunKayitlar: false,
    butunBirimler: false,
    kolonlar: [],
    butunKolonlar: false,
    giremez: false,
    oncelik: 0,
    yasaktanMuaf: false,
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

// İşi, oturumu ve yetkisi yazılmış bir istek bağlamının içinde koşturur.
function istekte<T>(
  kisi: string,
  yetki: DerlemeSonucu,
  is: () => Promise<T>,
): Promise<T> {
  return new Promise<T>((coz, reddet) => {
    // Ara katman istekten bir şey okumaz, cevaba yalnız başlık yazar.
    const cevap = { setHeader: () => undefined };
    istekBaglamiAraKatmani(
      {} as unknown as IncomingMessage,
      cevap as unknown as ServerResponse,
      () => {
        istekOturumunuYaz({
          kullaniciId: kisi,
          oturumId: OTURUM,
          kisiSurumu: 0,
          genelSurum: 0,
        });
        istekYetkisiniYaz(yetki);
        is().then(coz, reddet);
      },
    );
  });
}

// Tek işi bir istek içinde, kendi run'ında koşturur.
function yaz<T>(
  kisi: string,
  yetki: DerlemeSonucu,
  is: (islem: Islem) => Promise<T>,
): Promise<T> {
  return istekte(kisi, yetki, () => uow.run(is));
}

async function kisiSatiri(id: string): Promise<KisiSatiri | undefined> {
  return (
    await gozlemci.query<KisiSatiri>(
      'select id, kullanici_adi, gorunen_ad, sistem_aktoru, yetki_surumu, pasif_zamani from kullanici where id = $1',
      [id],
    )
  ).rows[0];
}

async function uyelikSatiri(id: string): Promise<UyelikDurumu | undefined> {
  return (
    await gozlemci.query<UyelikDurumu>(
      'select id, kullanici_id, grup_id, rol_id, silinme_zamani from uyelik where id = $1',
      [id],
    )
  ).rows[0];
}

async function kisiSayisi(): Promise<number> {
  return (
    await gozlemci.query<{ sayi: number }>(
      'select count(*)::int as sayi from kullanici',
    )
  ).rows[0]?.sayi ?? -1;
}

// Değişiklik kaydı notlarının gövdeleri, yazıldıkları sırayla.
async function notlar(): Promise<Not[]> {
  return (
    await gozlemci.query<{ govde: Not }>(
      'select govde from outbox_iz order by olusturma_zamani, id',
    )
  ).rows.map((satir) => satir.govde);
}

// Gözlemci bağlantısından satırı NOWAIT ile kilitlemeyi dener; kilit çakışırsa PostgreSQL 55P03 döner.
async function dene(
  id: string,
  kip: 'for update' | 'for key share',
): Promise<'kilitli' | 'serbest'> {
  await gozlemci.query('begin');
  try {
    await gozlemci.query(
      `select 1 from kullanici where id = $1 ${kip} nowait`,
      [id],
    );
    return 'serbest';
  } catch (hata) {
    if ((hata as { code?: string }).code === '55P03') {
      return 'kilitli';
    }
    throw hata;
  } finally {
    await gozlemci.query('rollback');
  }
}

// Veritabanında bir bağlantı satır kilidi bekleyene dek yoklar.
async function kilitBekleyeniBekle(): Promise<void> {
  const son = Date.now() + 3_000;
  for (;;) {
    const { rows } = await gozlemci.query<{ sayi: number }>(
      `select count(*)::int as sayi from pg_stat_activity
        where datname = $1 and wait_event_type = 'Lock'`,
      [db.name],
    );
    if ((rows[0]?.sayi ?? 0) > 0) {
      return;
    }
    if (Date.now() > son) {
      throw new Error('Kilit bekleyen bağlantı görülmedi');
    }
    await new Promise((coz) => setTimeout(coz, 20));
  }
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
  for (const [id, kisi, grup, rol] of UYELIKLER) {
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
  const kayitlar = new RepoKayitlari();
  kayitlar.register(OUTBOX_REPO, outboxRepo);
  uow = new UnitOfWork(prisma, kayitlar);
  kapi = new EskiYazmaKapisi(
    new YazmaKapisi(KATALOG, new OutboxYazici(), kayitlar),
  );
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

// Her test başlangıç verisiyle başlar: notlar silinir, eklenen satırlar silinir, değişenler geri yazılır.
beforeEach(async () => {
  await gozlemci.query('delete from outbox_iz');
  await gozlemci.query('delete from uyelik where id <> all($1::uuid[])', [
    UYELIK_IDLERI,
  ]);
  for (const [id, kisi, grup, rol] of UYELIKLER) {
    await gozlemci.query(
      `update uyelik set kullanici_id = $2, grup_id = $3, rol_id = $4, silinme_zamani = null
         where id = $1`,
      [id, kisi, grup, rol],
    );
  }
  await gozlemci.query('delete from kullanici where id <> all($1::uuid[])', [
    KISI_IDLERI,
  ]);
  for (const [id, kullaniciAdi, ad] of KISILER) {
    await gozlemci.query(
      `update kullanici set kullanici_adi = $2, gorunen_ad = $3, sistem_aktoru = false,
         yetki_surumu = 0, pasif_zamani = null where id = $1`,
      [id, kullaniciAdi, ad],
    );
  }
  sorgular.length = 0;
});

describe('yetki kapısı - yazma', () => {
  describe('a) güncelleme', () => {
    it('yetkisi içindeki kaydı güncelleme yazar; yetkisi dışındaki kayıt bulunamadi döner ve satır değişmez', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({
          sart: [{ alan: 'id', islec: 'listede', deger: [AYSE, BANU] }],
          kolonlar: ['gorunenAd'],
        }),
      ]);

      await yaz(AYSE, yetki, (islem) =>
        kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', BANU, {
          gorunenAd: 'Banu Nur',
        }),
      );
      expect((await kisiSatiri(BANU))?.gorunen_ad).toBe('Banu Nur');

      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', CEM, {
            gorunenAd: 'Cem Can',
          }),
        ),
      ).rejects.toMatchObject({ kod: 'bulunamadi' });
      expect((await kisiSatiri(CEM))?.gorunen_ad).toBe('Cem');
      expect(await notlar()).toHaveLength(1);
    });

    it('yeni hâli yeteneğin şartından çıkan güncelleme yetki_yok döner ve geri alınır (iki hâl kuralı)', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({
          sart: [
            { alan: 'gorunenAd', islec: 'listede', deger: ['Ayşe', 'Banu'] },
          ],
          kolonlar: ['gorunenAd'],
        }),
      ]);

      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', BANU, {
            gorunenAd: 'Zeynep',
          }),
        ),
      ).rejects.toMatchObject({ kod: 'yetki_yok' });
      expect((await kisiSatiri(BANU))?.gorunen_ad).toBe('Banu');
      expect(await notlar()).toEqual([]);
    });
  });

  describe('b) kolon sınırı', () => {
    it('izinli olmayan bir kolonu değiştiren yazma yetki_yok döner ve hiçbir kolon yazılmaz; değeri değişmeyen alan yazılan sayılmaz', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ butunKayitlar: true, kolonlar: ['gorunenAd'] }),
      ]);

      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', CEM, {
            gorunenAd: 'Cem Can',
            kullaniciAdi: 'cemcan',
          }),
        ),
      ).rejects.toMatchObject({ kod: 'yetki_yok' });
      expect(await kisiSatiri(CEM)).toMatchObject({
        kullanici_adi: 'cem',
        gorunen_ad: 'Cem',
      });
      expect(await notlar()).toEqual([]);

      await yaz(AYSE, yetki, (islem) =>
        kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', CEM, {
          gorunenAd: 'Cem Can',
          kullaniciAdi: 'cem',
        }),
      );
      expect(await kisiSatiri(CEM)).toMatchObject({
        kullanici_adi: 'cem',
        gorunen_ad: 'Cem Can',
      });
      expect((await notlar()).map((n) => n['degisen'])).toEqual([
        { gorunen_ad: { eski: 'Cem', yeni: 'Cem Can' } },
      ]);
    });

    it('sistemin yazdığı kolon, bütün kolonlar yeteneğiyle de istekle değiştirilemez ve hiçbir yazma deyimi gitmez', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ butunKayitlar: true, butunKolonlar: true }),
        yetenek({
          yetenekId: Y2,
          eylem: 'olustur',
          butunKayitlar: true,
          butunKolonlar: true,
        }),
      ]);

      for (const veri of [
        { sistemAktoru: true },
        { yetkiSurumu: 7 },
        { pasifZamani: new Date() },
        { gorunenAd: 'Cem Can', unutulmaZamani: new Date() },
        { id: '70000000-0000-4000-8000-0000000000ff' },
        { olusturmaZamani: new Date(0) },
      ]) {
        await expect(
          yaz(AYSE, yetki, (islem) =>
            kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', CEM, veri),
          ),
        ).rejects.toMatchObject({ kod: 'yetki_yok' });
        await expect(
          yaz(AYSE, yetki, (islem) =>
            kapi.olustur(islem, 'kullanici.olustur', 'Kullanici', {
              gorunenAd: 'Fatma',
              ...veri,
            }),
          ),
        ).rejects.toMatchObject({ kod: 'yetki_yok' });
      }
      expect(await kisiSatiri(CEM)).toMatchObject({
        gorunen_ad: 'Cem',
        sistem_aktoru: false,
        yetki_surumu: 0,
        pasif_zamani: null,
      });
      expect(await kisiSayisi()).toBe(KISILER.length);
      expect(sorgular.filter((s) => /^(UPDATE|INSERT)/.test(s))).toEqual([]);
      expect(await notlar()).toEqual([]);
    });
  });

  it('c) iki yetenekten yalnız ikincisinin koşulu tutuyorsa yazma onunla yapılır ve nota onun kimliği girer', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A, ECE_A_R2], [
      yetenek({
        sart: [{ alan: 'id', islec: 'esit', deger: CEM }],
        butunKolonlar: true,
      }),
      yetenek({
        yetenekId: Y2,
        rolId: R2,
        sart: [{ alan: 'id', islec: 'esit', deger: { yerTutucu: 'isteyen' } }],
        butunKolonlar: true,
      }),
    ]);

    await yaz(AYSE, yetki, (islem) =>
      kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', AYSE, {
        gorunenAd: 'Ayşe Nur',
      }),
    );

    expect((await kisiSatiri(AYSE))?.gorunen_ad).toBe('Ayşe Nur');
    expect(await notlar()).toEqual([
      expect.objectContaining({ yetenek_id: Y2, uyelik_id: UY_A_R2 }),
    ]);
  });

  it('c2) yetenek sırası: önceki hâli tutup yeni hâli tutmayan yetenek yazmayı kalıcı kılmaz, iki hâli tutan sıradaki yetenek yazar; sıra tersken de aynı; yalnız ilki varken yetki_yok', async () => {
    const y1 = yetenek({
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Banu' }],
      kolonlar: ['gorunenAd'],
    });
    const y2 = yetenek({
      yetenekId: Y2,
      butunKayitlar: true,
      kolonlar: ['gorunenAd'],
    });
    const guncelle = async (
      yetenekler: readonly YetenekSatiri[],
    ): Promise<void> => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], yetenekler);
      await yaz(AYSE, yetki, (islem) =>
        kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', BANU, {
          gorunenAd: 'Banu Nur',
        }),
      );
    };

    for (const yetenekler of [
      [y1, y2],
      [y2, y1],
    ]) {
      await gozlemci.query('delete from outbox_iz');
      await gozlemci.query(
        "update kullanici set gorunen_ad = 'Banu' where id = $1",
        [BANU],
      );

      await guncelle(yetenekler);

      expect((await kisiSatiri(BANU))?.gorunen_ad).toBe('Banu Nur');
      expect(await notlar()).toEqual([
        expect.objectContaining({
          yetenek_id: Y2,
          degisen: { gorunen_ad: { eski: 'Banu', yeni: 'Banu Nur' } },
        }),
      ]);
    }

    await gozlemci.query('delete from outbox_iz');
    await gozlemci.query(
      "update kullanici set gorunen_ad = 'Banu' where id = $1",
      [BANU],
    );
    await expect(guncelle([y1])).rejects.toMatchObject({ kod: 'yetki_yok' });
    expect((await kisiSatiri(BANU))?.gorunen_ad).toBe('Banu');
    expect(await notlar()).toEqual([]);
  });

  describe('d) silme', () => {
    const SILINECEK = '70000000-0000-4000-8000-000000000006';
    const KALACAK = '70000000-0000-4000-8000-000000000007';

    it('silme biçimi olmayan kaynakta yetkisi içindeki satır silinir, dışındakinde bulunamadi döner', async () => {
      await gozlemci.query(
        "insert into kullanici (id, gorunen_ad) values ($1, 'Silinecek'), ($2, 'Kalacak')",
        [SILINECEK, KALACAK],
      );
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({
          eylem: 'sil',
          sart: [{ alan: 'id', islec: 'esit', deger: SILINECEK }],
          butunKolonlar: true,
        }),
      ]);

      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.sil(islem, 'kullanici.sil', 'Kullanici', KALACAK),
        ),
      ).rejects.toMatchObject({ kod: 'bulunamadi' });
      expect(await kisiSatiri(KALACAK)).toBeDefined();

      await yaz(AYSE, yetki, (islem) =>
        kapi.sil(islem, 'kullanici.sil', 'Kullanici', SILINECEK),
      );
      expect(await kisiSatiri(SILINECEK)).toBeUndefined();
      expect(await notlar()).toEqual([
        expect.objectContaining({ eylem: 'silme', kayit_id: SILINECEK }),
      ]);
    });

    it('silinme zamanı taşıyan kaynakta silme yumuşaktır: satır kalır, silinme zamanı bir kez yazılır; birim dışındaki kayıt bulunamadi', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({
          kaynak: 'Uyelik',
          eylem: 'sil',
          sart: [GRUP_VE_ALTI],
          butunKolonlar: true,
        }),
      ]);
      const sil = (id: string): Promise<void> =>
        yaz(AYSE, yetki, (islem) =>
          kapi.sil(islem, 'uyelik.kaldir', 'Uyelik', id),
        );

      await sil(UY_A1);
      const silinen = await uyelikSatiri(UY_A1);
      expect(silinen?.silinme_zamani).toBeInstanceOf(Date);

      await expect(sil(UY_A1)).rejects.toMatchObject({ kod: 'bulunamadi' });
      expect(await uyelikSatiri(UY_A1)).toEqual(silinen);
      await expect(sil(UY_B)).rejects.toMatchObject({ kod: 'bulunamadi' });
      expect((await uyelikSatiri(UY_B))?.silinme_zamani).toBeNull();
      expect(await notlar()).toHaveLength(1);
    });
  });

  it('d2) silinme zamanı taşıyan kaynakta silinmiş kayıt güncellenmez ve niyet eylemi almaz (bulunamadi); canlı kayıtta ve silinme zamanı olmayan kaynakta ikisi de yazar', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({
        kaynak: 'Uyelik',
        sart: [GRUP_VE_ALTI],
        butunKolonlar: true,
      }),
      yetenek({
        yetenekId: Y2,
        kaynak: 'Uyelik',
        eylem: 'rol_degistir',
        sart: [GRUP_VE_ALTI],
        butunKolonlar: true,
      }),
      yetenek({ yetenekId: Y3, butunKayitlar: true, butunKolonlar: true }),
    ]);
    const guncelle = (id: string, rolId: string): Promise<void> =>
      yaz(AYSE, yetki, (islem) =>
        kapi.guncelle(islem, 'uyelik.guncelle', 'Uyelik', id, { rolId }),
      );
    const rolDegistir = (id: string, rolId: string): Promise<void> =>
      yaz(AYSE, yetki, (islem) =>
        kapi.niyet(islem, 'uyelik.rol_degistir', 'Uyelik', 'rol_degistir', id, {
          rolId,
        }),
      );
    await gozlemci.query(
      'update uyelik set silinme_zamani = now() where id = $1',
      [UY_A1],
    );
    const silinen = await uyelikSatiri(UY_A1);

    // a) ve b): aynı yetenekler canlı satırı yazar; silinmiş satır var olmayan satır gibi bulunamadi döner.
    await expect(guncelle(UY_A1, R2)).rejects.toMatchObject({
      kod: 'bulunamadi',
    });
    await expect(rolDegistir(UY_A1, R2)).rejects.toMatchObject({
      kod: 'bulunamadi',
    });
    expect(await uyelikSatiri(UY_A1)).toEqual(silinen);
    expect(await notlar()).toEqual([]);

    // c) canlı satırda güncelleme ve niyet eylemi yazar ve not bırakır.
    await guncelle(UY_A, R2);
    expect((await uyelikSatiri(UY_A))?.rol_id).toBe(R2);
    await rolDegistir(UY_A, R1);
    expect((await uyelikSatiri(UY_A))?.rol_id).toBe(R1);

    // d) silinme zamanı alanı olmayan kaynakta güncelleme yazar.
    await yaz(AYSE, yetki, (islem) =>
      kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', BANU, {
        gorunenAd: 'Banu Nur',
      }),
    );
    expect((await kisiSatiri(BANU))?.gorunen_ad).toBe('Banu Nur');

    expect(await notlar()).toEqual([
      expect.objectContaining({
        kayit_id: UY_A,
        is_adi: 'uyelik.guncelle',
        degisen: { rol_id: { eski: R1, yeni: R2 } },
      }),
      expect.objectContaining({
        kayit_id: UY_A,
        is_adi: 'uyelik.rol_degistir',
        degisen: { rol_id: { eski: R2, yeni: R1 } },
      }),
      expect.objectContaining({
        kayit_id: BANU,
        degisen: { gorunen_ad: { eski: 'Banu', yeni: 'Banu Nur' } },
      }),
    ]);
  });

  it('e) oluşturma: şarta uyan satır yazılır; başka birime yazılan satır yetki_yok ile reddedilir ve tabloda kalmaz', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({
        kaynak: 'Uyelik',
        eylem: 'olustur',
        sart: [GRUP_VE_ALTI],
        butunKolonlar: true,
      }),
    ]);
    const olustur = (grupId: string): Promise<string> =>
      yaz(AYSE, yetki, (islem) =>
        kapi.olustur(islem, 'uyelik.ver', 'Uyelik', {
          kullaniciId: CEM,
          grupId,
          rolId: R2,
        }),
      );

    const id = await olustur(G_A1);
    expect(await uyelikSatiri(id)).toEqual({
      id,
      kullanici_id: CEM,
      grup_id: G_A1,
      rol_id: R2,
      silinme_zamani: null,
    });

    await expect(olustur(G_B)).rejects.toMatchObject({ kod: 'yetki_yok' });
    const { rows } = await gozlemci.query<{ sayi: number }>(
      'select count(*)::int as sayi from uyelik where grup_id = $1',
      [G_B],
    );
    expect(rows[0]?.sayi).toBe(1);
    // Reddedilen oluşturmada satır yazılmış ve aynı işlemde yeniden okunmuştur.
    expect(
      sorgular.filter((s) => s.startsWith('INSERT INTO "public"."uyelik"')),
    ).toHaveLength(2);
    expect(await notlar()).toEqual([
      expect.objectContaining({ eylem: 'olusturma', kayit_id: id }),
    ]);
  });

  it('f) ya hep ya hiç: aynı işte ikinci yazma reddedilince birincisi de geri alınır ve hiçbir not kalmaz', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({
        sart: [{ alan: 'id', islec: 'esit', deger: { yerTutucu: 'isteyen' } }],
        butunKolonlar: true,
      }),
    ]);

    await expect(
      yaz(AYSE, yetki, async (islem) => {
        await kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', AYSE, {
          gorunenAd: 'Ayşe Nur',
        });
        await kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', CEM, {
          gorunenAd: 'Cem Can',
        });
      }),
    ).rejects.toMatchObject({ kod: 'bulunamadi' });

    expect((await kisiSatiri(AYSE))?.gorunen_ad).toBe('Ayşe');
    expect((await kisiSatiri(CEM))?.gorunen_ad).toBe('Cem');
    expect(await notlar()).toEqual([]);
  });

  it('g) not: güncellemede yalnız değişen kolonlar eski ve yeni değeriyle, oluşturmada yeni hâl, silmede eski hâl; yazan, üyelik, yetenek ve işin adı doludur', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({ eylem: 'olustur', butunKayitlar: true, butunKolonlar: true }),
      yetenek({
        yetenekId: Y2,
        eylem: 'guncelle',
        butunKayitlar: true,
        butunKolonlar: true,
      }),
      yetenek({
        yetenekId: Y3,
        eylem: 'sil',
        butunKayitlar: true,
        butunKolonlar: true,
      }),
    ]);

    const { id, istekKimligi } = await istekte(AYSE, yetki, async () => {
      const yeniId = await uow.run((islem) =>
        kapi.olustur(islem, 'kullanici.ac', 'Kullanici', {
          kullaniciAdi: 'fatma',
          gorunenAd: 'Fatma',
          telefon: undefined,
        }),
      );
      await uow.run((islem) =>
        kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', yeniId, {
          kullaniciAdi: 'fatma',
          gorunenAd: 'Fatma Nur',
          telefon: null,
        }),
      );
      await uow.run((islem) =>
        kapi.sil(islem, 'kullanici.sil', 'Kullanici', yeniId),
      );
      return { id: yeniId, istekKimligi: istekBaglami().istekKimligi };
    });

    const ortak = {
      istek_id: istekKimligi,
      kullanici_id: AYSE,
      uyelik_id: UY_A,
      baslatan_kullanici_id: null,
      veri_sahibi_kullanici_id: null,
      kaynak: 'Kullanici',
      kayit_id: id,
    };
    const [olusturma, guncelleme, silme, ...fazla] = await notlar();
    expect(fazla).toEqual([]);
    const olusturmaZamani = (
      olusturma?.['degisen'] as Record<string, { yeni: unknown }> | undefined
    )?.['olusturma_zamani']?.yeni;
    expect(typeof olusturmaZamani).toBe('string');
    expect(olusturma).toEqual({
      ...ortak,
      yetenek_id: Y1,
      is_adi: 'kullanici.ac',
      eylem: 'olusturma',
      degisen: {
        id: { yeni: id },
        kullanici_adi: { yeni: 'fatma' },
        telefon: { yeni: null },
        gorunen_ad: { yeni: 'Fatma' },
        sistem_aktoru: { yeni: false },
        yetki_surumu: { yeni: 0 },
        pasif_zamani: { yeni: null },
        unutulma_zamani: { yeni: null },
        olusturma_zamani: { yeni: olusturmaZamani },
      },
    });
    expect(guncelleme).toEqual({
      ...ortak,
      yetenek_id: Y2,
      is_adi: 'kullanici.guncelle',
      eylem: 'guncelleme',
      degisen: { gorunen_ad: { eski: 'Fatma', yeni: 'Fatma Nur' } },
    });
    expect(silme).toEqual({
      ...ortak,
      yetenek_id: Y3,
      is_adi: 'kullanici.sil',
      eylem: 'silme',
      degisen: {
        id: { eski: id },
        kullanici_adi: { eski: 'fatma' },
        telefon: { eski: null },
        gorunen_ad: { eski: 'Fatma Nur' },
        sistem_aktoru: { eski: false },
        yetki_surumu: { eski: 0 },
        pasif_zamani: { eski: null },
        unutulma_zamani: { eski: null },
        olusturma_zamani: { eski: olusturmaZamani },
      },
    });
  });

  describe('h) satır kilidi', () => {
    it('eşzamanlı iki güncellemenin ikisi de yazılır ve notlardaki eski değerler zincir oluşturur', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ butunKayitlar: true, butunKolonlar: true }),
      ]);
      let birinciYazdi = (): void => undefined;
      const yazildi = new Promise<void>((coz) => {
        birinciYazdi = coz;
      });

      // Birinci iş yazdıktan sonra, ikinci iş aynı satırın kilidinde bekleyene dek işlemini açık
      // tutar. Kilitsiz okumada ikinci iş eski değeri birincinin işlemi bitmeden okurdu.
      const birinci = yaz(AYSE, yetki, async (islem) => {
        await kapi.guncelle(islem, 'birinci', 'Kullanici', DENIZ, {
          gorunenAd: 'Deniz 1',
        });
        birinciYazdi();
        await kilitBekleyeniBekle();
      });
      await yazildi;
      const ikinci = yaz(AYSE, yetki, (islem) =>
        kapi.guncelle(islem, 'ikinci', 'Kullanici', DENIZ, {
          gorunenAd: 'Deniz 2',
        }),
      );
      await Promise.all([birinci, ikinci]);

      expect((await kisiSatiri(DENIZ))?.gorunen_ad).toBe('Deniz 2');
      const zincir = (await notlar()).map((n) => [
        n['is_adi'],
        n['degisen'],
      ]);
      expect(zincir).toEqual([
        ['birinci', { gorunen_ad: { eski: 'Deniz', yeni: 'Deniz 1' } }],
        ['ikinci', { gorunen_ad: { eski: 'Deniz 1', yeni: 'Deniz 2' } }],
      ]);
    });

    it('eski hâl okunurken satır anahtar dışı güncelleme kilidiyle kilitlidir: tam satır kilidi alınamaz, anahtar paylaşım kilidi alınabilir', async () => {
      const yetki = await yetkiAl(AYSE, [AYSE_A], [
        yetenek({ butunKayitlar: true, butunKolonlar: true }),
      ]);

      // Değer değiştirmeyen güncelleme: yalnız kilit alınır, değeri yazan deyim gitmez.
      const gozlem = await yaz(AYSE, yetki, async (islem) => {
        await kapi.guncelle(islem, 'kilit', 'Kullanici', ECE, {
          gorunenAd: 'Ece',
        });
        return {
          forUpdate: await dene(ECE, 'for update'),
          forKeyShare: await dene(ECE, 'for key share'),
        };
      });

      expect(gozlem).toEqual({ forUpdate: 'kilitli', forKeyShare: 'serbest' });
      const guncellemeler = sorgular.filter((s) => s.startsWith('UPDATE'));
      expect(guncellemeler).toHaveLength(1);
      expect(guncellemeler[0]).toMatch(
        /^UPDATE "public"\."kullanici" SET "id" = \$1 WHERE/,
      );
      expect((await notlar()).map((n) => n['degisen'])).toEqual([{}]);
    });
  });

  it('i) hiç yazma kuralı olmayan kişinin yazması bulunamadi ya da yetki_yok döner ve hiçbir şey yazılmaz', async () => {
    const kuralsiz = await yetkiAl(AYSE, [AYSE_A], []);
    const yalnizOkur = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({ eylem: 'oku', butunKayitlar: true, butunKolonlar: true }),
    ]);

    for (const yetki of [kuralsiz, yalnizOkur]) {
      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', AYSE, {
            gorunenAd: 'Ayşe Nur',
          }),
        ),
      ).rejects.toMatchObject({ kod: 'bulunamadi' });
      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.niyet(
            islem,
            'kullanici.pasife_al',
            'Kullanici',
            'pasife_al',
            AYSE,
            { pasifZamani: new Date() },
          ),
        ),
      ).rejects.toMatchObject({ kod: 'bulunamadi' });
      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.sil(islem, 'uyelik.kaldir', 'Uyelik', UY_A),
        ),
      ).rejects.toMatchObject({ kod: 'bulunamadi' });
      await expect(
        yaz(AYSE, yetki, (islem) =>
          kapi.olustur(islem, 'kullanici.ac', 'Kullanici', {
            gorunenAd: 'Fatma',
          }),
        ),
      ).rejects.toMatchObject({ kod: 'yetki_yok' });
    }

    expect(await kisiSatiri(AYSE)).toMatchObject({
      gorunen_ad: 'Ayşe',
      pasif_zamani: null,
    });
    expect((await uyelikSatiri(UY_A))?.silinme_zamani).toBeNull();
    expect(await kisiSayisi()).toBe(KISILER.length);
    expect(sorgular.filter((s) => s.startsWith('INSERT'))).toEqual([]);
    expect(await notlar()).toEqual([]);
  });

  it('niyet eylemi: şart yalnız önceki hâle bakar, kolon sınırı aranmaz ve sistemin yazdığı alan yazılabilir', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({
        eylem: 'pasife_al',
        sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Ece' }],
        kolonlar: ['kullaniciAdi'],
      }),
    ]);
    const pasifeAl = (): Promise<void> =>
      yaz(AYSE, yetki, (islem) =>
        kapi.niyet(
          islem,
          'kullanici.pasife_al',
          'Kullanici',
          'pasife_al',
          ECE,
          { gorunenAd: 'Ece (pasif)', pasifZamani: new Date() },
        ),
      );

    await pasifeAl();
    const satir = await kisiSatiri(ECE);
    expect(satir?.gorunen_ad).toBe('Ece (pasif)');
    expect(satir?.pasif_zamani).toBeInstanceOf(Date);
    expect(await notlar()).toEqual([
      expect.objectContaining({
        eylem: 'guncelleme',
        is_adi: 'kullanici.pasife_al',
        degisen: {
          gorunen_ad: { eski: 'Ece', yeni: 'Ece (pasif)' },
          pasif_zamani: {
            eski: null,
            yeni: satir?.pasif_zamani?.toISOString(),
          },
        },
      }),
    ]);

    // Önceki hâl artık şartı tutmaz.
    await expect(pasifeAl()).rejects.toMatchObject({ kod: 'bulunamadi' });
    // Düz eylemler niyet yolundan yazılamaz: kolon sınırı ve iki hâl kuralı atlanmasın.
    await expect(
      yaz(AYSE, yetki, (islem) =>
        kapi.niyet(islem, 'kullanici.guncelle', 'Kullanici', 'guncelle', ECE, {
          gorunenAd: 'Ece',
        }),
      ),
    ).rejects.toThrow('Niyet eylemi değil: guncelle');
  });

  it('kapı yalnız katalogdaki kaynak ve alanlarla çalışır', async () => {
    const yetki = await yetkiAl(AYSE, [AYSE_A], [
      yetenek({ butunKayitlar: true, butunKolonlar: true }),
    ]);

    await expect(
      yaz(AYSE, yetki, (islem) =>
        kapi.guncelle(islem, 'grup.guncelle', 'Grup', G_A, { ad: 'A' }),
      ),
    ).rejects.toThrow('Kaynak kataloğunda olmayan kaynak: Grup');
    await expect(
      yaz(AYSE, yetki, (islem) =>
        kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', AYSE, {
          parolaOzeti: 'x',
        }),
      ),
    ).rejects.toThrow('Bilinmeyen alan: parolaOzeti');
    expect(await notlar()).toEqual([]);
  });
});
