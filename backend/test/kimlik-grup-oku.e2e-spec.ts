// Grup: ağacı oku ve tek kayıt (GV-057; TS-002 AK-38, AK-39; izin Grup:oku). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-grup-oku.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Alt gruplar, rol, üyelik ve yetenek satırları
// SQL ile yazılır. Canlılık süzgeci bu görevde yoktur (TS-002 AK-42); silinmiş grup burada sınanmaz.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const LISTE = '/kimlik/grup';

// Grup kaynağının bütün kolonları (TS-002 "Veri modeli").
const GRUP_ALANLARI = [
  'ad',
  'id',
  'olusturmaZamani',
  'silinmeZamani',
  'ustGrupId',
];

// Kökün doğrudan altındakiler (bu sırayla eklenir) ve A'nın altındaki torun.
const ALT_A = '90000000-0000-4000-8000-00000000000a';
const ALT_B = '90000000-0000-4000-8000-00000000000b';
const ALT_C = '90000000-0000-4000-8000-00000000000c';
const TORUN = '90000000-0000-4000-8000-0000000000aa';
const KOK_ALTI = [ALT_A, ALT_B, ALT_C];
const YOK = '90000000-0000-4000-8000-0000000000ff';

const ROL_SARTLI = '92000000-0000-4000-8000-000000000001';
const ROL_AD = '92000000-0000-4000-8000-000000000002';

type Kayit = Record<string, unknown>;

interface ListeCevabi {
  kayitlar: Kayit[];
  sayfa: number;
  boyut: number;
  sonrakiVar: boolean;
}

let ortam: KimlikOrtami;
let kok: string;

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

// Kişiyi verilen grupta yeni bir role üye yapar ve o (grup, rol) kümesine Grup:oku yeteneği yazar.
// Şartsız yetenek bütün kayıtları, kolon listesiz yetenek bütün kolonları açar. Kişinin ilk oturumlu
// isteğinden önce çağrılır; yetkisi bu satırlarla derlenir.
async function grupOkumaVer(
  kullaniciId: string,
  grupId: string,
  rolId: string,
  { sart, kolonlar }: { sart?: unknown; kolonlar?: readonly string[] },
): Promise<void> {
  await ortam.db.query('insert into rol (id, ad) values ($1, $2)', [
    rolId,
    `Grup okuyucu ${rolId}`,
  ]);
  await ortam.db.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id)
     values (gen_random_uuid(), $1, $2, $3)`,
    [kullaniciId, grupId, rolId],
  );
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, koken)
     select gen_random_uuid(), $1, $2, i.id, $3::jsonb, $3::jsonb is null, $4,
            $4::text[] is null, 'yonetici'
       from izin i where i.kaynak = 'Grup' and i.eylem = 'oku'`,
    [
      grupId,
      rolId,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
    ],
  );
}

beforeAll(async () => {
  ortam = await kimlikOrtamiKur();
  const {
    rows: [satir],
  } = await ortam.db.query<{ id: string }>(
    'select id from grup where ust_grup_id is null and silinme_zamani is null',
  );
  kok = satir?.id ?? '';
  for (const [id, ust, ad] of [
    [ALT_A, kok, 'Alt A'],
    [ALT_B, kok, 'Alt B'],
    [ALT_C, kok, 'Alt C'],
    [TORUN, ALT_A, 'Torun'],
  ] as const) {
    await ortam.db.query(
      'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
      [id, ust, ad],
    );
  }
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) liste', () => {
  it('ilk yönetici kök grubu ve SQL ile eklenen alt grupları bütün kolonlarıyla alır', async () => {
    const cevap = await liste('boyut=100');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 100, sonrakiVar: false });
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([kok, ...KOK_ALTI, TORUN]),
    );
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(GRUP_ALANLARI);
    }
    expect(cevap.kayitlar.find((k) => k['id'] === kok)).toMatchObject({
      ad: 'Kök',
      ustGrupId: null,
    });
    expect(cevap.kayitlar.find((k) => k['id'] === TORUN)).toMatchObject({
      ad: 'Torun',
      ustGrupId: ALT_A,
    });
  });

  it('sayfa ve boyut verilmezse 1 ve 20 kullanılır', async () => {
    const cevap = await liste('');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 20, sonrakiVar: false });
  });

  it('ad ve oluşturma zamanına göre artan ve "-" ile azalan sıralar', async () => {
    const adArtan = await liste(`ustGrupId=${kok}&sirala=ad`);
    expect(adArtan.kayitlar.map((k) => k['ad'])).toEqual([
      'Alt A',
      'Alt B',
      'Alt C',
    ]);
    const adAzalan = await liste(`ustGrupId=${kok}&sirala=-ad`);
    expect(adAzalan.kayitlar.map((k) => k['ad'])).toEqual([
      'Alt C',
      'Alt B',
      'Alt A',
    ]);
    const zamanAzalan = await liste(`ustGrupId=${kok}&sirala=-olusturmaZamani`);
    expect(kimlikler(zamanAzalan.kayitlar)).toEqual([ALT_C, ALT_B, ALT_A]);
  });
});

describe('b) ustGrupId süzgeci', () => {
  it('yalnız verilen grubun doğrudan altındakileri verir', async () => {
    const kokun = await liste(`ustGrupId=${kok}&boyut=100`);
    expect([...kimlikler(kokun.kayitlar)].sort()).toEqual(KOK_ALTI);
    const anin = await liste(`ustGrupId=${ALT_A}&boyut=100`);
    expect(kimlikler(anin.kayitlar)).toEqual([TORUN]);
    const torunun = await liste(`ustGrupId=${TORUN}&boyut=100`);
    expect(torunun.kayitlar).toEqual([]);
  });

  it('kimlik biçiminde olmayan ustGrupId 400 dogrulama_hatasi', async () => {
    const cevap = await al(
      `${LISTE}?ustGrupId=abc`,
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(400);
    expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
  });
});

describe('c) şartlı yetenek', () => {
  it('yeteneği A grubu ve altıyla sınırlı kişi yalnız A ile torununu görür', async () => {
    const kisi = await ortam.kullaniciAc('sartli-grup-okuyucu');
    await grupOkumaVer(kisi.id, ALT_A, ROL_SARTLI, {
      sart: [
        {
          alan: 'id',
          islec: 'listede',
          deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
        },
      ],
    });

    const cevap = await liste('boyut=100', kisi.erisimBelirteci);
    expect([...kimlikler(cevap.kayitlar)].sort()).toEqual([ALT_A, TORUN]);
    const tek = await al(`${LISTE}/${TORUN}`, kisi.erisimBelirteci);
    expect(tek.status).toBe(200);
    expect(tek.body).toMatchObject({ id: TORUN, ad: 'Torun' });
    for (const id of [kok, ALT_B]) {
      const gorulmeyen = await al(`${LISTE}/${id}`, kisi.erisimBelirteci);
      expect(gorulmeyen.status).toBe(404);
      expect(gorulmeyen.body).toMatchObject({ kod: 'bulunamadi' });
    }
  });
});

describe('d) tek kayıt', () => {
  it('tek kayıt ucu listedeki kaydın aynı kolonlarını verir', async () => {
    const { kayitlar } = await liste('boyut=100');
    for (const id of [kok, TORUN]) {
      const cevap = await al(
        `${LISTE}/${id}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(200);
      expect(alanlar(cevap.body as Kayit)).toEqual(GRUP_ALANLARI);
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
    for (const yol of [LISTE, `${LISTE}/${ALT_A}`]) {
      const cevap = await al(yol);
      expect(cevap.status).toBe(401);
      expect(cevap.body).toMatchObject({ kod: 'kimlik_gerekli' });
    }
  });

  it('Grup:oku yeteneği olmayan giriş yapmış kişi 403 yetki_yok', async () => {
    const kisi = await ortam.kullaniciAc('yetkisiz');
    for (const yol of [LISTE, `${LISTE}/${ALT_A}`]) {
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
    for (const alan of ['ustGrupId', '-silinmeZamani', 'yok']) {
      const cevap = await al(
        `${LISTE}?sirala=${alan}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    }
  });

  it('yalnız adı gören yetenekle kayıtlar yalnız kimlik ve adı taşır', async () => {
    const kisi = await ortam.kullaniciAc('ad-okuyucu');
    await grupOkumaVer(kisi.id, kok, ROL_AD, { kolonlar: ['ad'] });

    const cevap = await liste('boyut=100', kisi.erisimBelirteci);
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([kok, ...KOK_ALTI, TORUN]),
    );
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(['ad', 'id']);
    }
    const tek = await al(`${LISTE}/${kok}`, kisi.erisimBelirteci);
    expect(tek.status).toBe(200);
    expect(tek.body).toEqual({ id: kok, ad: 'Kök' });
  });

  it('sayfa ve sonrakiVar: boyut 2 ile üç kayıt iki sayfaya bölünür', async () => {
    const ilk = await liste(`ustGrupId=${kok}&boyut=2&sayfa=1`);
    expect(ilk).toMatchObject({ sayfa: 1, boyut: 2, sonrakiVar: true });
    expect(ilk.kayitlar).toHaveLength(2);
    const ikinci = await liste(`ustGrupId=${kok}&boyut=2&sayfa=2`);
    expect(ikinci).toMatchObject({ sayfa: 2, boyut: 2, sonrakiVar: false });
    expect(ikinci.kayitlar).toHaveLength(1);
    expect(
      [...kimlikler(ilk.kayitlar), ...kimlikler(ikinci.kayitlar)].sort(),
    ).toEqual(KOK_ALTI);
  });
});
