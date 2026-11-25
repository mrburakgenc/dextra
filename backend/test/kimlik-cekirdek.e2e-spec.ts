// Kimlik çekirdeği (GV-026): çekirdek repository'ler ve parçalar, göçleri uygulanmış geçici bir
// veritabanında, uygulamanın KimlikModule'üyle kurulmuş Unit of Work üzerinden sınanır. Başlangıç
// satırları her testten önce SQL ile yeniden yazılır; satırlar ve notlar ayrı bir bağlantıdan okunur.
import { randomUUIDv7 } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { GenelSayac } from '../src/features/kimlik/_shared/application/genel-sayac.js';
import type { IzBilgisi } from '../src/features/kimlik/_shared/application/iz.js';
import { KisiKilidi } from '../src/features/kimlik/_shared/application/kisi-kilidi.js';
import { KisininSayisi } from '../src/features/kimlik/_shared/application/kisinin-sayisi.js';
import { KokUyelik } from '../src/features/kimlik/_shared/application/kok-uyelik.js';
import { TohumYardimcisi } from '../src/features/kimlik/_shared/application/tohum-yardimcisi.js';
import { KIMLIK_KAYNAKLARI } from '../src/features/kimlik/_shared/application/yetki-verisi.js';
import { KimlikModule } from '../src/features/kimlik/kimlik.module.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { PRISMA_CLIENT } from '../src/shared/database/istemci-belirtecleri.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { prismaKaynakKatalogu } from '../src/shared/yetki/infrastructure/prisma-kaynak-katalogu.js';
import { YetkiModule } from '../src/shared/yetki/yetki.module.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

const KOK_GRUP = '10000000-0000-4000-8000-000000000001';
const ALT_GRUP = '10000000-0000-4000-8000-000000000002';
const TEMEL_ROL = '20000000-0000-4000-8000-000000000001';
const SUPERADMIN_ROL = '20000000-0000-4000-8000-000000000002';
const AYSE = '30000000-0000-4000-8000-000000000001';
const MEHMET = '30000000-0000-4000-8000-000000000002';
// Notların yazanı: kimliğin sistem aktörü (AK-2).
const SISTEM_AKTORU = '30000000-0000-4000-8000-000000000003';

const IZ: IzBilgisi = { yazanId: SISTEM_AKTORU, isAdi: 'test:kimlik-cekirdek' };

// Genel sayaç 5'ten, Ayşe'nin sayısı 3'ten başlar.
const BASLANGIC = `
  truncate outbox_iz, outbox_olay, oturum_sirri, oturum, uyelik, yetenek, parola_baglantisi,
           kullanici_sirri, kullanici, grup, rol, izin, yetki_surumu;
  insert into yetki_surumu (id, sayac) values (1, 5);
  insert into grup (id, ust_grup_id, ad) values ('${KOK_GRUP}', null, 'Kök'),
                                                ('${ALT_GRUP}', '${KOK_GRUP}', 'Alt');
  insert into rol (id, kod, ad) values ('${TEMEL_ROL}', 'temel', 'Temel'),
                                       ('${SUPERADMIN_ROL}', 'superadmin', 'SuperAdmin');
  insert into kullanici (id, kullanici_adi, gorunen_ad, sistem_aktoru, yetki_surumu)
  values ('${AYSE}', 'ayse', 'Ayşe', false, 3),
         ('${MEHMET}', 'mehmet', 'Mehmet', false, 0),
         ('${SISTEM_AKTORU}', null, 'kimlik', true, 0);
`;

interface OturumSatiri {
  id: string;
  kullanici_id: string;
  kapatilma_zamani: Date | null;
  kapatilma_nedeni: string | null;
}

interface UyelikSatiri {
  id: string;
  kullanici_id: string;
  grup_id: string;
  rol_id: string;
  silinme_zamani: Date | null;
}

type Not = Record<string, unknown>;

let db: TestDatabase;
let prisma: PrismaClient;
let moduleRef: TestingModule;
let gozlemci: pg.Client;
let uow: UnitOfWork;
let genelSayac: GenelSayac;
let kisininSayisi: KisininSayisi;
let kisiKilidi: KisiKilidi;
let kokUyelik: KokUyelik;
let tohum: TohumYardimcisi;

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await gozlemci.query<T>(sql, degerler)).rows;
}

async function genelSayacDegeri(): Promise<number | undefined> {
  const [satir] = await satirlar<{ sayac: number }>(
    'select sayac from yetki_surumu where id = 1',
  );
  return satir?.sayac;
}

async function kisininSayisiDegeri(id: string): Promise<number | undefined> {
  const [satir] = await satirlar<{ yetki_surumu: number }>(
    'select yetki_surumu from kullanici where id = $1',
    [id],
  );
  return satir?.yetki_surumu;
}

async function oturumlar(): Promise<OturumSatiri[]> {
  return satirlar<OturumSatiri>(
    'select id, kullanici_id, kapatilma_zamani, kapatilma_nedeni from oturum order by id',
  );
}

async function uyelikler(kullaniciId: string): Promise<UyelikSatiri[]> {
  return satirlar<UyelikSatiri>(
    'select id, kullanici_id, grup_id, rol_id, silinme_zamani from uyelik where kullanici_id = $1 order by id',
    [kullaniciId],
  );
}

async function notlar(): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      'select govde from outbox_iz order by olusturma_zamani',
    )
  ).map((s) => s.govde);
}

async function oturumEkle(
  id: string,
  kullaniciId: string,
  kapali?: { neden: string; zaman: string },
): Promise<void> {
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi, kapatilma_zamani, kapatilma_nedeni)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(),
             '127.0.0.1', 'deneme', $3, $4)`,
    [id, kullaniciId, kapali?.zaman ?? null, kapali?.neden ?? null],
  );
}

async function uyelikEkle(
  kullaniciId: string,
  grupId: string,
  rolId: string,
  silinmeZamani: string | null = null,
): Promise<string> {
  const id = randomUUIDv7();
  await gozlemci.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id, silinme_zamani) values ($1, $2, $3, $4, $5)',
    [id, kullaniciId, grupId, rolId, silinmeZamani],
  );
  return id;
}

// Dışarıdan çözülen söz; bir işlemi kilidi tutarken bekletmek için.
function ertele(): { soz: Promise<void>; coz: () => void } {
  let coz = (): void => undefined;
  const soz = new Promise<void>((r) => {
    coz = r;
  });
  return { soz, coz };
}

// Bu veritabanında bir satır kilidini bekleyen oturum görünene kadar bekler.
async function kilitBekleyeniGor(): Promise<void> {
  const son = Date.now() + 3000;
  while (Date.now() < son) {
    const [satir] = await satirlar<{ sayi: number }>(
      `select count(*)::int as sayi from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if ((satir?.sayi ?? 0) > 0) {
      return;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('kilit bekleyen işlem görülmedi');
}

// İlk işlem kilidi alıp tutar; ikinci işlem aynı kilidi ister. İkincinin ancak ilki bitince
// ilerlediği, olayların sırasıyla gösterilir.
async function ikinciIlkiBekler(
  kilitle: (
    islem: Parameters<Parameters<UnitOfWork['run']>[0]>[0],
  ) => Promise<void>,
  kilitTutulurken: () => Promise<void> = () => Promise.resolve(),
): Promise<string[]> {
  const sira: string[] = [];
  const kilitlendi = ertele();
  const birak = ertele();
  const ilk = uow.run(async (islem) => {
    await kilitle(islem);
    kilitlendi.coz();
    await birak.soz;
  });
  try {
    await kilitlendi.soz;
    await kilitTutulurken();
    const ikinci = uow.run(async (islem) => {
      await kilitle(islem);
      sira.push('ikinci kilitledi');
    });
    await kilitBekleyeniGor();
    sira.push('ilk bitiyor');
    birak.coz();
    await ilk;
    await ikinci;
  } finally {
    birak.coz();
  }
  return sira;
}

beforeAll(async () => {
  db = await createTestDatabase([], { migrations: true });
  try {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: db.url }),
    });
    // Çekirdek repository'leri Unit of Work'e KimlikModule'ün kendi kaydı tanıtır. Kapıları sağlayan
    // ortak modül kök modüldeki gibi kimlik kaynaklarının kataloğuyla kurulur (TS-002 AK-42 eki).
    moduleRef = await Test.createTestingModule({
      imports: [
        KimlikModule,
        YetkiModule.forRoot(prismaKaynakKatalogu(KIMLIK_KAYNAKLARI)),
      ],
    })
      .overrideProvider(PRISMA_CLIENT)
      .useValue(prisma)
      .compile();
    uow = moduleRef.get(UnitOfWork);
    genelSayac = moduleRef.get(GenelSayac);
    kisininSayisi = moduleRef.get(KisininSayisi);
    kisiKilidi = moduleRef.get(KisiKilidi);
    kokUyelik = moduleRef.get(KokUyelik);
    tohum = moduleRef.get(TohumYardimcisi);
    gozlemci = new pg.Client({ connectionString: db.url });
    await gozlemci.connect();
  } catch (error) {
    await db.drop();
    throw error;
  }
});

afterAll(async () => {
  await gozlemci.end();
  // Modülün kapanışı asıl istemciyi (burada test veritabanınınkini) kapatır.
  await moduleRef.close();
  await db.drop();
});

beforeEach(async () => {
  await gozlemci.query(BASLANGIC);
});

describe('a) genel sayaç', () => {
  it('satır yokken kilitleme hata verir', async () => {
    await gozlemci.query('delete from yetki_surumu');

    await expect(
      uow.run((islem) => genelSayac.kilitle(islem, { artir: false })),
    ).rejects.toMatchObject({ code: 'P2025' });
  });

  it('kilit tutulurken ikinci işlemin kilidi ancak ilki bitince alınır; kip anahtar dışı güncelleme kilididir', async () => {
    const sira = await ikinciIlkiBekler(
      (islem) => genelSayac.kilitle(islem, { artir: false }),
      async () => {
        // Kip: tam satır kilidiyle çakışır, anahtar paylaşım kilidiyle çakışmaz.
        await gozlemci.query('begin');
        try {
          await expect(
            gozlemci.query(
              'select 1 from yetki_surumu where id = 1 for update nowait',
            ),
          ).rejects.toMatchObject({ code: '55P03' });
        } finally {
          await gozlemci.query('rollback');
        }
        await gozlemci.query('begin');
        try {
          await gozlemci.query(
            'select 1 from yetki_surumu where id = 1 for key share nowait',
          );
        } finally {
          await gozlemci.query('rollback');
        }
      },
    );

    expect(sira).toEqual(['ilk bitiyor', 'ikinci kilitledi']);
  });

  it('artırma değeri bir artırır; artırmasız kilit değeri değiştirmez', async () => {
    await uow.run((islem) => genelSayac.kilitle(islem, { artir: true }));
    expect(await genelSayacDegeri()).toBe(6);

    await uow.run((islem) => genelSayac.kilitle(islem, { artir: false }));
    expect(await genelSayacDegeri()).toBe(6);
  });
});

describe('b) kişi kilidi', () => {
  it('kilit tutulurken kişiye yabancı anahtar veren oturum satırı başka işlemden beklemeden eklenir; aynı kişiyi kilitleyen ikinci işlem bekler', async () => {
    const yeniOturum = randomUUIDv7();

    const sira = await ikinciIlkiBekler(
      (islem) => kisiKilidi.kilitle(islem, AYSE),
      async () => {
        // Beklemesi gerekseydi kısa kilit süresi dolar ve ekleme 55P03 ile düşerdi.
        await gozlemci.query('begin');
        try {
          await gozlemci.query("set local lock_timeout = '500ms'");
          await oturumEkle(yeniOturum, AYSE);
          await gozlemci.query('commit');
        } catch (error) {
          await gozlemci.query('rollback');
          throw error;
        }
      },
    );

    expect(sira).toEqual(['ilk bitiyor', 'ikinci kilitledi']);
    expect((await oturumlar()).map((o) => o.id)).toEqual([yeniOturum]);
  });

  it('karşı test: başka kişinin kilidi beklenmez', async () => {
    const kilitlendi = ertele();
    const birak = ertele();
    const ilk = uow.run(async (islem) => {
      await kisiKilidi.kilitle(islem, AYSE);
      kilitlendi.coz();
      await birak.soz;
    });
    try {
      await kilitlendi.soz;
      await uow.run((islem) => kisiKilidi.kilitle(islem, MEHMET));
    } finally {
      birak.coz();
      await ilk;
    }
  });

  it('kapatmasız kilit veri yazmaz ve not bırakmaz', async () => {
    await oturumEkle(randomUUIDv7(), AYSE);

    await uow.run((islem) => kisiKilidi.kilitle(islem, AYSE));

    expect((await oturumlar())[0]?.kapatilma_zamani).toBeNull();
    expect(await kisininSayisiDegeri(AYSE)).toBe(3);
    expect(await notlar()).toEqual([]);
  });
});

describe('c) toplu kapatma', () => {
  const ACIK_1 = '40000000-0000-4000-8000-000000000001';
  const ACIK_2 = '40000000-0000-4000-8000-000000000002';
  const KAPALI = '40000000-0000-4000-8000-000000000003';
  const BASKASI = '40000000-0000-4000-8000-000000000004';
  const ESKI_ZAMAN = new Date('2026-01-01T00:00:00Z');

  beforeEach(async () => {
    await oturumEkle(ACIK_1, AYSE);
    await oturumEkle(ACIK_2, AYSE);
    await oturumEkle(KAPALI, AYSE, {
      neden: 'cikis',
      zaman: ESKI_ZAMAN.toISOString(),
    });
    await oturumEkle(BASKASI, MEHMET);
  });

  it('kişinin kapatılmamış oturumlarının hepsi verilen nedenle ve aynı zamanla kapanır; kapalı olan ve başkasınınki değişmez', async () => {
    // Kapatılma zamanını uygulama saati yazar (TS-002 AK-21); aralık da onunla ölçülür.
    const once = new Date();
    await uow.run((islem) =>
      kisiKilidi.kilitle(islem, AYSE, { neden: 'pasife_alma', iz: IZ }),
    );
    const sonra = new Date();

    const satir = new Map((await oturumlar()).map((o) => [o.id, o]));
    const acik1 = satir.get(ACIK_1);
    const acik2 = satir.get(ACIK_2);
    expect(acik1?.kapatilma_nedeni).toBe('pasife_alma');
    expect(acik2?.kapatilma_nedeni).toBe('pasife_alma');
    expect(acik1?.kapatilma_zamani).toEqual(acik2?.kapatilma_zamani);
    const zaman = acik1?.kapatilma_zamani?.getTime() ?? 0;
    expect(zaman).toBeGreaterThanOrEqual(once.getTime());
    expect(zaman).toBeLessThanOrEqual(sonra.getTime());
    expect(satir.get(KAPALI)).toMatchObject({
      kapatilma_nedeni: 'cikis',
      kapatilma_zamani: ESKI_ZAMAN,
    });
    expect(satir.get(BASKASI)).toMatchObject({
      kapatilma_nedeni: null,
      kapatilma_zamani: null,
    });
  });
});

describe('d) kişinin sayısı', () => {
  it('kişinin sayısı bir artar, genel sayaç değişmez', async () => {
    await uow.run((islem) => kisininSayisi.artir(islem, AYSE, IZ));

    expect(await kisininSayisiDegeri(AYSE)).toBe(4);
    expect(await kisininSayisiDegeri(MEHMET)).toBe(0);
    expect(await genelSayacDegeri()).toBe(5);
  });

  it('genel sayaç başka işlemde tam satır kilidiyle tutulurken de beklemeden artar (genel sayacı kilitlemez)', async () => {
    await gozlemci.query('begin');
    try {
      await gozlemci.query(
        'select 1 from yetki_surumu where id = 1 for update',
      );
      await uow.run((islem) => kisininSayisi.artir(islem, AYSE, IZ));
    } finally {
      await gozlemci.query('rollback');
    }

    expect(await kisininSayisiDegeri(AYSE)).toBe(4);
  });
});

describe('e) kök üyelik', () => {
  it('kişiye (kök grup, temel rol) üyeliği yazılır', async () => {
    await uow.run((islem) => kokUyelik.yaz(islem, AYSE, IZ));

    expect(await uyelikler(AYSE)).toEqual([
      expect.objectContaining({
        kullanici_id: AYSE,
        grup_id: KOK_GRUP,
        rol_id: TEMEL_ROL,
        silinme_zamani: null,
      }),
    ]);
  });

  it('aynı kişi için ikinci yazım tekil kısıtla (P2002; hata süzgecinde cakisma) reddedilir', async () => {
    await uow.run((islem) => kokUyelik.yaz(islem, AYSE, IZ));

    await expect(
      uow.run((islem) => kokUyelik.yaz(islem, AYSE, IZ)),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await uyelikler(AYSE)).toHaveLength(1);
  });

  it('kapatma kişinin bütün canlı üyeliklerine aynı silinme zamanını yazar; silinmiş olan ve başkasınınki değişmez', async () => {
    const kok = await uyelikEkle(AYSE, KOK_GRUP, TEMEL_ROL);
    const alt = await uyelikEkle(AYSE, ALT_GRUP, SUPERADMIN_ROL);
    const silinmis = await uyelikEkle(
      AYSE,
      ALT_GRUP,
      TEMEL_ROL,
      '2026-01-01T00:00:00Z',
    );
    await uyelikEkle(MEHMET, KOK_GRUP, TEMEL_ROL);

    // Silinme zamanını uygulama saati yazar (TS-002 AK-21); aralık da onunla ölçülür.
    const once = new Date();
    await uow.run((islem) => kokUyelik.kapat(islem, AYSE, IZ));
    const sonra = new Date();

    const satir = new Map((await uyelikler(AYSE)).map((u) => [u.id, u]));
    const zaman = satir.get(kok)?.silinme_zamani;
    expect(satir.get(alt)?.silinme_zamani).toEqual(zaman);
    expect(zaman?.getTime()).toBeGreaterThanOrEqual(once.getTime());
    expect(zaman?.getTime()).toBeLessThanOrEqual(sonra.getTime());
    expect(satir.get(silinmis)?.silinme_zamani).toEqual(
      new Date('2026-01-01T00:00:00Z'),
    );
    expect((await uyelikler(MEHMET))[0]?.silinme_zamani).toBeNull();
  });
});

describe('f) tohum yardımcısı', () => {
  it('kullanıcı, kök üyelik ve verilen üyelik yazılır; kişinin sayısı ve genel sayaç artar', async () => {
    const id = randomUUIDv7();

    await uow.run((islem) =>
      tohum.yaz(
        islem,
        {
          id,
          kullaniciAdi: 'superadmin',
          telefon: null,
          gorunenAd: 'Sistem Yöneticisi',
          sistemAktoru: false,
          uyelikler: [{ grupId: KOK_GRUP, rolId: SUPERADMIN_ROL }],
        },
        IZ,
      ),
    );

    expect(
      await satirlar(
        'select kullanici_adi, gorunen_ad, sistem_aktoru, yetki_surumu from kullanici where id = $1',
        [id],
      ),
    ).toEqual([
      {
        kullanici_adi: 'superadmin',
        gorunen_ad: 'Sistem Yöneticisi',
        sistem_aktoru: false,
        yetki_surumu: 1,
      },
    ]);
    const kumeler = (await uyelikler(id)).map((u) => [u.grup_id, u.rol_id]);
    expect(kumeler).toHaveLength(2);
    expect(kumeler).toEqual(
      expect.arrayContaining([
        [KOK_GRUP, TEMEL_ROL],
        [KOK_GRUP, SUPERADMIN_ROL],
      ]),
    );
    expect(await genelSayacDegeri()).toBe(6);
  });

  it('sistem aktöründe kök üyelik yazılmaz; sayılar yine artar', async () => {
    const id = randomUUIDv7();

    await uow.run((islem) =>
      tohum.yaz(
        islem,
        {
          id,
          kullaniciAdi: null,
          telefon: null,
          gorunenAd: 'bildirim',
          sistemAktoru: true,
          uyelikler: [],
        },
        IZ,
      ),
    );

    expect(await kisininSayisiDegeri(id)).toBe(1);
    expect(await uyelikler(id)).toEqual([]);
    expect(await genelSayacDegeri()).toBe(6);
  });

  it('giriş bilgisi zaten varsa hata verir ve hiçbir şey yazılmaz', async () => {
    const id = randomUUIDv7();

    await expect(
      uow.run((islem) =>
        tohum.yaz(
          islem,
          {
            id,
            kullaniciAdi: 'ayse',
            telefon: null,
            gorunenAd: 'İkinci Ayşe',
            sistemAktoru: false,
            uyelikler: [],
          },
          IZ,
        ),
      ),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await genelSayacDegeri()).toBe(5);
    expect(await notlar()).toEqual([]);
  });
});

describe('g) iz', () => {
  // Her notun ortak alanları: işin adı, yazan, kaynak, kayıt ve eylem; çekirdek yolda yetenek ve
  // üyelik yoktur.
  function beklenenNot(
    kaynak: string,
    kayitId: string,
    eylem: string,
    veriSahibi: string,
  ): Not {
    return {
      is_adi: IZ.isAdi,
      kullanici_id: SISTEM_AKTORU,
      kaynak,
      kayit_id: kayitId,
      eylem,
      veri_sahibi_kullanici_id: veriSahibi,
      yetenek_id: null,
      uyelik_id: null,
    };
  }

  it('toplu kapatma: kapanan her oturum için bir not; kapalı oturum için not yok', async () => {
    const acik = randomUUIDv7();
    await oturumEkle(acik, AYSE);
    await oturumEkle(randomUUIDv7(), AYSE, {
      neden: 'cikis',
      zaman: '2026-01-01T00:00:00Z',
    });

    await uow.run((islem) =>
      kisiKilidi.kilitle(islem, AYSE, { neden: 'unutma', iz: IZ }),
    );

    const [oturum] = await oturumlar().then((s) =>
      s.filter((o) => o.id === acik),
    );
    expect(await notlar()).toEqual([
      {
        ...beklenenNot('Oturum', acik, 'guncelleme', AYSE),
        istek_id: null,
        baslatan_kullanici_id: null,
        degisen: {
          kapatilma_zamani: {
            eski: null,
            yeni: oturum?.kapatilma_zamani?.toISOString(),
          },
          kapatilma_nedeni: { eski: null, yeni: 'unutma' },
        },
      },
    ]);
  });

  it('kişinin sayısı: kişinin satırı için bir güncelleme notu', async () => {
    await uow.run((islem) => kisininSayisi.artir(islem, AYSE, IZ));

    expect(await notlar()).toEqual([
      expect.objectContaining({
        ...beklenenNot('Kullanici', AYSE, 'guncelleme', AYSE),
        degisen: { yetki_surumu: { eski: 3, yeni: 4 } },
      }),
    ]);
  });

  it('kök üyelik: yazılan üyelik için bir oluşturma notu, kapatılan her üyelik için bir güncelleme notu', async () => {
    await uow.run((islem) => kokUyelik.yaz(islem, AYSE, IZ));
    const [uyelik] = await uyelikler(AYSE);
    const alt = await uyelikEkle(AYSE, ALT_GRUP, TEMEL_ROL);
    await uow.run((islem) => kokUyelik.kapat(islem, AYSE, IZ));

    const yazilan = await notlar();
    expect(yazilan).toHaveLength(3);
    expect(yazilan[0]).toMatchObject({
      ...beklenenNot('Uyelik', uyelik?.id ?? '', 'olusturma', AYSE),
      degisen: {
        kullanici_id: { yeni: AYSE },
        grup_id: { yeni: KOK_GRUP },
        rol_id: { yeni: TEMEL_ROL },
      },
    });
    const kapatmaNotlari = yazilan.slice(1);
    expect(kapatmaNotlari.map((n) => n['kayit_id']).sort()).toEqual(
      [uyelik?.id, alt].sort(),
    );
    const silinmeZamanlari = new Map(
      (await uyelikler(AYSE)).map((u) => [
        u.id,
        u.silinme_zamani?.toISOString(),
      ]),
    );
    for (const not of kapatmaNotlari) {
      const kayitId = String(not['kayit_id']);
      expect(not).toMatchObject({
        ...beklenenNot('Uyelik', kayitId, 'guncelleme', AYSE),
        degisen: {
          silinme_zamani: { eski: null, yeni: silinmeZamanlari.get(kayitId) },
        },
      });
    }
  });

  it('tohum: kullanıcının oluşturulması, sayısının artması ve iki üyelik için birer not', async () => {
    const id = randomUUIDv7();
    await uow.run((islem) =>
      tohum.yaz(
        islem,
        {
          id,
          kullaniciAdi: 'superadmin',
          telefon: null,
          gorunenAd: 'Sistem Yöneticisi',
          sistemAktoru: false,
          uyelikler: [{ grupId: KOK_GRUP, rolId: SUPERADMIN_ROL }],
        },
        IZ,
      ),
    );
    const uyelikIdleri = (await uyelikler(id)).map((u) => u.id);

    const yazilan = await notlar();
    const kullaniciNotlari = yazilan.filter((n) => n['kaynak'] === 'Kullanici');
    expect(kullaniciNotlari).toHaveLength(2);
    expect(kullaniciNotlari[0]).toMatchObject({
      ...beklenenNot('Kullanici', id, 'olusturma', id),
      degisen: {
        kullanici_adi: { yeni: 'superadmin' },
        telefon: { yeni: null },
        gorunen_ad: { yeni: 'Sistem Yöneticisi' },
        sistem_aktoru: { yeni: false },
        yetki_surumu: { yeni: 0 },
      },
    });
    expect(kullaniciNotlari[1]).toMatchObject({
      ...beklenenNot('Kullanici', id, 'guncelleme', id),
      degisen: { yetki_surumu: { eski: 0, yeni: 1 } },
    });
    const uyelikNotlari = yazilan.filter((n) => n['kaynak'] === 'Uyelik');
    expect(uyelikNotlari.map((n) => n['kayit_id']).sort()).toEqual(
      uyelikIdleri.sort(),
    );
    for (const not of uyelikNotlari) {
      expect(not).toMatchObject(
        beklenenNot('Uyelik', String(not['kayit_id']), 'olusturma', id),
      );
    }
  });
});

describe('h) geri alma', () => {
  it('hata atan işten sonra ne veri ne not kalır', async () => {
    const oturum = randomUUIDv7();
    await oturumEkle(oturum, AYSE);
    const yeni = randomUUIDv7();

    await expect(
      uow.run(async (islem) => {
        await genelSayac.kilitle(islem, { artir: true });
        await kisiKilidi.kilitle(islem, AYSE, { neden: 'unutma', iz: IZ });
        await kisininSayisi.artir(islem, AYSE, IZ);
        await kokUyelik.yaz(islem, AYSE, IZ);
        await kokUyelik.kapat(islem, AYSE, IZ);
        await tohum.yaz(
          islem,
          {
            id: yeni,
            kullaniciAdi: 'yeni',
            telefon: null,
            gorunenAd: 'Yeni',
            sistemAktoru: false,
            uyelikler: [{ grupId: KOK_GRUP, rolId: SUPERADMIN_ROL }],
          },
          IZ,
        );
        throw new Error('iş geri alınsın');
      }),
    ).rejects.toThrow('iş geri alınsın');

    expect(await genelSayacDegeri()).toBe(5);
    expect(await kisininSayisiDegeri(AYSE)).toBe(3);
    expect((await oturumlar())[0]?.kapatilma_zamani).toBeNull();
    expect(await uyelikler(AYSE)).toEqual([]);
    expect(
      await satirlar('select id from kullanici where id = $1', [yeni]),
    ).toEqual([]);
    expect(await satirlar('select id from uyelik')).toEqual([]);
    expect(await notlar()).toEqual([]);
  });
});
