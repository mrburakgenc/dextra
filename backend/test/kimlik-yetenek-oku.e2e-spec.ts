// Yetenek: listele ve tek kayıt (GV-059; TS-002 AK-38, AK-39, AK-42; izin Yetenek:oku). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-yetenek-oku.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Ek grup, rol, üyelik ve yetenek satırları
// SQL ile yazılır.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const LISTE = '/kimlik/yetenek';

// Yetenek kaynağının bütün kolonları (TS-002 "Veri modeli").
const YETENEK_ALANLARI = [
  'butunBirimler',
  'butunKayitlar',
  'butunKolonlar',
  'grupId',
  'id',
  'izinId',
  'koken',
  'kolonlar',
  'olusturmaZamani',
  'rolId',
  'sart',
  'silinmeZamani',
  'sistemSatiri',
  'tohumAnahtari',
  'yerineGectigiId',
];

// Kimlikler: grup a1…, roller a2…, üyelik a3…, yetenekler a4….
const GRUP_A = 'a1000000-0000-4000-8000-000000000001';
const ROL_A = 'a2000000-0000-4000-8000-000000000001';
const ROL_KOKEN = 'a2000000-0000-4000-8000-000000000002';
const UYELIK_KOKEN = 'a3000000-0000-4000-8000-000000000001';
const Y_SARTLI = 'a4000000-0000-4000-8000-000000000001';
const Y_GRUP = 'a4000000-0000-4000-8000-000000000002';
const Y_KULLANICI = 'a4000000-0000-4000-8000-000000000003';
const Y_SILINMIS = 'a4000000-0000-4000-8000-000000000004';
const Y_KOKEN = 'a4000000-0000-4000-8000-000000000005';
const YOK = 'a4000000-0000-4000-8000-0000000000ff';

// Şartlı yeteneğin saklanan şartı ve kolon listesi; cevapta aynen gelmelidir.
const SART = [
  { alan: 'kullaniciAdi', islec: 'listede', deger: ['ali', 'veli'] },
  { alan: 'id', islec: 'esit_degil', deger: { yerTutucu: 'isteyen' } },
];
const KOLONLAR = ['gorunenAd', 'kullaniciAdi'];

type Kayit = Record<string, unknown>;

interface ListeCevabi {
  kayitlar: Kayit[];
  sayfa: number;
  boyut: number;
  sonrakiVar: boolean;
}

let ortam: KimlikOrtami;
let kokGrup: string;
let kullaniciOku: string;
let gocunYetenekleri: string[];

function al(yol: string, erisimBelirteci?: string): request.Test {
  const istek = request(ortam.app.getHttpServer()).get(yol);
  return erisimBelirteci === undefined
    ? istek
    : istek.set(ortam.basliklar(erisimBelirteci));
}

async function liste(
  sorgu: string,
  erisimBelirteci?: string,
): Promise<ListeCevabi> {
  const cevap = await al(
    `${LISTE}?${sorgu}`,
    erisimBelirteci ?? ortam.superadmin.erisimBelirteci,
  );
  expect(cevap.status).toBe(200);
  return cevap.body as ListeCevabi;
}

const kimlikler = (kayitlar: readonly Kayit[]): unknown[] =>
  kayitlar.map((k) => k['id']);

const alanlar = (kayit: Kayit): string[] => Object.keys(kayit).sort();

async function izinKimligi(kaynak: string, eylem: string): Promise<string> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ id: string }>(
    'select id from izin where kaynak = $1 and eylem = $2',
    [kaynak, eylem],
  );
  if (satir === undefined) {
    throw new Error(`tohum ${kaynak}:${eylem} iznini yazmadı`);
  }
  return satir.id;
}

async function kalanVeritabanlari(adlar: readonly string[]): Promise<string[]> {
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const { rows } = await sunucu.query<{ datname: string }>(
      'select datname from pg_database where datname = any($1)',
      [adlar],
    );
    return rows.map((satir) => satir.datname);
  } finally {
    await sunucu.end();
  }
}

beforeAll(async () => {
  ortam = await kimlikOrtamiKur();
  const {
    rows: [kok],
  } = await ortam.db.query<{ id: string }>(
    'select id from grup where ust_grup_id is null and silinme_zamani is null',
  );
  kokGrup = kok?.id ?? '';
  kullaniciOku = await izinKimligi('Kullanici', 'oku');
  const grupOku = await izinKimligi('Grup', 'oku');
  gocunYetenekleri = (
    await ortam.db.query<{ id: string }>(
      "select id from yetenek where koken = 'goc'",
    )
  ).rows.map((satir) => satir.id);

  await ortam.db.query(
    "insert into grup (id, ust_grup_id, ad) values ($1, $2, 'Grup A')",
    [GRUP_A, kokGrup],
  );
  await ortam.db.query("insert into rol (id, ad) values ($1, 'Rol A')", [
    ROL_A,
  ]);
  // Oluşturma zamanları sabit verilir: sıralama testi kayıtların sırasını bilir.
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, kolonlar, koken, olusturma_zamani)
     values ($1, $2, $3, $4, $5::jsonb, $6, 'yonetici', '2030-01-01T00:00:01Z')`,
    [Y_SARTLI, kokGrup, ROL_A, kullaniciOku, JSON.stringify(SART), KOLONLAR],
  );
  for (const [id, grup, izin, zaman, silinmis] of [
    [Y_GRUP, GRUP_A, grupOku, '2030-01-01T00:00:02Z', false],
    [Y_KULLANICI, GRUP_A, kullaniciOku, '2030-01-01T00:00:03Z', false],
    [Y_SILINMIS, GRUP_A, grupOku, '2030-01-01T00:00:04Z', true],
  ] as const) {
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, koken,
                            olusturma_zamani, silinme_zamani)
       values ($1, $2, $3, $4, true, true, 'yonetici', $5,
               case when $6 then clock_timestamp() end)`,
      [id, grup, ROL_A, izin, zaman, silinmis],
    );
  }
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) liste', () => {
  it('ilk yönetici kurulum göçünün yazdığı yönetim yeteneklerini sistem satırı işaretiyle görür', async () => {
    expect(gocunYetenekleri.length).toBeGreaterThan(0);
    const cevap = await liste('boyut=100');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 100, sonrakiVar: false });
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([...gocunYetenekleri, Y_SARTLI, Y_GRUP]),
    );
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(YETENEK_ALANLARI);
    }
    for (const id of gocunYetenekleri) {
      expect(cevap.kayitlar.find((k) => k['id'] === id)).toMatchObject({
        sistemSatiri: true,
        koken: 'goc',
      });
    }
    expect(
      cevap.kayitlar.find(
        (k) => k['tohumAnahtari'] === 'kimlik:Yetenek:oku:superadmin',
      ),
    ).toMatchObject({ sistemSatiri: true, butunKayitlar: true });
  });

  it('silinmiş yetenek listede gelmez', async () => {
    const cevap = await liste('boyut=100');
    expect(kimlikler(cevap.kayitlar)).not.toContain(Y_SILINMIS);
    for (const kayit of cevap.kayitlar) {
      expect(kayit['silinmeZamani']).toBeNull();
    }
  });

  it('sayfa ve boyut verilmezse 1 ve 20 kullanılır', async () => {
    const cevap = await liste('');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 20, sonrakiVar: true });
    expect(cevap.kayitlar).toHaveLength(20);
  });

  it('oluşturma zamanına göre artan ve "-" ile azalan sıralar', async () => {
    const artan = await liste(`rolId=${ROL_A}&sirala=olusturmaZamani`);
    expect(kimlikler(artan.kayitlar)).toEqual([Y_SARTLI, Y_GRUP, Y_KULLANICI]);
    const azalan = await liste(`rolId=${ROL_A}&sirala=-olusturmaZamani`);
    expect(kimlikler(azalan.kayitlar)).toEqual([Y_KULLANICI, Y_GRUP, Y_SARTLI]);
  });
});

describe('b) süzgeçler', () => {
  it('rolId yalnız o role bağlı canlı yetenekleri verir', async () => {
    const cevap = await liste(`rolId=${ROL_A}&boyut=100`);
    expect([...kimlikler(cevap.kayitlar)].sort()).toEqual([
      Y_SARTLI,
      Y_GRUP,
      Y_KULLANICI,
    ]);
  });

  it('grupId yalnız o gruba bağlı canlı yetenekleri verir', async () => {
    const cevap = await liste(`grupId=${GRUP_A}&boyut=100`);
    expect([...kimlikler(cevap.kayitlar)].sort()).toEqual([
      Y_GRUP,
      Y_KULLANICI,
    ]);
  });

  it('izinId yalnız o izne bağlı yetenekleri verir', async () => {
    const cevap = await liste(`izinId=${kullaniciOku}&boyut=100`);
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([Y_SARTLI, Y_KULLANICI]),
    );
    expect(kimlikler(cevap.kayitlar)).not.toContain(Y_GRUP);
    expect(
      cevap.kayitlar.find(
        (k) => k['tohumAnahtari'] === 'kimlik:Kullanici:oku:superadmin',
      ),
    ).toBeDefined();
    for (const kayit of cevap.kayitlar) {
      expect(kayit['izinId']).toBe(kullaniciOku);
    }
  });

  it('süzgeçler birlikte verilince hepsine uyan kayıtlar gelir', async () => {
    const cevap = await liste(
      `grupId=${GRUP_A}&rolId=${ROL_A}&izinId=${kullaniciOku}`,
    );
    expect(kimlikler(cevap.kayitlar)).toEqual([Y_KULLANICI]);
  });

  it('kimlik biçiminde olmayan süzgeç 400 dogrulama_hatasi', async () => {
    for (const alan of ['grupId', 'rolId', 'izinId']) {
      const cevap = await al(
        `${LISTE}?${alan}=abc`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    }
  });
});

describe('c) tek kayıt', () => {
  it('şartlı yeteneğin şartı ve kolon listesi saklandığı biçimde gelir', async () => {
    const cevap = await al(
      `${LISTE}/${Y_SARTLI}`,
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(200);
    expect(alanlar(cevap.body as Kayit)).toEqual(YETENEK_ALANLARI);
    expect(cevap.body).toMatchObject({
      id: Y_SARTLI,
      grupId: kokGrup,
      rolId: ROL_A,
      izinId: kullaniciOku,
      butunKayitlar: false,
      butunKolonlar: false,
      sistemSatiri: false,
      koken: 'yonetici',
    });
    expect((cevap.body as Kayit)['sart']).toEqual(SART);
    expect((cevap.body as Kayit)['kolonlar']).toEqual(KOLONLAR);
    const { kayitlar } = await liste(`rolId=${ROL_A}`);
    expect(cevap.body).toEqual(kayitlar.find((k) => k['id'] === Y_SARTLI));
  });

  it('var olmayan kimlik 404 bulunamadi', async () => {
    const cevap = await al(`${LISTE}/${YOK}`, ortam.superadmin.erisimBelirteci);
    expect(cevap.status).toBe(404);
    expect(cevap.body).toMatchObject({ kod: 'bulunamadi' });
  });

  it('kimlik biçiminde olmayan yol parametresi 400 dogrulama_hatasi', async () => {
    const cevap = await al(`${LISTE}/abc`, ortam.superadmin.erisimBelirteci);
    expect(cevap.status).toBe(400);
    expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    for (const yol of [LISTE, `${LISTE}/${Y_SARTLI}`]) {
      const cevap = await al(yol);
      expect(cevap.status).toBe(401);
      expect(cevap.body).toMatchObject({ kod: 'kimlik_gerekli' });
    }
  });

  it('Yetenek:oku yeteneği olmayan giriş yapmış kişi 403 yetki_yok', async () => {
    const kisi = await ortam.kullaniciAc('yetkisiz');
    for (const yol of [LISTE, `${LISTE}/${Y_SARTLI}`]) {
      const cevap = await al(yol, kisi.erisimBelirteci);
      expect(cevap.status).toBe(403);
      expect(cevap.body).toMatchObject({ kod: 'yetki_yok' });
    }
  });

  it('boyut 100den büyükse 400 dogrulama_hatasi', async () => {
    const cevap = await al(
      `${LISTE}?boyut=101`,
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(400);
    expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
  });

  it('sıralama alanı listede değilse 400 dogrulama_hatasi', async () => {
    for (const alan of ['koken', '-grupId', 'sart']) {
      const cevap = await al(
        `${LISTE}?sirala=${alan}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    }
  });

  it('yalnız kökeni gören yetenekle kayıtlar yalnız kimlik ve kökeni taşır', async () => {
    const kisi = await ortam.kullaniciAc('koken-okuyucu');
    // Üyelik ve yetenek, kişinin ilk oturumlu isteğinden önce yazılır; yetkisi bunlarla derlenir.
    await ortam.db.query(
      "insert into rol (id, ad) values ($1, 'Köken okuyucu')",
      [ROL_KOKEN],
    );
    await ortam.db.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [UYELIK_KOKEN, kisi.id, kokGrup, ROL_KOKEN],
    );
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, kolonlar, koken)
         select $1, $2, $3, i.id, true, array['koken'], 'yonetici' from izin i
          where i.kaynak = 'Yetenek' and i.eylem = 'oku'`,
      [Y_KOKEN, kokGrup, ROL_KOKEN],
    );

    const cevap = await liste('boyut=100', kisi.erisimBelirteci);
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([...gocunYetenekleri, Y_SARTLI, Y_KOKEN]),
    );
    expect(kimlikler(cevap.kayitlar)).not.toContain(Y_SILINMIS);
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(['id', 'koken']);
    }
    const tek = await al(`${LISTE}/${Y_SARTLI}`, kisi.erisimBelirteci);
    expect(tek.status).toBe(200);
    expect(tek.body).toEqual({ id: Y_SARTLI, koken: 'yonetici' });
  });

  it('sayfa ve sonrakiVar: boyut 2 ile üç kayıt iki sayfaya bölünür', async () => {
    const ilk = await liste(`rolId=${ROL_A}&boyut=2&sayfa=1`);
    expect(ilk).toMatchObject({ sayfa: 1, boyut: 2, sonrakiVar: true });
    expect(ilk.kayitlar).toHaveLength(2);
    const ikinci = await liste(`rolId=${ROL_A}&boyut=2&sayfa=2`);
    expect(ikinci).toMatchObject({ sayfa: 2, boyut: 2, sonrakiVar: false });
    expect(ikinci.kayitlar).toHaveLength(1);
    expect(
      [...kimlikler(ilk.kayitlar), ...kimlikler(ikinci.kayitlar)].sort(),
    ).toEqual([Y_SARTLI, Y_GRUP, Y_KULLANICI]);
  });
});
