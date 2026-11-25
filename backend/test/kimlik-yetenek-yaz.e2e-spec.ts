// Yetenek: yaz ve sil (GV-069; TS-002 "İşlem sınırları", AK-39, değişmez 6, 7 ve 8; KR-008 Seçim 5,
// 7, 11, 17, 21, 34; izinler Yetenek:olustur ve Yetenek:sil). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-yetenek-yaz.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Grup, rol, üyelik ve hedef kullanıcı satırları
// SQL ile hazırlanır; yetenekler yalnız uçtan yazılır ve silinir. Her reddedilen istekte genel sayaç,
// yetenek satırları ve outbox_iz notları istekten önceki hâliyle karşılaştırılır.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YOL = '/kimlik/yetenek';

// Kimlikler: grup b1…, roller b2…, üyelik b3…, kullanıcılar b5….
const GRUP_A = 'b1000000-0000-4000-8000-000000000001';
const GRUP_SILINMIS = 'b1000000-0000-4000-8000-000000000002';
const ROL_A = 'b2000000-0000-4000-8000-000000000001';
const ROL_SILINMIS = 'b2000000-0000-4000-8000-000000000002';
const UYELIK_OKUYUCU = 'b3000000-0000-4000-8000-000000000001';
const YOK = 'b4000000-0000-4000-8000-0000000000ff';
const HEDEFLER = [
  ['b5000000-0000-4000-8000-000000000001', 'ali', 'Ali'],
  ['b5000000-0000-4000-8000-000000000002', 'veli', 'Veli'],
  ['b5000000-0000-4000-8000-000000000003', 'zeki', 'Zeki'],
] as const;

// a) maddesinin şartlı ve kolon sınırlı okuma yeteneği.
const SART = [
  { alan: 'kullaniciAdi', islec: 'listede', deger: ['ali', 'veli'] },
];
const KOLONLAR = ['gorunenAd', 'kullaniciAdi'];

type Govde = Record<string, unknown>;
type Kayit = Record<string, unknown>;

interface Durum {
  sayac: number;
  yetenek: number;
  silinmis: number;
  notlar: number;
}

interface Not {
  is_adi: string;
  kullanici_id: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

let ortam: KimlikOrtami;
let kokGrup: string;
let superadminRol: string;
let kullaniciOku: string;
let grupOlustur: string;
let okuyucu: { id: string; erisimBelirteci: string };
let sartliYetenek: string;

function yaz(govde: Govde, erisimBelirteci?: string): request.Test {
  const istek = request(ortam.app.getHttpServer()).post(YOL);
  return (
    erisimBelirteci === undefined
      ? istek
      : istek.set(ortam.basliklar(erisimBelirteci))
  ).send(govde);
}

function sil(id: string, erisimBelirteci?: string): request.Test {
  const istek = request(ortam.app.getHttpServer()).delete(`${YOL}/${id}`);
  return erisimBelirteci === undefined
    ? istek
    : istek.set(ortam.basliklar(erisimBelirteci));
}

function al(yol: string, erisimBelirteci: string): request.Test {
  return request(ortam.app.getHttpServer())
    .get(yol)
    .set(ortam.basliklar(erisimBelirteci));
}

// Varsayılan gövde: (GRUP_A, ROL_A) kümesine bütün kayıtlar ve bütün kolonlarla Kullanici:oku.
function govde(degisen: Govde = {}): Govde {
  return {
    grupId: GRUP_A,
    rolId: ROL_A,
    izinId: kullaniciOku,
    sart: null,
    butunKayitlar: true,
    butunBirimler: false,
    kolonlar: null,
    butunKolonlar: true,
    ...degisen,
  };
}

async function durum(): Promise<Durum> {
  const {
    rows: [satir],
  } = await ortam.db.query<Durum>(
    `select (select sayac from yetki_surumu where id = 1) as sayac,
            (select count(*) from yetenek)::int as yetenek,
            (select count(*) from yetenek where silinme_zamani is not null)::int as silinmis,
            (select count(*) from outbox_iz)::int as notlar`,
  );
  if (satir === undefined) {
    throw new Error('durum okunamadı');
  }
  return satir;
}

async function sayac(): Promise<number> {
  return (await durum()).sayac;
}

// İstek reddedilir: beklenen durum ve kod döner; genel sayaç, yetenek satırları ve notlar değişmez.
async function reddedilir(
  istek: () => request.Test,
  status: number,
  kod: string,
): Promise<void> {
  const once = await durum();
  const cevap = await istek();
  expect(cevap.status).toBe(status);
  expect(cevap.body).toMatchObject({ kod });
  expect(await durum()).toEqual(once);
}

async function yetenekNotu(id: string, eylem: string): Promise<Not> {
  const { rows } = await ortam.db.query<{ govde: Not }>(
    `select govde from outbox_iz
      where govde ->> 'kayit_id' = $1 and govde ->> 'eylem' = $2`,
    [id, eylem],
  );
  expect(rows).toHaveLength(1);
  return (rows[0] as { govde: Not }).govde;
}

async function yetkilerim(erisimBelirteci: string): Promise<Kayit[]> {
  const cevap = await al('/kimlik/oturum/yetkilerim', erisimBelirteci);
  expect(cevap.status).toBe(200);
  return (cevap.body as { kurallar: Kayit[] }).kurallar;
}

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
  const {
    rows: [rol],
  } = await ortam.db.query<{ id: string }>(
    "select id from rol where kod = 'superadmin'",
  );
  superadminRol = rol?.id ?? '';
  kullaniciOku = await izinKimligi('Kullanici', 'oku');
  grupOlustur = await izinKimligi('Grup', 'olustur');

  await ortam.db.query(
    `insert into grup (id, ust_grup_id, ad, silinme_zamani)
     values ($1, $3, 'Grup A', null), ($2, $3, 'Silinmiş grup', clock_timestamp())`,
    [GRUP_A, GRUP_SILINMIS, kokGrup],
  );
  await ortam.db.query(
    `insert into rol (id, ad, silinme_zamani)
     values ($1, 'Rol A', null), ($2, 'Silinmiş rol', clock_timestamp())`,
    [ROL_A, ROL_SILINMIS],
  );
  for (const [id, kullaniciAdi, gorunenAd] of HEDEFLER) {
    await ortam.db.query(
      'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $3)',
      [id, kullaniciAdi, gorunenAd],
    );
  }
  // Okuyucu (GRUP_A, ROL_A) kümesindedir; üyelik ilk oturumlu isteğinden önce yazılır.
  okuyucu = await ortam.kullaniciAc('okuyucu');
  await ortam.db.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
    [UYELIK_OKUYUCU, okuyucu.id, GRUP_A, ROL_A],
  );
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) şartlı ve kolon sınırlı okuma yeteneği', () => {
  it('yazılır: 201 ve { id }; satır yönetici kökenlidir, genel sayaç artar, not işin adını, yazanı ve kolonları taşır', async () => {
    const once = await sayac();
    const cevap = await yaz(
      govde({
        sart: SART,
        butunKayitlar: false,
        kolonlar: KOLONLAR,
        butunKolonlar: false,
      }),
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(201);
    expect(Object.keys(cevap.body as Kayit)).toEqual(['id']);
    sartliYetenek = (cevap.body as { id: string }).id;
    expect(await sayac()).toBe(once + 1);

    const {
      rows: [satir],
    } = await ortam.db.query<Kayit>(
      `select grup_id, rol_id, izin_id, sart, butun_kayitlar, butun_birimler, kolonlar,
              butun_kolonlar, sistem_satiri, silinme_zamani, tohum_anahtari, yerine_gectigi_id, koken
         from yetenek where id = $1`,
      [sartliYetenek],
    );
    expect(satir).toEqual({
      grup_id: GRUP_A,
      rol_id: ROL_A,
      izin_id: kullaniciOku,
      sart: SART,
      butun_kayitlar: false,
      butun_birimler: false,
      kolonlar: KOLONLAR,
      butun_kolonlar: false,
      sistem_satiri: false,
      silinme_zamani: null,
      tohum_anahtari: null,
      yerine_gectigi_id: null,
      koken: 'yonetici',
    });

    const not = await yetenekNotu(sartliYetenek, 'olusturma');
    expect(not).toMatchObject({
      is_adi: 'kimlik:yetenek-olustur',
      kullanici_id: ortam.superadmin.id,
      kaynak: 'Yetenek',
    });
    expect(not.degisen).toMatchObject({
      id: { yeni: sartliYetenek },
      grup_id: { yeni: GRUP_A },
      rol_id: { yeni: ROL_A },
      izin_id: { yeni: kullaniciOku },
      sart: { yeni: SART },
      kolonlar: { yeni: KOLONLAR },
      butun_kayitlar: { yeni: false },
      butun_kolonlar: { yeni: false },
      koken: { yeni: 'yonetici' },
    });
  });

  it("o kümedeki kişinin 'yetkilerim' cevabı kuralı taşır", async () => {
    const kurallar = await yetkilerim(okuyucu.erisimBelirteci);
    expect(kurallar).toContainEqual({
      yetenekId: sartliYetenek,
      action: 'oku',
      subject: 'Kullanici',
      fields: KOLONLAR,
      conditions: { AND: [{ kullaniciAdi: { in: ['ali', 'veli'] } }] },
    });
  });

  it('okuma ucunda yalnız şartın tuttuğu kayıtları, yalnız o kolonlarla (ve kimlikle) görür', async () => {
    const cevap = await al(
      '/kimlik/kullanici?boyut=100&sirala=kullaniciAdi',
      okuyucu.erisimBelirteci,
    );
    expect(cevap.status).toBe(200);
    expect((cevap.body as { kayitlar: Kayit[] }).kayitlar).toEqual([
      { id: HEDEFLER[0][0], kullaniciAdi: 'ali', gorunenAd: 'Ali' },
      { id: HEDEFLER[1][0], kullaniciAdi: 'veli', gorunenAd: 'Veli' },
    ]);
  });
});

describe('b) satırın denetimi: 400 dogrulama_hatasi, satır yazılmaz', () => {
  const belirtec = (): string => ortam.superadmin.erisimBelirteci;

  it('hem butunKayitlar hem sart', async () => {
    await reddedilir(
      () => yaz(govde({ sart: SART }), belirtec()),
      400,
      'dogrulama_hatasi',
    );
  });

  it('hem butunKolonlar hem kolonlar', async () => {
    await reddedilir(
      () => yaz(govde({ kolonlar: KOLONLAR }), belirtec()),
      400,
      'dogrulama_hatasi',
    );
  });

  it('şartta kaynağın alanı olmayan alan', async () => {
    await reddedilir(
      () =>
        yaz(
          govde({
            butunKayitlar: false,
            sart: [{ alan: 'parolaOzeti', islec: 'esit', deger: 'x' }],
          }),
          belirtec(),
        ),
      400,
      'dogrulama_hatasi',
    );
  });

  it('derleyicinin tanımadığı işleç', async () => {
    await reddedilir(
      () =>
        yaz(
          govde({
            butunKayitlar: false,
            sart: [{ alan: 'kullaniciAdi', islec: 'benzer', deger: 'a' }],
          }),
          belirtec(),
        ),
      400,
      'dogrulama_hatasi',
    );
  });

  it('kaynağın alanı olmayan kolon', async () => {
    await reddedilir(
      () =>
        yaz(
          govde({ butunKolonlar: false, kolonlar: ['gorunenAd', 'yokKolon'] }),
          belirtec(),
        ),
      400,
      'dogrulama_hatasi',
    );
  });

  it('derleyicinin derleyemediği şart (liste işlecine tek değer)', async () => {
    await reddedilir(
      () =>
        yaz(
          govde({
            butunKayitlar: false,
            sart: [{ alan: 'kullaniciAdi', islec: 'listede', deger: 'ali' }],
          }),
          belirtec(),
        ),
      400,
      'dogrulama_hatasi',
    );
  });

  it('şart değeri olarak boş liste (KR-008 Seçim 11)', async () => {
    await reddedilir(
      () =>
        yaz(
          govde({
            butunKayitlar: false,
            sart: [{ alan: 'kullaniciAdi', islec: 'listede_degil', deger: [] }],
          }),
          belirtec(),
        ),
      400,
      'dogrulama_hatasi',
    );
  });
});

describe('c) bağlanılan grup, rol ve izin', () => {
  const belirtec = (): string => ortam.superadmin.erisimBelirteci;

  it('silinmiş grup 409 cakisma', async () => {
    await reddedilir(
      () => yaz(govde({ grupId: GRUP_SILINMIS }), belirtec()),
      409,
      'cakisma',
    );
  });

  it('silinmiş rol 409 cakisma', async () => {
    await reddedilir(
      () => yaz(govde({ rolId: ROL_SILINMIS }), belirtec()),
      409,
      'cakisma',
    );
  });

  it('var olmayan izin 409 cakisma', async () => {
    await reddedilir(
      () => yaz(govde({ izinId: YOK }), belirtec()),
      409,
      'cakisma',
    );
  });
});

describe('d) yönetim yazma izinleri yalnız (Kök, SuperAdmin) kümesine', () => {
  const belirtec = (): string => ortam.superadmin.erisimBelirteci;

  it('Grup:olustur (Kök, SuperAdmin) dışındaki kümeye yazılamaz: 409 cakisma', async () => {
    for (const [grupId, rolId] of [
      [GRUP_A, ROL_A],
      [kokGrup, ROL_A],
      [GRUP_A, superadminRol],
    ]) {
      await reddedilir(
        () => yaz(govde({ grupId, rolId, izinId: grupOlustur }), belirtec()),
        409,
        'cakisma',
      );
    }
  });

  it('Grup:olustur (Kök, SuperAdmin) kümesine yazılır', async () => {
    const cevap = await yaz(
      govde({ grupId: kokGrup, rolId: superadminRol, izinId: grupOlustur }),
      belirtec(),
    );
    expect(cevap.status).toBe(201);
  });

  it('Kullanici:oku başka kümeye yazılır', async () => {
    const once = await sayac();
    const cevap = await yaz(govde(), belirtec());
    expect(cevap.status).toBe(201);
    expect(await sayac()).toBe(once + 1);
  });
});

describe('e) sil', () => {
  it('yetenek silinir: 204; satır silinmiş işaretlidir, genel sayaç artar, not işin adını, yazanı ve kolonları taşır', async () => {
    const once = await sayac();
    const cevap = await sil(sartliYetenek, ortam.superadmin.erisimBelirteci);
    expect(cevap.status).toBe(204);
    expect(cevap.body).toEqual({});
    expect(await sayac()).toBe(once + 1);
    const {
      rows: [satir],
    } = await ortam.db.query<{ silinme_zamani: Date | null }>(
      'select silinme_zamani from yetenek where id = $1',
      [sartliYetenek],
    );
    expect(satir?.silinme_zamani).toBeInstanceOf(Date);

    const not = await yetenekNotu(sartliYetenek, 'silme');
    expect(not).toMatchObject({
      is_adi: 'kimlik:yetenek-sil',
      kullanici_id: ortam.superadmin.id,
      kaynak: 'Yetenek',
    });
    expect(not.degisen).toMatchObject({
      id: { eski: sartliYetenek },
      sart: { eski: SART },
      kolonlar: { eski: KOLONLAR },
      koken: { eski: 'yonetici' },
      silinme_zamani: { eski: null },
    });
  });

  it("'yetkilerim' kuralı artık taşımaz", async () => {
    const kurallar = await yetkilerim(okuyucu.erisimBelirteci);
    expect(kurallar.map((kural) => kural['yetenekId'])).not.toContain(
      sartliYetenek,
    );
  });

  it('silinmiş yetenek yeniden silinmez: 404 bulunamadi', async () => {
    await reddedilir(
      () => sil(sartliYetenek, ortam.superadmin.erisimBelirteci),
      404,
      'bulunamadi',
    );
  });
});

describe('f) sistem satırı', () => {
  it('tohumun yazdığı sistem satırı silinemez: 409 cakisma', async () => {
    const {
      rows: [satir],
    } = await ortam.db.query<{ id: string }>(
      "select id from yetenek where tohum_anahtari = 'kimlik:Yetenek:sil:superadmin'",
    );
    await reddedilir(
      () => sil(satir?.id ?? '', ortam.superadmin.erisimBelirteci),
      409,
      'cakisma',
    );
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    await reddedilir(() => yaz(govde()), 401, 'kimlik_gerekli');
    await reddedilir(() => sil(YOK), 401, 'kimlik_gerekli');
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok ve hiçbir satır değişmez', async () => {
    const {
      rows: [satir],
    } = await ortam.db.query<{ id: string }>(
      "select id from yetenek where koken = 'yonetici' and silinme_zamani is null limit 1",
    );
    // Okuyucunun yalnız Kullanici:oku yeteneği vardır.
    await reddedilir(
      () => yaz(govde(), okuyucu.erisimBelirteci),
      403,
      'yetki_yok',
    );
    await reddedilir(
      () => sil(satir?.id ?? '', okuyucu.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('var olmayan kimlik 404 bulunamadi', async () => {
    await reddedilir(
      () => sil(YOK, ortam.superadmin.erisimBelirteci),
      404,
      'bulunamadi',
    );
  });

  it('şemaya uymayan gövde ve yol parametresi 400 dogrulama_hatasi', async () => {
    const belirtec = ortam.superadmin.erisimBelirteci;
    const eksik = Object.fromEntries(
      Object.entries(govde()).filter(([alan]) => alan !== 'butunBirimler'),
    );
    for (const bozuk of [
      govde({ grupId: 'abc' }),
      govde({ butunKayitlar: 'evet' }),
      govde({ sart: [] }),
      govde({ butunKolonlar: false, kolonlar: [] }),
      govde({ butunKayitlar: false, sart: [{ alan: 'kullaniciAdi' }] }),
      eksik,
    ]) {
      await reddedilir(() => yaz(bozuk, belirtec), 400, 'dogrulama_hatasi');
    }
    await reddedilir(() => sil('abc', belirtec), 400, 'dogrulama_hatasi');
  });

  it('şemada olmayan alan 400 dogrulama_hatasi', async () => {
    const belirtec = ortam.superadmin.erisimBelirteci;
    for (const fazla of [
      { koken: 'goc' },
      { sistemSatiri: true },
      { tohumAnahtari: 'x' },
      { id: YOK },
    ]) {
      await reddedilir(
        () => yaz(govde(fazla), belirtec),
        400,
        'dogrulama_hatasi',
      );
    }
  });
});
