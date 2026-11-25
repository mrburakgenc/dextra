// Parola (GV-028; TS-002 AK-4, AK-5, AK-15): bağlantı parçası, bağlantıyla parola belirleme ucu ve
// kurulum komutunun işi. Koşturma:
//   pnpm -C backend test:e2e test/kimlik-parola.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır. Kullanıcılar
// her testten önce SQL ile yeniden yazılır; satırlar ve notlar ayrı bir bağlantıdan okunur.
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ParolaBaglantisi } from '../src/features/kimlik/_shared/application/parola-baglantisi.js';
import type { IzBilgisi } from '../src/features/kimlik/_shared/application/iz.js';
import { KisiKilidi } from '../src/features/kimlik/_shared/application/kisi-kilidi.js';
import { KurulumBaglantisiHandler } from '../src/features/kimlik/parola/application/commands/kurulum-baglantisi/kurulum-baglantisi.handler.js';
import { ParolaOzetleyici } from '../src/features/kimlik/parola/domain/parola-ozetleyici.port.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { derle } from './derleme.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const AYSE = '30000000-0000-4000-8000-000000000001';
const SUPERADMIN = '30000000-0000-4000-8000-000000000002';
// Kimliğin sistem aktörü (AK-2): çekirdek yolların notlarında yazan odur.
const SISTEM_AKTORU = '30000000-0000-4000-8000-000000000003';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const IZ: IzBilgisi = { yazanId: SISTEM_AKTORU, isAdi: 'test:kimlik-parola' };
const PAROLA = 'dogru at pil zımba cümlesi';
const UC = '/kimlik/parola/belirle';
const GECERSIZ_BAGLANTI = {
  kod: 'bulunamadi',
  ileti: 'Parola bağlantısı geçersiz',
  ayrinti: null,
};

const BASLANGIC = `
  truncate outbox_iz, outbox_olay, oturum_sirri, oturum, uyelik, yetenek, parola_baglantisi,
           kullanici_sirri, kullanici, grup, rol, izin, yetki_surumu;
  insert into kullanici (id, kullanici_adi, gorunen_ad, sistem_aktoru)
  values ('${AYSE}', 'ayse', 'Ayşe', false),
         ('${SUPERADMIN}', 'superadmin', 'Sistem Yöneticisi', false),
         ('${SISTEM_AKTORU}', null, 'kimlik', true);
`;

interface BaglantiSatiri {
  id: string;
  kullanici_id: string;
  kod_ozeti: string;
  son_gecerlilik_zamani: Date;
  kullanilma_zamani: Date | null;
  olusturma_zamani: Date;
}

interface OturumSatiri {
  id: string;
  kullanici_id: string;
  kapatilma_nedeni: string | null;
}

interface Not {
  kullanici_id: string;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
}

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;

// Açılmış uygulamanın bir parçası; testler yalnız beforeAll başarılıysa koşar.
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

function ozeti(kod: string): string {
  return createHash('sha256').update(kod).digest('hex');
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await gozlemci.query<T>(sql, degerler)).rows;
}

function baglantilar(): Promise<BaglantiSatiri[]> {
  return satirlar<BaglantiSatiri>(
    `select id, kullanici_id, kod_ozeti, son_gecerlilik_zamani, kullanilma_zamani, olusturma_zamani
       from parola_baglantisi order by olusturma_zamani`,
  );
}

async function parolaOzeti(kullaniciId: string): Promise<string | undefined> {
  const [satir] = await satirlar<{ parola_ozeti: string }>(
    'select parola_ozeti from kullanici_sirri where kullanici_id = $1',
    [kullaniciId],
  );
  return satir?.parola_ozeti;
}

function oturumlar(): Promise<OturumSatiri[]> {
  return satirlar<OturumSatiri>(
    'select id, kullanici_id, kapatilma_nedeni from oturum order by id',
  );
}

async function notMetinleri(): Promise<string[]> {
  return (
    await satirlar<{ metin: string }>(
      'select govde::text as metin from outbox_iz order by olusturma_zamani',
    )
  ).map((s) => s.metin);
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
  kapatilmaNedeni: string | null = null,
): Promise<void> {
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi, kapatilma_zamani, kapatilma_nedeni)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(),
             '127.0.0.1', 'deneme', case when $3::text is null then null else clock_timestamp() end, $3)`,
    [id, kullaniciId, kapatilmaNedeni],
  );
}

// Yönetimin bağlantı üretme ucu bu görevde yok; parça, kişi kilidi alınmış işlemde doğrudan çağrılır.
function baglantiUret(kullaniciId: string): Promise<string> {
  return al(UnitOfWork).run(async (islem) => {
    await al(KisiKilidi).kilitle(islem, kullaniciId);
    return al(ParolaBaglantisi).uret(
      islem,
      { kullaniciId, olusturanId: null },
      IZ,
    );
  });
}

function belirle(kod: string, parola = PAROLA): request.Test {
  return request(sunucu()).post(UC).send({ kod, parola });
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

beforeAll(async () => {
  databases = await createAppDatabases({ migrations: true });
  try {
    const modul = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    gozlemci = new pg.Client({ connectionString: databases.asil.url });
    await gozlemci.connect();
  } catch (error) {
    await app?.close();
    await databases.drop();
    throw error;
  }
});

afterAll(async () => {
  await gozlemci.end();
  await app?.close();
  await databases.drop();
  expect(
    await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
  ).toEqual([]);
});

beforeEach(async () => {
  await gozlemci.query(BASLANGIC);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('c) bağlantı parçası', () => {
  it('üretilen kod 32 rastgele bayttır; tabloda yalnız SHA-256 özeti durur ve kodun düz hâli hiçbir tabloda yoktur', async () => {
    const kod = await baglantiUret(AYSE);

    expect(Buffer.from(kod, 'base64url')).toHaveLength(32);
    const [satir, ...fazla] = await baglantilar();
    expect(fazla).toEqual([]);
    expect(satir).toMatchObject({
      kullanici_id: AYSE,
      kod_ozeti: ozeti(kod),
      kullanilma_zamani: null,
    });
    // Ömür 24 saattir (uygulama saatiyle hesaplanır; oluşturma zamanı veritabanı saatidir).
    const omur =
      (satir?.son_gecerlilik_zamani.getTime() ?? 0) -
      (satir?.olusturma_zamani.getTime() ?? 0);
    expect(Math.abs(omur - 24 * 60 * 60 * 1000)).toBeLessThan(5000);

    const tablolar = await satirlar<{ table_name: string }>(
      `select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    expect(tablolar.length).toBeGreaterThan(10);
    for (const { table_name } of tablolar) {
      const [sayim] = await satirlar<{ sayi: number }>(
        `select count(*)::int as sayi from "${table_name}" t where position($1 in t::text) > 0`,
        [kod],
      );
      expect({ tablo: table_name, sayi: sayim?.sayi }).toEqual({
        tablo: table_name,
        sayi: 0,
      });
    }
  });

  it('ikinci üretimde ilki silinmiştir ve ilk kod artık kullanılamaz', async () => {
    const ilk = await baglantiUret(AYSE);
    const ikinci = await baglantiUret(AYSE);

    expect((await baglantilar()).map((b) => b.kod_ozeti)).toEqual([
      ozeti(ikinci),
    ]);
    const cevap = await belirle(ilk);
    expect(cevap.status).toBe(404);
    expect(cevap.body).toEqual(GECERSIZ_BAGLANTI);
  });
});

describe('d) geçerli kodla parola belirleme', () => {
  it('sır yazılır, bağlantı kullanıldı diye işaretlenir, kişinin açık oturumları parola_degisimi nedeniyle kapanır; aynı kod ikinci kez tek tip hatayla reddedilir', async () => {
    const acik1 = '40000000-0000-4000-8000-000000000001';
    const acik2 = '40000000-0000-4000-8000-000000000002';
    const kapali = '40000000-0000-4000-8000-000000000003';
    const baskasinin = '40000000-0000-4000-8000-000000000004';
    await oturumEkle(acik1, AYSE);
    await oturumEkle(acik2, AYSE);
    await oturumEkle(kapali, AYSE, 'cikis');
    await oturumEkle(baskasinin, SUPERADMIN);
    const kod = await baglantiUret(AYSE);

    const cevap = await belirle(kod);

    expect(cevap.status).toBe(204);
    const ozet = await parolaOzeti(AYSE);
    expect(ozet).toMatch(/^\$argon2id\$/);
    await expect(
      al(ParolaOzetleyici).dogrula(PAROLA, ozet ?? ''),
    ).resolves.toBe(true);
    const [baglanti] = await baglantilar();
    expect(baglanti?.kullanilma_zamani).toBeInstanceOf(Date);
    expect(await oturumlar()).toEqual([
      { id: acik1, kullanici_id: AYSE, kapatilma_nedeni: 'parola_degisimi' },
      { id: acik2, kullanici_id: AYSE, kapatilma_nedeni: 'parola_degisimi' },
      { id: kapali, kullanici_id: AYSE, kapatilma_nedeni: 'cikis' },
      { id: baskasinin, kullanici_id: SUPERADMIN, kapatilma_nedeni: null },
    ]);

    const ikinci = await belirle(kod, 'baska bir uzun parola cümlesi');
    expect(ikinci.status).toBe(404);
    expect(ikinci.body).toEqual(GECERSIZ_BAGLANTI);
    expect(await parolaOzeti(AYSE)).toBe(ozet);
  });

  it('aynı kodla eşzamanlı iki istekten yalnız biri parola belirler', async () => {
    const kod = await baglantiUret(AYSE);

    const cevaplar = await Promise.all([
      belirle(kod, 'birinci uzun parola cümlesi'),
      belirle(kod, 'ikinci uzun parola cümlesi'),
    ]);

    expect(cevaplar.map((c) => c.status).sort()).toEqual([204, 404]);
    const kazanan =
      cevaplar[0].status === 204
        ? 'birinci uzun parola cümlesi'
        : 'ikinci uzun parola cümlesi';
    await expect(
      al(ParolaOzetleyici).dogrula(kazanan, (await parolaOzeti(AYSE)) ?? ''),
    ).resolves.toBe(true);
  });
});

describe('e) geçersiz bağlantı', () => {
  it('süresi geçmiş ve hiç var olmamış kod aynı hatayla reddedilir; özetleyici çağrılmaz', async () => {
    const ozetle = vi.spyOn(al(ParolaOzetleyici), 'ozetle');
    const kod = await baglantiUret(AYSE);
    await gozlemci.query(
      "update parola_baglantisi set son_gecerlilik_zamani = clock_timestamp() - interval '1 second'",
    );

    const suresiGecmis = await belirle(kod);
    const olmayan = await belirle(randomBytes(32).toString('base64url'));

    for (const cevap of [suresiGecmis, olmayan]) {
      expect(cevap.status).toBe(404);
      expect(cevap.body).toEqual(GECERSIZ_BAGLANTI);
    }
    expect(ozetle).not.toHaveBeenCalled();
    expect(await parolaOzeti(AYSE)).toBeUndefined();
    const [baglanti] = await baglantilar();
    expect(baglanti?.kullanilma_zamani).toBeNull();
  });
});

describe('f) kurala uymayan parola', () => {
  it('400 dogrulama_hatasi döner ve bağlantı kullanılmamış kalır', async () => {
    const ozetle = vi.spyOn(al(ParolaOzetleyici), 'ozetle');
    const kod = await baglantiUret(AYSE);

    const cevap = await belirle(kod, 'a'.repeat(14));

    expect(cevap.status).toBe(400);
    expect(cevap.body).toEqual({
      kod: 'dogrulama_hatasi',
      ileti: 'İstek doğrulanamadı',
      ayrinti: [{ alan: 'parola', neden: expect.any(String) as string }],
    });
    expect(ozetle).not.toHaveBeenCalled();
    const [baglanti] = await baglantilar();
    expect(baglanti?.kullanilma_zamani).toBeNull();
    expect(await parolaOzeti(AYSE)).toBeUndefined();
  });
});

describe('g) kurulum komutunun işi', () => {
  it('superadmin için kod verir ve o kodla parola belirlenebilir', async () => {
    const kod = await al(KurulumBaglantisiHandler).calistir();

    const [baglanti] = await baglantilar();
    expect(baglanti).toMatchObject({
      kullanici_id: SUPERADMIN,
      kod_ozeti: ozeti(kod),
    });
    const cevap = await belirle(kod);
    expect(cevap.status).toBe(204);
    await expect(
      al(ParolaOzetleyici).dogrula(
        PAROLA,
        (await parolaOzeti(SUPERADMIN)) ?? '',
      ),
    ).resolves.toBe(true);
  });

  it('kullanıcı adı superadmin olan kullanıcı yokken anlaşılır hata verir ve bağlantı yazmaz', async () => {
    await gozlemci.query(`delete from kullanici where id = '${SUPERADMIN}'`);

    await expect(al(KurulumBaglantisiHandler).calistir()).rejects.toThrow(
      'Kullanıcı adı "superadmin" olan kullanıcı yok',
    );
    expect(await baglantilar()).toEqual([]);
  });

  it('derlenmiş komut kodu standart çıktıya bir kez yazar ve 0 ile çıkar; kullanıcı yokken 1 ile çıkar ve hatayı standart hataya yazar', async () => {
    const derleme = await derle();
    onTestFinished(() => derleme.sil());
    // Alt süreç, createAppDatabases'in geçici veritabanlarına çevirdiği adresleri miras alır.
    const kos = () =>
      promisify(execFile)(
        process.execPath,
        [join(derleme.klasor, 'kurulum.js')],
        { cwd: backendDir },
      );

    await gozlemci.query(`delete from kullanici where id = '${SUPERADMIN}'`);
    await expect(kos()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        'Kullanıcı adı "superadmin" olan kullanıcı yok',
      ) as string,
    });
    await gozlemci.query(BASLANGIC);

    const { stdout } = await kos();
    const [baglanti] = await baglantilar();
    // Standart çıktıda Nest'in açılış günlüğü de vardır; kod, özeti tablodakine uyan dizgedir.
    const kod = (stdout.match(/[A-Za-z0-9_-]{43}/g) ?? []).find(
      (aday) => ozeti(aday) === baglanti?.kod_ozeti,
    );
    expect(kod).toBeDefined();
    expect(stdout.split(kod ?? '')).toHaveLength(2);
    expect((await belirle(kod ?? '')).status).toBe(204);
  }, 120_000);
});

describe('h) değişiklik kaydı notları', () => {
  it('notların gövdesinde ne parola özeti ne kod ne kod özeti vardır; kurulumda yazan sistem aktörü, parola belirlemede parolasını belirleyen kişidir', async () => {
    const kurulum = al(KurulumBaglantisiHandler);
    // Kullanılmamış bağlantının silinmesi, sırrın ilk yazılması ve güncellenmesi notlanır.
    const silinen = await kurulum.calistir();
    const ilk = await kurulum.calistir();
    expect((await belirle(ilk)).status).toBe(204);
    const ilkOzet = await parolaOzeti(SUPERADMIN);
    const ikinci = await kurulum.calistir();
    expect((await belirle(ikinci, 'ikinci uzun parola cümlesi')).status).toBe(
      204,
    );
    const ikinciOzet = await parolaOzeti(SUPERADMIN);

    const sirlar = [
      silinen,
      ilk,
      ikinci,
      ozeti(silinen),
      ozeti(ilk),
      ozeti(ikinci),
      ilkOzet ?? '',
      ikinciOzet ?? '',
    ];
    expect(new Set(sirlar).size).toBe(sirlar.length);
    const metinler = await notMetinleri();
    for (const sir of sirlar) {
      expect(sir.length).toBeGreaterThan(0);
      expect(metinler.filter((m) => m.includes(sir))).toEqual([]);
    }

    const butun = await notlar();
    expect(
      new Set(butun.map((n) => `${n.kaynak}:${n.eylem}:${n.is_adi}`)),
    ).toEqual(
      new Set([
        'ParolaBaglantisi:olusturma:kimlik:kurulum',
        'ParolaBaglantisi:silme:kimlik:kurulum',
        'ParolaBaglantisi:guncelleme:kimlik:parola-belirle',
        'KullaniciSirri:olusturma:kimlik:parola-belirle',
        'KullaniciSirri:guncelleme:kimlik:parola-belirle',
      ]),
    );
    // Sistemin kendi kararıyla yaptığı yazmada yazan sistem aktörü, kişinin kendi adına yaptığında
    // kişinin kendisidir (TS-002 AK-35).
    expect(new Set(butun.map((n) => `${n.is_adi}:${n.kullanici_id}`))).toEqual(
      new Set([
        `kimlik:kurulum:${SISTEM_AKTORU}`,
        `kimlik:parola-belirle:${SUPERADMIN}`,
      ]),
    );
  });
});
