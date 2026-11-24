// Giriş ve çıkış (GV-030; TS-002 AK-6, AK-7, AK-9, AK-15, "İşlem sınırları"; KR-009 Seçim 10 ve 12,
// Kural 12 ve 13). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-giris.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ve yalnız kendisi işaretli bir sınama ucuyla, göçleri uygulanmış asıl ve iz
// geçici veritabanlarıyla açılır. Başlangıç gerçek yoldan kurulur: tohum koşucusu ilk kurulum göçünü
// uygular, kurulum komutunun işi superadmin için bağlantı üretir ve parola o bağlantıyla uçtan
// belirlenir. Pasif kişi ve giriş bilgisi verilmiş sistem aktörü, olağan yolla oluşamayacakları için
// SQL ile hazırlanır (aşağıda). Her testten önce oturum ve not satırları silinir; satırlar ayrı bir
// bağlantıdan (gözlemci) okunur. Belirteci ve adres imzasını test, e2e-setup'ın ortama koyduğu anahtar
// ve sırla üretir ya da doğrular.
import { createHash } from 'node:crypto';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ParolaBaglantisi } from '../src/features/kimlik/_shared/baglanti/parola-baglantisi.js';
import { KisiKilidi } from '../src/features/kimlik/_shared/kisi-kilidi.js';
import { KurulumBaglantisiHandler } from '../src/features/kimlik/parola/application/kurulum-baglantisi.handler.js';
import { ParolaGirisYontemi } from '../src/features/kimlik/parola/application/parola-giris-yontemi.js';
import { ParolaOzetleyici } from '../src/features/kimlik/parola/domain/parola-ozetleyici.port.js';
import { ARGON2ID_AYARLARI } from '../src/features/kimlik/parola/infrastructure/parola-ozetleyici.argon2id.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { BelirtecServisi } from '../src/shared/guvenlik/belirtec.js';
import { YalnizKendisi } from '../src/shared/guvenlik/isaretler.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/istemci-adresi-imzasi.js';
import {
  type IstekOturumu,
  istekBaglami,
} from '../src/shared/http/istek-baglami.js';
import { TohumKosucusu } from '../src/shared/tohum/tohum-kosucusu.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const PASIF = '50000000-0000-4000-8000-000000000001';
const PAROLA = 'dogru at pil zımba cümlesi';
const PASIF_PAROLA = 'pasif kisinin uzun parola cümlesi';
const AKTOR_PAROLA = 'sistem aktorunun uzun parola cümlesi';
const IP = '203.0.113.9';
const TARAYICI = 'Mozilla/5.0 giris deneme';
const GIRIS = '/kimlik/oturum/giris';
const CIKIS = '/kimlik/oturum/cikis';
const KENDISI = '/giris-sinama/kendisi';
const YEDI_GUN_MS = 7 * 24 * 60 * 60 * 1000;
// Başarısızlığın her türünde dönen tek cevap (AK-11 tablosu: kimlik_gerekli 401).
const RET_DURUMU = 401;
const RET_GOVDESI = {
  kod: 'kimlik_gerekli',
  ileti: 'Giriş yapılamadı',
  ayrinti: null,
};
const KIMLIK_GEREKLI = {
  kod: 'kimlik_gerekli',
  ileti: 'Kimlik doğrulanamadı',
  ayrinti: null,
};

interface GirisGovdesi {
  erisimBelirteci: string;
  yenilemeBelirteci: string;
  cihazSirri: string;
  oturumId: string;
}

interface OturumSatiri {
  id: string;
  kullanici_id: string;
  giris_yontemi: string;
  baslangic_zamani: Date;
  mutlak_bitis_zamani: Date;
  son_dondurme_zamani: Date;
  ip_adresi: string;
  tarayici_bilgisi: string;
  kapatilma_zamani: Date | null;
  kapatilma_nedeni: string | null;
}

interface SirSatiri {
  oturum_id: string;
  nesil: number;
  gecerli_yenileme_ozeti: string;
  onceki_yenileme_ozeti: string | null;
  cihaz_sirri_ozeti: string;
}

interface Not {
  kullanici_id: string;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

// Yalnız kendisi işaretli sınama ucu: guard'ın bağlama yazdığı oturumu döner.
@Controller('giris-sinama')
class GirisSinamaUcu {
  @Get('kendisi')
  @YalnizKendisi()
  kendisi(): IstekOturumu | undefined {
    return istekBaglami().oturum;
  }
}

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;
let superadmin: string;
let sistemAktoru: string;

function al<T>(tur: abstract new (...args: never[]) => T): T {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app.get(tur);
}

function sunucu(): App {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app.getHttpServer();
}

function ozeti(deger: string): string {
  return createHash('sha256').update(deger).digest('hex');
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await gozlemci.query<T>(sql, degerler)).rows;
}

// Aracı katmanın yaptığı gibi adresi, tarayıcı bilgisini ve zamanı ortak sırla imzalar.
function adresBasliklari(ip = IP, tarayici = TARAYICI): Record<string, string> {
  const zaman = Date.now();
  const imza = istemciImzasiUret(
    process.env[ARACI_KATMAN_SIRRI_DEGISKENI] ?? '',
    { adres: ip, tarayici, zaman },
  );
  return {
    [ISTEMCI_BASLIKLARI.adres]: ip,
    [ISTEMCI_BASLIKLARI.tarayici]: tarayici,
    [ISTEMCI_BASLIKLARI.zaman]: String(zaman),
    [ISTEMCI_BASLIKLARI.imza]: imza,
  };
}

function giris(
  kullaniciAdi: string,
  parola = PAROLA,
  basliklar = adresBasliklari(),
): request.Test {
  return request(sunucu())
    .post(GIRIS)
    .set(basliklar)
    .send({ kullaniciAdi, parola });
}

async function girisYap(kullaniciAdi = 'superadmin'): Promise<GirisGovdesi> {
  const cevap = await giris(kullaniciAdi);
  expect(cevap.status).toBe(200);
  return cevap.body as GirisGovdesi;
}

function kendisi(erisimBelirteci: string): request.Test {
  return request(sunucu())
    .get(KENDISI)
    .set(adresBasliklari())
    .set('authorization', `Bearer ${erisimBelirteci}`);
}

function cikis(erisimBelirteci: string): request.Test {
  return request(sunucu())
    .post(CIKIS)
    .set(adresBasliklari())
    .set('authorization', `Bearer ${erisimBelirteci}`);
}

function bagla(kod: string, parola: string): request.Test {
  return request(sunucu()).post('/kimlik/parola/belirle').send({ kod, parola });
}

function oturumlar(): Promise<OturumSatiri[]> {
  return satirlar<OturumSatiri>(
    `select id, kullanici_id, giris_yontemi, baslangic_zamani, mutlak_bitis_zamani,
            son_dondurme_zamani, ip_adresi, tarayici_bilgisi, kapatilma_zamani, kapatilma_nedeni
       from oturum order by baslangic_zamani, id`,
  );
}

async function notlar(): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      'select govde from outbox_iz order by olusturma_zamani',
    )
  ).map((s) => s.govde);
}

// Asıl veritabanının bütün tablolarında, satırın metin hâlinde verilen değeri içeren satır sayısı.
async function tablolardaGecenler(
  deger: string,
): Promise<{ tablo: string; sayi: number }[]> {
  const tablolar = await satirlar<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  expect(tablolar.length).toBeGreaterThan(10);
  const gecenler: { tablo: string; sayi: number }[] = [];
  for (const { table_name } of tablolar) {
    const [sayim] = await satirlar<{ sayi: number }>(
      `select count(*)::int as sayi from "${table_name}" t where position($1 in t::text) > 0`,
      [deger],
    );
    if ((sayim?.sayi ?? 0) > 0) {
      gecenler.push({ tablo: table_name, sayi: sayim?.sayi ?? 0 });
    }
  }
  return gecenler;
}

async function kalanVeritabanlari(adlar: readonly string[]): Promise<string[]> {
  const sunucuIstemcisi = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucuIstemcisi.connect();
  try {
    const { rows } = await sunucuIstemcisi.query<{ datname: string }>(
      'select datname from pg_database where datname = any($1)',
      [adlar],
    );
    return rows.map((satir) => satir.datname);
  } finally {
    await sunucuIstemcisi.end();
  }
}

// Gerçek başlangıç: tohum göçleri, kurulum komutunun işi ve bağlantıyla parola belirleme.
async function baslangicKur(): Promise<void> {
  expect(await al(TohumKosucusu).kos()).toEqual([
    '202611240000-kimlik-kurulum',
  ]);
  const kod = await al(KurulumBaglantisiHandler).calistir();
  expect((await bagla(kod, PAROLA)).status).toBe(204);

  const [sa] = await satirlar<{ id: string }>(
    "select id from kullanici where kullanici_adi = 'superadmin'",
  );
  const [aktor] = await satirlar<{ id: string }>(
    'select id from kullanici where sistem_aktoru',
  );
  if (sa === undefined || aktor === undefined) {
    throw new Error('tohum superadmin ya da sistem aktörü yazmadı');
  }
  superadmin = sa.id;
  sistemAktoru = aktor.id;

  // Pasif kişi: pasife alma komutu henüz yok. Kişi SQL ile yazılır, parolası bağlantıyla belirlenir,
  // sonra pasif işareti SQL ile konur.
  await gozlemci.query(
    `insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, 'pasif', 'Pasif')`,
    [PASIF],
  );
  const pasifKodu = await al(UnitOfWork).run(async (islem) => {
    await al(KisiKilidi).kilitle(islem, PASIF);
    return al(ParolaBaglantisi).uret(
      islem,
      { kullaniciId: PASIF, olusturanId: null },
      { yazanId: sistemAktoru, isAdi: 'test:kimlik-giris' },
    );
  });
  expect((await bagla(pasifKodu, PASIF_PAROLA)).status).toBe(204);
  await gozlemci.query(
    'update kullanici set pasif_zamani = clock_timestamp() where id = $1',
    [PASIF],
  );

  // Sistem aktörünün giriş bilgisi ve sırrı olamaz (TS-002 değişmez 16); burada SQL ile verilir ki
  // yöntemin doğrulaması geçsin ve reddi çekirdeğin kendi denetimi versin.
  const aktorOzeti = await al(ParolaOzetleyici).ozetle(AKTOR_PAROLA);
  await gozlemci.query(
    `update kullanici set kullanici_adi = 'aktor' where id = $1;`,
    [sistemAktoru],
  );
  await gozlemci.query(
    'insert into kullanici_sirri (kullanici_id, parola_ozeti) values ($1, $2)',
    [sistemAktoru, aktorOzeti],
  );
}

beforeAll(async () => {
  databases = await createAppDatabases({ migrations: true });
  try {
    const modul = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GirisSinamaUcu],
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    gozlemci = new pg.Client({ connectionString: databases.asil.url });
    await gozlemci.connect();
    const [satir] = await satirlar<{ pid: number }>(
      'select pg_backend_pid() as pid',
    );
    gozlemciPid = satir?.pid ?? -1;
    await baslangicKur();
  } catch (error) {
    await app?.close();
    await databases.drop();
    throw error;
  }
}, 60_000);

afterAll(async () => {
  await app?.close();
  // Uygulama kapanınca asıl veritabanında gözlemciden başka bağlantı kalmaz.
  const [satir] = await satirlar<{ sayi: number }>(
    `select count(*)::int as sayi from pg_stat_activity
      where datname = $1 and backend_type = 'client backend' and pid <> $2`,
    [databases.asil.name, gozlemciPid],
  );
  await gozlemci.end();
  await databases.drop();
  expect(satir?.sayi).toBe(0);
  expect(
    await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
  ).toEqual([]);
});

beforeEach(async () => {
  await gozlemci.query(
    'delete from oturum_sirri; delete from oturum; delete from outbox_iz;',
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a) doğru kullanıcı adı ve parolayla giriş', () => {
  it('200 döner; belirteçler doğrulanır; oturum ve sır satırı yazılır; dönen sırların düz hâli hiçbir tabloda yoktur', async () => {
    const cevap = await giris('superadmin');

    expect(cevap.status).toBe(200);
    const govde = cevap.body as GirisGovdesi;
    expect(Object.keys(govde).sort()).toEqual([
      'cihazSirri',
      'erisimBelirteci',
      'oturumId',
      'yenilemeBelirteci',
    ]);
    const belirtecler = al(BelirtecServisi);
    await expect(
      belirtecler.erisimBelirteciDogrula(govde.erisimBelirteci),
    ).resolves.toEqual({
      gecerli: true,
      icerik: { kullaniciId: superadmin, oturumId: govde.oturumId },
    });
    await expect(
      belirtecler.yenilemeBelirteciDogrula(govde.yenilemeBelirteci),
    ).resolves.toEqual({
      gecerli: true,
      icerik: { kullaniciId: superadmin, oturumId: govde.oturumId, nesil: 1 },
    });
    expect(Buffer.from(govde.cihazSirri, 'base64url')).toHaveLength(32);

    const [oturum, ...fazla] = await oturumlar();
    expect(fazla).toEqual([]);
    expect(oturum).toMatchObject({
      id: govde.oturumId,
      kullanici_id: superadmin,
      giris_yontemi: 'parola',
      ip_adresi: IP,
      tarayici_bilgisi: TARAYICI,
      kapatilma_zamani: null,
      kapatilma_nedeni: null,
    });
    expect(oturum?.son_dondurme_zamani).toEqual(oturum?.baslangic_zamani);
    expect(
      (oturum?.mutlak_bitis_zamani.getTime() ?? 0) -
        (oturum?.baslangic_zamani.getTime() ?? 0),
    ).toBe(YEDI_GUN_MS);

    expect(
      await satirlar<SirSatiri>(
        `select oturum_id, nesil, gecerli_yenileme_ozeti, onceki_yenileme_ozeti, cihaz_sirri_ozeti
           from oturum_sirri`,
      ),
    ).toEqual([
      {
        oturum_id: govde.oturumId,
        nesil: 1,
        gecerli_yenileme_ozeti: ozeti(govde.yenilemeBelirteci),
        onceki_yenileme_ozeti: null,
        cihaz_sirri_ozeti: ozeti(govde.cihazSirri),
      },
    ]);

    for (const sir of [
      govde.erisimBelirteci,
      govde.yenilemeBelirteci,
      govde.cihazSirri,
      PAROLA,
    ]) {
      expect(await tablolardaGecenler(sir)).toEqual([]);
    }
  });
});

describe('b) dönen erişim belirteciyle oturumlu uç', () => {
  it('yalnız kendisi işaretli uca erişilir ve bağlamdaki oturum girişin oturumudur', async () => {
    const { erisimBelirteci, oturumId } = await girisYap();

    const cevap = await kendisi(erisimBelirteci);

    expect(cevap.status).toBe(200);
    expect(cevap.body).toMatchObject({ kullaniciId: superadmin, oturumId });
  });
});

describe('c) başarısız girişler', () => {
  it('yanlış parola, var olmayan kullanıcı, pasif kullanıcı ve sistem aktörü aynı durum ve gövdeyle reddedilir; oturum satırı oluşmaz', async () => {
    const dogrula = vi.spyOn(al(ParolaOzetleyici), 'dogrula');

    const cevaplar = [
      await giris('superadmin', 'yanlis ama uzun bir parola cümlesi'),
      await giris('olmayan-kisi', PAROLA),
      await giris('pasif', PASIF_PAROLA),
      await giris('aktor', AKTOR_PAROLA),
    ];

    for (const cevap of cevaplar) {
      expect({ durum: cevap.status, govde: cevap.body as unknown }).toEqual({
        durum: RET_DURUMU,
        govde: RET_GOVDESI,
      });
    }
    expect(await oturumlar()).toEqual([]);
    // Kişi yokken de doğrulama koşar (AK-15): dört denemede dört doğrulama vardır. Kişi yokken
    // kullanılan sahte özet, özetleyicinin güncel ayarlarını taşır.
    expect(dogrula).toHaveBeenCalledTimes(4);
    const { memory, passes, parallelism } = ARGON2ID_AYARLARI;
    expect(dogrula.mock.calls[1]?.[1]).toMatch(
      `$argon2id$v=19$m=${String(memory)},t=${String(passes)},p=${String(parallelism)}$`,
    );
    await expect(dogrula.mock.results[1]?.value).resolves.toBe(false);
    // Pasif kişinin ve sistem aktörünün parolası doğrudur: reddi çekirdeğin denetimi verir.
    await expect(dogrula.mock.results[2]?.value).resolves.toBe(true);
    await expect(dogrula.mock.results[3]?.value).resolves.toBe(true);
  });
});

describe('d) kullanıcı adının yazımı', () => {
  it('büyük harfle yazılan kullanıcı adıyla da giriş olur', async () => {
    const cevap = await giris('SUPERADMIN');
    const karisik = await giris('SuperAdmin');

    expect(cevap.status).toBe(200);
    expect(karisik.status).toBe(200);
    expect((await oturumlar()).map((o) => o.kullanici_id)).toEqual([
      superadmin,
      superadmin,
    ]);
  });
});

describe('e) oturum sınırı', () => {
  it('dördüncü giriş en eski açık oturumu oturum_siniri nedeniyle kapatır; açık oturum sayısı üçte kalır', async () => {
    const girisler: GirisGovdesi[] = [];
    for (let i = 0; i < 4; i += 1) {
      girisler.push(await girisYap());
    }

    const butun = await oturumlar();
    expect(butun.map((o) => [o.id, o.kapatilma_nedeni])).toEqual(
      girisler.map((g, i) => [g.oturumId, i === 0 ? 'oturum_siniri' : null]),
    );
    expect(butun.filter((o) => o.kapatilma_zamani === null)).toHaveLength(3);
    expect((await kendisi(girisler[0]?.erisimBelirteci ?? '')).status).toBe(
      401,
    );
    expect((await kendisi(girisler[3]?.erisimBelirteci ?? '')).status).toBe(
      200,
    );
    // Kapatmanın notu girişin adını ve nedenini taşır.
    const kapatma = (await notlar()).filter(
      (n) => n.kaynak === 'Oturum' && n.eylem === 'guncelleme',
    );
    expect(kapatma).toEqual([
      expect.objectContaining({
        is_adi: 'kimlik:giris',
        kullanici_id: superadmin,
        kayit_id: girisler[0]?.oturumId,
        degisen: expect.objectContaining({
          kapatilma_nedeni: { eski: null, yeni: 'oturum_siniri' },
        }) as unknown,
      }),
    ]);
  });
});

describe('f) doğrulama ile kesinleştirme arasında sır değişirse', () => {
  it('giriş reddedilir ve oturum oluşmaz', async () => {
    const yontem = al(ParolaGirisYontemi);
    const asilDogrula = yontem.dogrula.bind(yontem);
    // Yöntemin doğrulaması (işlemin dışında) bitince, kesinleştirme (kişi kilidi altında) başlamadan
    // önce sırrın güncelleme zamanı başka bir bağlantıdan değiştirilir: arada parola belirlenmiş gibi.
    const dogrula = vi
      .spyOn(yontem, 'dogrula')
      .mockImplementation(async (girdi) => {
        const sonuc = await asilDogrula(girdi);
        await gozlemci.query(
          `update kullanici_sirri set guncelleme_zamani = guncelleme_zamani + interval '1 second'
            where kullanici_id = $1`,
          [superadmin],
        );
        return sonuc;
      });

    const cevap = await giris('superadmin');

    expect(dogrula).toHaveBeenCalledTimes(1);
    await expect(dogrula.mock.results[0]?.value).resolves.toMatchObject({
      sonuc: 'tamam',
    });
    expect({ durum: cevap.status, govde: cevap.body as unknown }).toEqual({
      durum: RET_DURUMU,
      govde: RET_GOVDESI,
    });
    expect(await oturumlar()).toEqual([]);
    expect(await satirlar('select oturum_id from oturum_sirri')).toEqual([]);

    // Değişiklik geldikten sonra doğrulanan giriş kanıtı güncel olduğu için geçer.
    dogrula.mockRestore();
    expect((await giris('superadmin')).status).toBe(200);
  });
});

describe('g) çıkış', () => {
  it('çıkıştan sonra aynı erişim belirteci 401 döner, oturum cikis nedeniyle kapalıdır; ikinci çıkış satırı değiştirmez', async () => {
    const { erisimBelirteci, oturumId } = await girisYap();
    const obur = await girisYap();

    const cevap = await cikis(erisimBelirteci);

    expect(cevap.status).toBe(204);
    const sonra = await kendisi(erisimBelirteci);
    expect(sonra.status).toBe(401);
    expect(sonra.body).toEqual(KIMLIK_GEREKLI);
    const [kapanan] = (await oturumlar()).filter((o) => o.id === oturumId);
    expect(kapanan?.kapatilma_nedeni).toBe('cikis');
    expect(kapanan?.kapatilma_zamani).toBeInstanceOf(Date);
    // Kişinin öbür oturumu açık kalır.
    expect((await kendisi(obur.erisimBelirteci)).status).toBe(200);

    const ikinci = await cikis(erisimBelirteci);
    expect(ikinci.status).toBe(401);
    const [ayni] = (await oturumlar()).filter((o) => o.id === oturumId);
    expect(ayni).toEqual(kapanan);
    expect(
      (await notlar()).filter((n) => n.is_adi === 'kimlik:cikis'),
    ).toHaveLength(1);
  });
});

describe('h) parola bağlantıyla yeniden belirlenince', () => {
  it('kişinin önceki oturumu 401 döner', async () => {
    const { erisimBelirteci, oturumId } = await girisYap();
    expect((await kendisi(erisimBelirteci)).status).toBe(200);

    const kod = await al(KurulumBaglantisiHandler).calistir();
    expect((await bagla(kod, PAROLA)).status).toBe(204);

    expect((await kendisi(erisimBelirteci)).status).toBe(401);
    const [oturum] = await oturumlar();
    expect(oturum).toMatchObject({
      id: oturumId,
      kapatilma_nedeni: 'parola_degisimi',
    });
  });
});

describe('i) adres imzası', () => {
  it('imzasız ya da imzası tutmayan giriş, öbür başarısızlıklarla aynı cevapla reddedilir ve oturum oluşmaz', async () => {
    const dogrula = vi.spyOn(al(ParolaGirisYontemi), 'dogrula');
    const bozuk = {
      ...adresBasliklari(),
      [ISTEMCI_BASLIKLARI.adres]: '198.51.100.1',
    };

    const cevaplar = [
      await giris('superadmin', PAROLA, {}),
      await giris('superadmin', PAROLA, bozuk),
    ];

    for (const cevap of cevaplar) {
      expect({ durum: cevap.status, govde: cevap.body as unknown }).toEqual({
        durum: RET_DURUMU,
        govde: RET_GOVDESI,
      });
    }
    expect(dogrula).not.toHaveBeenCalled();
    expect(await oturumlar()).toEqual([]);
  });
});

describe('j) değişiklik kaydı notları', () => {
  it('giriş ve çıkışın notları işin adını taşır, yazanı giriş yapan kişidir; gövdelerde parola, belirteç ya da özet yoktur', async () => {
    const { erisimBelirteci, yenilemeBelirteci, cihazSirri, oturumId } =
      await girisYap();
    expect((await cikis(erisimBelirteci)).status).toBe(204);

    const butun = await notlar();
    expect(
      butun.map((n) => `${n.kaynak}:${n.eylem}:${n.is_adi}:${n.kayit_id}`),
    ).toEqual([
      `Oturum:olusturma:kimlik:giris:${oturumId}`,
      `OturumSirri:olusturma:kimlik:giris:${oturumId}`,
      `Oturum:guncelleme:kimlik:cikis:${oturumId}`,
    ]);
    expect(new Set(butun.map((n) => n.kullanici_id))).toEqual(
      new Set([superadmin]),
    );
    // Sır tablosunun notu yalnız satırın kimliğini taşır.
    expect(butun[1]?.degisen).toEqual({ oturum_id: { yeni: oturumId } });

    const [parolaSatiri] = await satirlar<{ parola_ozeti: string }>(
      'select parola_ozeti from kullanici_sirri where kullanici_id = $1',
      [superadmin],
    );
    const sirlar = [
      PAROLA,
      parolaSatiri?.parola_ozeti ?? '',
      erisimBelirteci,
      yenilemeBelirteci,
      cihazSirri,
      ozeti(yenilemeBelirteci),
      ozeti(cihazSirri),
    ];
    const metinler = (
      await satirlar<{ metin: string }>(
        'select govde::text as metin from outbox_iz',
      )
    ).map((s) => s.metin);
    expect(metinler).toHaveLength(3);
    for (const sir of sirlar) {
      expect(sir.length).toBeGreaterThan(0);
      expect(metinler.filter((m) => m.includes(sir))).toEqual([]);
    }
  });
});
