// Kullanıcı: listele ve tek kayıt (GV-055; TS-002 AK-38, AK-39; izin Kullanici:oku). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-kullanici-oku.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Ek kullanıcılar, rol, üyelik ve yetenek
// satırları SQL ile yazılır.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const LISTE = '/kimlik/kullanici';

// Kullanici kaynağının bütün kolonları (TS-002 "Veri modeli"); kaynak olmayan tabloların
// (kullanici_sirri gibi) hiçbir alanı burada yoktur.
const KULLANICI_ALANLARI = [
  'gorunenAd',
  'id',
  'kullaniciAdi',
  'olusturmaZamani',
  'pasifZamani',
  'sistemAktoru',
  'telefon',
  'unutulmaZamani',
  'yetkiSurumu',
];

const AKTIF_1 = '80000000-0000-4000-8000-000000000001';
const AKTIF_2 = '80000000-0000-4000-8000-000000000002';
const PASIF_A = '80000000-0000-4000-8000-00000000000a';
const PASIF_B = '80000000-0000-4000-8000-00000000000b';
const PASIF_C = '80000000-0000-4000-8000-00000000000c';
const PASIFLER = [PASIF_A, PASIF_B, PASIF_C];
const YOK = '80000000-0000-4000-8000-0000000000ff';

const ROL_GORUNEN_AD = '82000000-0000-4000-8000-000000000001';
const UYELIK_GORUNEN_AD = '83000000-0000-4000-8000-000000000001';
const YETENEK_GORUNEN_AD = '84000000-0000-4000-8000-000000000001';

type Kayit = Record<string, unknown>;

interface ListeCevabi {
  kayitlar: Kayit[];
  sayfa: number;
  boyut: number;
  sonrakiVar: boolean;
}

let ortam: KimlikOrtami;
let sistemAktoru: string;

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
  for (const [id, ad, pasif] of [
    [AKTIF_1, 'aktif1', false],
    [AKTIF_2, 'aktif2', false],
    [PASIF_A, 'Pasif A', true],
    [PASIF_B, 'Pasif B', true],
    [PASIF_C, 'Pasif C', true],
  ] as const) {
    await ortam.db.query(
      `insert into kullanici (id, kullanici_adi, gorunen_ad, pasif_zamani)
       values ($1, $2, $2, case when $3 then clock_timestamp() end)`,
      [id, ad, pasif],
    );
  }
  const {
    rows: [aktor],
  } = await ortam.db.query<{ id: string }>(
    'select id from kullanici where sistem_aktoru',
  );
  sistemAktoru = aktor?.id ?? '';
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) liste', () => {
  it('ilk yönetici kendi kaydını, sistem aktörünü ve SQL ile eklenenleri yalnız kaynak kolonlarıyla alır', async () => {
    const cevap = await liste('boyut=100');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 100, sonrakiVar: false });
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([
        ortam.superadmin.id,
        sistemAktoru,
        AKTIF_1,
        AKTIF_2,
        ...PASIFLER,
      ]),
    );
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(KULLANICI_ALANLARI);
    }
    expect(
      cevap.kayitlar.find((k) => k['id'] === ortam.superadmin.id),
    ).toMatchObject({ kullaniciAdi: 'superadmin', sistemAktoru: false });
  });

  it('sayfa ve boyut verilmezse 1 ve 20 kullanılır', async () => {
    const cevap = await liste('');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 20, sonrakiVar: false });
  });

  it('sıralama alanına göre artan ve "-" ile azalan sıralar', async () => {
    const artan = await liste('pasif=true&sirala=gorunenAd');
    expect(artan.kayitlar.map((k) => k['gorunenAd'])).toEqual([
      'Pasif A',
      'Pasif B',
      'Pasif C',
    ]);
    const azalan = await liste('pasif=true&sirala=-gorunenAd');
    expect(azalan.kayitlar.map((k) => k['gorunenAd'])).toEqual([
      'Pasif C',
      'Pasif B',
      'Pasif A',
    ]);
  });
});

describe('b) pasif süzgeci', () => {
  it('pasif=true yalnız pasif zamanı dolu kişileri verir', async () => {
    const cevap = await liste('pasif=true&boyut=100');
    expect([...kimlikler(cevap.kayitlar)].sort()).toEqual(PASIFLER);
    for (const kayit of cevap.kayitlar) {
      expect(kayit['pasifZamani']).not.toBeNull();
    }
  });

  it('pasif=false yalnız pasif zamanı boş kişileri verir', async () => {
    const cevap = await liste('pasif=false&boyut=100');
    const idler = kimlikler(cevap.kayitlar);
    expect(idler).toEqual(
      expect.arrayContaining([
        ortam.superadmin.id,
        sistemAktoru,
        AKTIF_1,
        AKTIF_2,
      ]),
    );
    for (const id of PASIFLER) {
      expect(idler).not.toContain(id);
    }
    for (const kayit of cevap.kayitlar) {
      expect(kayit['pasifZamani']).toBeNull();
    }
  });

  it('true ya da false dışındaki değer 400 dogrulama_hatasi', async () => {
    const cevap = await al(
      `${LISTE}?pasif=evet`,
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(400);
    expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
  });
});

describe('c) tek kayıt', () => {
  it('tek kayıt ucu listedeki kaydın aynı kolonlarını verir', async () => {
    const { kayitlar } = await liste('boyut=100');
    for (const id of [ortam.superadmin.id, PASIF_A, sistemAktoru]) {
      const cevap = await al(
        `${LISTE}/${id}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(200);
      expect(alanlar(cevap.body as Kayit)).toEqual(KULLANICI_ALANLARI);
      expect(cevap.body).toEqual(kayitlar.find((k) => k['id'] === id));
    }
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
    for (const yol of [LISTE, `${LISTE}/${AKTIF_1}`]) {
      const cevap = await al(yol);
      expect(cevap.status).toBe(401);
      expect(cevap.body).toMatchObject({ kod: 'kimlik_gerekli' });
    }
  });

  it('Kullanici:oku yeteneği olmayan giriş yapmış kişi 403 yetki_yok', async () => {
    const kisi = await ortam.kullaniciAc('yetkisiz');
    for (const yol of [LISTE, `${LISTE}/${AKTIF_1}`]) {
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
    for (const alan of ['telefon', '-yetkiSurumu', 'parolaOzeti']) {
      const cevap = await al(
        `${LISTE}?sirala=${alan}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    }
  });

  it('yalnız görünen adı gören yetenekle kayıtlar yalnız kimlik ve görünen adı taşır', async () => {
    const kisi = await ortam.kullaniciAc('gorunen-ad-okuyucu');
    // Üyelik ve yetenek, kişinin ilk oturumlu isteğinden önce yazılır; yetkisi bunlarla derlenir.
    await ortam.db.query(
      "insert into rol (id, ad) values ($1, 'Görünen ad okuyucu')",
      [ROL_GORUNEN_AD],
    );
    await ortam.db.query(
      `insert into uyelik (id, kullanici_id, grup_id, rol_id)
         select $1, $2, g.id, $3 from grup g
          where g.ust_grup_id is null and g.silinme_zamani is null`,
      [UYELIK_GORUNEN_AD, kisi.id, ROL_GORUNEN_AD],
    );
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, kolonlar, koken)
         select $1, g.id, $2, i.id, true, array['gorunenAd'], 'yonetici' from grup g, izin i
          where g.ust_grup_id is null and g.silinme_zamani is null
            and i.kaynak = 'Kullanici' and i.eylem = 'oku'`,
      [YETENEK_GORUNEN_AD, ROL_GORUNEN_AD],
    );

    const cevap = await liste('boyut=100', kisi.erisimBelirteci);
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([ortam.superadmin.id, AKTIF_1, kisi.id]),
    );
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(['gorunenAd', 'id']);
    }
    const tek = await al(
      `${LISTE}/${ortam.superadmin.id}`,
      kisi.erisimBelirteci,
    );
    expect(tek.status).toBe(200);
    expect(tek.body).toEqual({
      id: ortam.superadmin.id,
      gorunenAd: 'Sistem Yöneticisi',
    });
  });

  it('sayfa ve sonrakiVar: boyut 2 ile üç kayıt iki sayfaya bölünür', async () => {
    const ilk = await liste('pasif=true&boyut=2&sayfa=1');
    expect(ilk).toMatchObject({ sayfa: 1, boyut: 2, sonrakiVar: true });
    expect(ilk.kayitlar).toHaveLength(2);
    const ikinci = await liste('pasif=true&boyut=2&sayfa=2');
    expect(ikinci).toMatchObject({ sayfa: 2, boyut: 2, sonrakiVar: false });
    expect(ikinci.kayitlar).toHaveLength(1);
    expect(
      [...kimlikler(ilk.kayitlar), ...kimlikler(ikinci.kayitlar)].sort(),
    ).toEqual(PASIFLER);
  });
});
