// Üyelik: listele ve tek kayıt (GV-058; TS-002 AK-38, AK-39, AK-42; izin Uyelik:oku). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-uyelik-oku.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Ek grup, rol, kullanıcı, üyelik ve yetenek
// satırları SQL ile yazılır.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const LISTE = '/kimlik/uyelik';

// Uyelik kaynağının bütün kolonları (TS-002 "Veri modeli").
const UYELIK_ALANLARI = [
  'grupId',
  'id',
  'kullaniciId',
  'olusturmaZamani',
  'rolId',
  'silinmeZamani',
];

const GRUP_2 = '90000000-0000-4000-8000-000000000001';
const ROL_2 = '91000000-0000-4000-8000-000000000001';
const KISI_1 = '92000000-0000-4000-8000-000000000001';
const KISI_2 = '92000000-0000-4000-8000-000000000002';

// SQL ile eklenen üyelikler. Oluşturma zamanları sıralamayı sınamak için sabittir.
const UY_1 = '93000000-0000-4000-8000-000000000001'; // KISI_1 · Kök · Temel
const UY_2 = '93000000-0000-4000-8000-000000000002'; // KISI_1 · GRUP_2 · ROL_2
const UY_3 = '93000000-0000-4000-8000-000000000003'; // KISI_2 · GRUP_2 · ROL_2
const UY_4 = '93000000-0000-4000-8000-000000000004'; // KISI_2 · GRUP_2 · Temel
const UY_SILINMIS = '93000000-0000-4000-8000-0000000000aa'; // KISI_2 · Kök · ROL_2, silinmiş
const EKLENENLER = [UY_1, UY_2, UY_3, UY_4];
const YOK = '93000000-0000-4000-8000-0000000000ff';

const ROL_KISI_KOLONU = '94000000-0000-4000-8000-000000000001';
const UYELIK_KISI_KOLONU = '95000000-0000-4000-8000-000000000001';
const YETENEK_KISI_KOLONU = '96000000-0000-4000-8000-000000000001';

type Kayit = Record<string, unknown>;

interface ListeCevabi {
  kayitlar: Kayit[];
  sayfa: number;
  boyut: number;
  sonrakiVar: boolean;
}

let ortam: KimlikOrtami;
let kokGrup: string;
let temelRol: string;
let superadminRol: string;

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

const sirali = (kayitlar: readonly Kayit[]): unknown[] =>
  [...kimlikler(kayitlar)].sort();

const alanlar = (kayit: Kayit): string[] => Object.keys(kayit).sort();

async function tekDeger(sql: string): Promise<string> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ id: string }>(sql);
  if (satir === undefined) {
    throw new Error(`satır yok: ${sql}`);
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
  kokGrup = await tekDeger(
    'select id from grup where ust_grup_id is null and silinme_zamani is null',
  );
  temelRol = await tekDeger("select id from rol where kod = 'temel'");
  superadminRol = await tekDeger("select id from rol where kod = 'superadmin'");

  await ortam.db.query(
    "insert into grup (id, ust_grup_id, ad) values ($1, $2, 'İkinci')",
    [GRUP_2, kokGrup],
  );
  await ortam.db.query("insert into rol (id, ad) values ($1, 'İkinci rol')", [
    ROL_2,
  ]);
  for (const [id, ad] of [
    [KISI_1, 'kisi1'],
    [KISI_2, 'kisi2'],
  ] as const) {
    await ortam.db.query(
      'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
      [id, ad],
    );
  }
  for (const [id, kisi, grup, rol, zaman, silinmis] of [
    [UY_1, KISI_1, kokGrup, temelRol, '2026-01-01T00:00:01Z', false],
    [UY_2, KISI_1, GRUP_2, ROL_2, '2026-01-01T00:00:02Z', false],
    [UY_3, KISI_2, GRUP_2, ROL_2, '2026-01-01T00:00:03Z', false],
    [UY_4, KISI_2, GRUP_2, temelRol, '2026-01-01T00:00:04Z', false],
    [UY_SILINMIS, KISI_2, kokGrup, ROL_2, '2026-01-01T00:00:05Z', true],
  ] as const) {
    await ortam.db.query(
      `insert into uyelik (id, kullanici_id, grup_id, rol_id, olusturma_zamani, silinme_zamani)
       values ($1, $2, $3, $4, $5, case when $6 then clock_timestamp() end)`,
      [id, kisi, grup, rol, zaman, silinmis],
    );
  }
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) liste', () => {
  it('ilk yönetici kendi iki üyeliğini ve SQL ile eklenenleri yalnız kaynak kolonlarıyla alır; silinmiş üyelik gelmez', async () => {
    const cevap = await liste('boyut=100');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 100, sonrakiVar: false });
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(UYELIK_ALANLARI);
      expect(kayit['silinmeZamani']).toBeNull();
    }
    const kendisi = cevap.kayitlar
      .filter((k) => k['kullaniciId'] === ortam.superadmin.id)
      .map((k) => ({ grupId: k['grupId'], rolId: k['rolId'] }));
    expect(kendisi).toHaveLength(2);
    expect(kendisi).toEqual(
      expect.arrayContaining([
        { grupId: kokGrup, rolId: temelRol },
        { grupId: kokGrup, rolId: superadminRol },
      ]),
    );
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining(EKLENENLER),
    );
    expect(kimlikler(cevap.kayitlar)).not.toContain(UY_SILINMIS);
  });

  it('sayfa ve boyut verilmezse 1 ve 20 kullanılır', async () => {
    const cevap = await liste('');
    expect(cevap).toMatchObject({ sayfa: 1, boyut: 20 });
  });

  it('oluşturma zamanına göre artan ve "-" ile azalan sıralar', async () => {
    const artan = await liste(`grupId=${GRUP_2}&sirala=olusturmaZamani`);
    expect(kimlikler(artan.kayitlar)).toEqual([UY_2, UY_3, UY_4]);
    const azalan = await liste(`grupId=${GRUP_2}&sirala=-olusturmaZamani`);
    expect(kimlikler(azalan.kayitlar)).toEqual([UY_4, UY_3, UY_2]);
  });
});

describe('b) süzgeçler', () => {
  it('kullaniciId yalnız o kişinin canlı üyeliklerini verir', async () => {
    expect(sirali((await liste(`kullaniciId=${KISI_1}`)).kayitlar)).toEqual([
      UY_1,
      UY_2,
    ]);
    expect(sirali((await liste(`kullaniciId=${KISI_2}`)).kayitlar)).toEqual([
      UY_3,
      UY_4,
    ]);
  });

  it('grupId yalnız o gruptaki canlı üyelikleri verir', async () => {
    expect(sirali((await liste(`grupId=${GRUP_2}`)).kayitlar)).toEqual([
      UY_2,
      UY_3,
      UY_4,
    ]);
  });

  it('rolId yalnız o roldeki canlı üyelikleri verir', async () => {
    expect(sirali((await liste(`rolId=${ROL_2}`)).kayitlar)).toEqual([
      UY_2,
      UY_3,
    ]);
  });

  it('iki süzgeç "ve" ile birleşir', async () => {
    expect(
      sirali((await liste(`grupId=${GRUP_2}&rolId=${temelRol}`)).kayitlar),
    ).toEqual([UY_4]);
    expect(
      sirali((await liste(`kullaniciId=${KISI_2}&rolId=${ROL_2}`)).kayitlar),
    ).toEqual([UY_3]);
  });

  it('kimlik biçiminde olmayan süzgeç 400 dogrulama_hatasi', async () => {
    for (const sorgu of ['kullaniciId=abc', 'grupId=1', 'rolId=x']) {
      const cevap = await al(
        `${LISTE}?${sorgu}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    }
  });
});

describe('c) tek kayıt', () => {
  it('tek kayıt ucu listedeki kaydın aynı kolonlarını verir', async () => {
    const { kayitlar } = await liste('boyut=100');
    for (const id of [UY_1, UY_4]) {
      const cevap = await al(
        `${LISTE}/${id}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(200);
      expect(alanlar(cevap.body as Kayit)).toEqual(UYELIK_ALANLARI);
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
    for (const yol of [LISTE, `${LISTE}/${UY_1}`]) {
      const cevap = await al(yol);
      expect(cevap.status).toBe(401);
      expect(cevap.body).toMatchObject({ kod: 'kimlik_gerekli' });
    }
  });

  it('Uyelik:oku yeteneği olmayan giriş yapmış kişi 403 yetki_yok', async () => {
    const kisi = await ortam.kullaniciAc('yetkisiz');
    for (const yol of [LISTE, `${LISTE}/${UY_1}`]) {
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
    for (const alan of ['kullaniciId', '-grupId', 'silinmeZamani']) {
      const cevap = await al(
        `${LISTE}?sirala=${alan}`,
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
    }
  });

  it('yalnız kişi kolonunu gören yetenekle kayıtlar yalnız kimlik ve kişi kolonunu taşır', async () => {
    const kisi = await ortam.kullaniciAc('kisi-kolonu-okuyucu');
    // Üyelik ve yetenek, kişinin ilk oturumlu isteğinden önce yazılır; yetkisi bunlarla derlenir.
    await ortam.db.query(
      "insert into rol (id, ad) values ($1, 'Kişi kolonu okuyucu')",
      [ROL_KISI_KOLONU],
    );
    await ortam.db.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [UYELIK_KISI_KOLONU, kisi.id, kokGrup, ROL_KISI_KOLONU],
    );
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, kolonlar, koken)
         select $1, $2, $3, i.id, true, array['kullaniciId'], 'yonetici' from izin i
          where i.kaynak = 'Uyelik' and i.eylem = 'oku'`,
      [YETENEK_KISI_KOLONU, kokGrup, ROL_KISI_KOLONU],
    );

    const cevap = await liste('boyut=100', kisi.erisimBelirteci);
    expect(kimlikler(cevap.kayitlar)).toEqual(
      expect.arrayContaining([...EKLENENLER, UYELIK_KISI_KOLONU]),
    );
    expect(kimlikler(cevap.kayitlar)).not.toContain(UY_SILINMIS);
    for (const kayit of cevap.kayitlar) {
      expect(alanlar(kayit)).toEqual(['id', 'kullaniciId']);
    }
    const tek = await al(`${LISTE}/${UY_2}`, kisi.erisimBelirteci);
    expect(tek.status).toBe(200);
    expect(tek.body).toEqual({ id: UY_2, kullaniciId: KISI_1 });
  });

  it('sayfa ve sonrakiVar: boyut 2 ile üç kayıt iki sayfaya bölünür', async () => {
    const ilk = await liste(`grupId=${GRUP_2}&boyut=2&sayfa=1`);
    expect(ilk).toMatchObject({ sayfa: 1, boyut: 2, sonrakiVar: true });
    expect(ilk.kayitlar).toHaveLength(2);
    const ikinci = await liste(`grupId=${GRUP_2}&boyut=2&sayfa=2`);
    expect(ikinci).toMatchObject({ sayfa: 2, boyut: 2, sonrakiVar: false });
    expect(ikinci.kayitlar).toHaveLength(1);
    expect(
      [...kimlikler(ilk.kayitlar), ...kimlikler(ikinci.kayitlar)].sort(),
    ).toEqual([UY_2, UY_3, UY_4]);
  });
});
