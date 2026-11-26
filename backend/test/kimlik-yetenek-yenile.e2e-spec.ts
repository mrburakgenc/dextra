// Yetenek: yenile (GV-070; TS-002 "İşlem sınırları", "Durum geçişleri", AK-39, AK-46 ve eki, değişmez
// 6; izinler Yetenek:yenile ve yeni satır için Yetenek:olustur). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-yetenek-yenile.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Grup, rol, üyelik ve yenilenecek yetenek
// satırları ile sınanan kişilerin yetenekleri SQL ile hazırlanır. Her reddedilen istekte genel sayaç,
// yetenek satırlarının tamamı ve outbox_iz notları istekten önceki hâliyle karşılaştırılır.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';
import { yasakKisitiniBaglantiylaDusur } from './yardimci/yasak-kisiti.js';

const YOL = '/kimlik/yetenek';

// Kimlikler: grup c1…, roller c2…, üyelikler c3…, yetenekler c4….
const GRUP_A = 'c1000000-0000-4000-8000-000000000001';
const ROL_A = 'c2000000-0000-4000-8000-000000000001';
const ROL_YENILEYICI = 'c2000000-0000-4000-8000-000000000002';
const ROL_KOLONSUZ = 'c2000000-0000-4000-8000-000000000003';
const ROL_IKISI = 'c2000000-0000-4000-8000-000000000004';
// (GRUP_A, ROL_A) kümesine Kullanici:oku veren, yöneticinin yazdığı satırlar.
const Y_A = 'c4000000-0000-4000-8000-000000000001';
const Y_B = 'c4000000-0000-4000-8000-000000000002';
const Y_C = 'c4000000-0000-4000-8000-000000000003';
// Tohum anahtarı olmayan sistem satırı ve sistem satırı olmayan tohum satırı.
const Y_SISTEM = 'c4000000-0000-4000-8000-000000000004';
const Y_TOHUM = 'c4000000-0000-4000-8000-000000000005';
const YOK = 'c4000000-0000-4000-8000-0000000000ff';

// a) maddesinin yeni içeriği: şartlı ve kolon sınırlı.
const SART = [
  { alan: 'kullaniciAdi', islec: 'listede', deger: ['ali', 'veli'] },
];
const KOLONLAR = ['gorunenAd', 'kullaniciAdi'];

// Yetenek modelinin sistemSatiri dışındaki alanları (kolon sınırlı okuma yeteneği).
const SISTEM_SATIRI_DISINDA = [
  'id',
  'grupId',
  'rolId',
  'izinId',
  'sart',
  'butunKayitlar',
  'butunBirimler',
  'kolonlar',
  'butunKolonlar',
  'silinmeZamani',
  'tohumAnahtari',
  'yerineGectigiId',
  'koken',
  'olusturmaZamani',
];

type Govde = Record<string, unknown>;
type Kayit = Record<string, unknown>;

interface Durum {
  sayac: number;
  yetenek: number;
  silinmis: number;
  ozet: string;
  notlar: number;
}

interface Not {
  is_adi: string;
  kullanici_id: string;
  yetenek_id: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

let ortam: KimlikOrtami;
let kokGrup: string;
let kullaniciOku: string;
let okuyucu: { id: string; erisimBelirteci: string };
let yenileyici: { id: string; erisimBelirteci: string };
let kolonsuz: { id: string; erisimBelirteci: string };
let ikisi: { id: string; erisimBelirteci: string };
// ikisi kişisinin Yetenek:yenile ve Yetenek:olustur yetenekleri.
let ikisininYenilemesi: string;
let ikisininOlusturmasi: string;

function yenile(
  id: string,
  govde: Govde,
  erisimBelirteci?: string,
): request.Test {
  const istek = request(ortam.app.getHttpServer()).post(`${YOL}/${id}/yenile`);
  return (
    erisimBelirteci === undefined
      ? istek
      : istek.set(ortam.basliklar(erisimBelirteci))
  ).send(govde);
}

// Varsayılan içerik: bütün kayıtlar ve bütün kolonlar.
function icerik(degisen: Govde = {}): Govde {
  return {
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
            (select md5(string_agg(y::text, ',' order by y.id)) from yetenek y) as ozet,
            (select count(*) from outbox_iz)::int as notlar`,
  );
  if (satir === undefined) {
    throw new Error('durum okunamadı');
  }
  return satir;
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
  const cevap = await request(ortam.app.getHttpServer())
    .get('/kimlik/oturum/yetkilerim')
    .set(ortam.basliklar(erisimBelirteci));
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

async function tohumSatiri(anahtar: string): Promise<string> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ id: string }>(
    'select id from yetenek where tohum_anahtari = $1',
    [anahtar],
  );
  if (satir === undefined) {
    throw new Error(`tohum ${anahtar} satırını yazmadı`);
  }
  return satir.id;
}

// Bütün kayıtlarla verilen yetenek; kolonlar verilirse yalnız onlar, verilmezse bütün kolonlar.
async function yetenekVer(
  rolId: string,
  izinId: string,
  kolonlar?: readonly string[],
): Promise<string> {
  const {
    rows: [satir],
  } = await ortam.db.query<{ id: string }>(
    `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, kolonlar, butun_kolonlar, koken)
     values (gen_random_uuid(), $1, $2, $3, true, $4, $5, 'yonetici') returning id`,
    [GRUP_A, rolId, izinId, kolonlar ?? null, kolonlar === undefined],
  );
  return satir?.id ?? '';
}

async function uyeYap(kullaniciId: string, rolId: string): Promise<void> {
  await ortam.db.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id) values (gen_random_uuid(), $1, $2, $3)',
    [kullaniciId, GRUP_A, rolId],
  );
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
  const yetenekOku = await izinKimligi('Yetenek', 'oku');
  const yetenekYenile = await izinKimligi('Yetenek', 'yenile');
  const yetenekOlustur = await izinKimligi('Yetenek', 'olustur');
  const izinOku = await izinKimligi('Izin', 'oku');

  await ortam.db.query(
    "insert into grup (id, ust_grup_id, ad) values ($1, $2, 'Grup A')",
    [GRUP_A, kokGrup],
  );
  for (const [id, ad] of [
    [ROL_A, 'Rol A'],
    [ROL_YENILEYICI, 'Yalnız yenileyen'],
    [ROL_KOLONSUZ, 'Sistem işaretini göremeyen'],
    [ROL_IKISI, 'Yenileyen ve oluşturan'],
  ]) {
    await ortam.db.query('insert into rol (id, ad) values ($1, $2)', [id, ad]);
  }
  for (const id of [Y_A, Y_B, Y_C]) {
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, koken)
       values ($1, $2, $3, $4, true, true, 'yonetici')`,
      [id, GRUP_A, ROL_A, kullaniciOku],
    );
  }
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, sistem_satiri,
                          tohum_anahtari, koken)
     values ($1, $3, $4, $5, true, true, true, null, 'goc'),
            ($2, $3, $4, $5, true, true, false, 'deneme:Kullanici:oku', 'goc')`,
    [Y_SISTEM, Y_TOHUM, GRUP_A, ROL_A, kullaniciOku],
  );

  // Yalnız yenileyen: yetenekleri okur ve yeniler, izinleri okur; oluşturamaz.
  await yetenekVer(ROL_YENILEYICI, yetenekOku);
  await yetenekVer(ROL_YENILEYICI, yetenekYenile);
  await yetenekVer(ROL_YENILEYICI, izinOku);
  // Sistem işaretini göremeyen: yenileyip oluşturabilir, ama yetenekleri sistemSatiri kolonu olmadan okur.
  await yetenekVer(ROL_KOLONSUZ, yetenekOku, SISTEM_SATIRI_DISINDA);
  await yetenekVer(ROL_KOLONSUZ, yetenekYenile);
  await yetenekVer(ROL_KOLONSUZ, yetenekOlustur);
  await yetenekVer(ROL_KOLONSUZ, izinOku);
  // İki yeteneği de olan: yenileyici ile aynı, ayrıca oluşturur.
  await yetenekVer(ROL_IKISI, yetenekOku);
  ikisininYenilemesi = await yetenekVer(ROL_IKISI, yetenekYenile);
  ikisininOlusturmasi = await yetenekVer(ROL_IKISI, yetenekOlustur);
  await yetenekVer(ROL_IKISI, izinOku);

  // Üyelikler kişilerin ilk oturumlu isteğinden önce yazılır; yetkileri bunlarla derlenir.
  okuyucu = await ortam.kullaniciAc('okuyucu');
  await uyeYap(okuyucu.id, ROL_A);
  yenileyici = await ortam.kullaniciAc('yenileyici');
  await uyeYap(yenileyici.id, ROL_YENILEYICI);
  kolonsuz = await ortam.kullaniciAc('kolonsuz');
  await uyeYap(kolonsuz.id, ROL_KOLONSUZ);
  ikisi = await ortam.kullaniciAc('ikisi');
  await uyeYap(ikisi.id, ROL_IKISI);
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) yenileme', () => {
  let yeni: string;

  it("o kümedeki kişinin 'yetkilerim' cevabı önce eski kuralı taşır", async () => {
    const kurallar = await yetkilerim(okuyucu.erisimBelirteci);
    expect(kurallar.map((kural) => kural['yetenekId'])).toContain(Y_A);
  });

  it('yenilenir: 201 ve { id }; eski satır silinmiş, yeni satır aynı grup, rol ve izinle, yeni içerikle ve yerineGectigiId ile yazılır; genel sayaç bir artar', async () => {
    const once = await durum();
    const cevap = await yenile(
      Y_A,
      icerik({
        sart: SART,
        butunKayitlar: false,
        kolonlar: KOLONLAR,
        butunKolonlar: false,
      }),
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(201);
    expect(Object.keys(cevap.body as Kayit)).toEqual(['id']);
    yeni = (cevap.body as { id: string }).id;
    expect(yeni).not.toBe(Y_A);

    const sonra = await durum();
    expect(sonra.sayac).toBe(once.sayac + 1);
    expect(sonra.yetenek).toBe(once.yetenek + 1);
    expect(sonra.silinmis).toBe(once.silinmis + 1);

    const {
      rows: [eski],
    } = await ortam.db.query<{ silinme_zamani: Date | null }>(
      'select silinme_zamani from yetenek where id = $1',
      [Y_A],
    );
    expect(eski?.silinme_zamani).toBeInstanceOf(Date);

    const {
      rows: [satir],
    } = await ortam.db.query<Kayit>(
      `select grup_id, rol_id, izin_id, sart, butun_kayitlar, butun_birimler, kolonlar,
              butun_kolonlar, sistem_satiri, silinme_zamani, tohum_anahtari, yerine_gectigi_id, koken
         from yetenek where id = $1`,
      [yeni],
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
      yerine_gectigi_id: Y_A,
      koken: 'yonetici',
    });
  });

  it('iki not yazılır: eski satırın kapatılması Yetenek:yenile, yeni satır Yetenek:olustur yeteneğiyle; ikisi de işin adını, yazanı ve değişen kolonları taşır', async () => {
    const kapatma = await yetenekNotu(Y_A, 'guncelleme');
    expect(kapatma).toMatchObject({
      is_adi: 'kimlik:yetenek-yenile',
      kullanici_id: ortam.superadmin.id,
      yetenek_id: await tohumSatiri('kimlik:Yetenek:yenile:superadmin'),
      kaynak: 'Yetenek',
    });
    expect(Object.keys(kapatma.degisen)).toEqual(['silinme_zamani']);
    expect(kapatma.degisen['silinme_zamani']?.eski).toBeNull();
    expect(typeof kapatma.degisen['silinme_zamani']?.yeni).toBe('string');

    const olusturma = await yetenekNotu(yeni, 'olusturma');
    expect(olusturma).toMatchObject({
      is_adi: 'kimlik:yetenek-yenile',
      kullanici_id: ortam.superadmin.id,
      yetenek_id: await tohumSatiri('kimlik:Yetenek:olustur:superadmin'),
      kaynak: 'Yetenek',
    });
    expect(olusturma.degisen).toMatchObject({
      id: { yeni },
      grup_id: { yeni: GRUP_A },
      rol_id: { yeni: ROL_A },
      izin_id: { yeni: kullaniciOku },
      sart: { yeni: SART },
      kolonlar: { yeni: KOLONLAR },
      butun_kayitlar: { yeni: false },
      butun_kolonlar: { yeni: false },
      yerine_gectigi_id: { yeni: Y_A },
      koken: { yeni: 'yonetici' },
    });
  });

  it("o kümedeki kişinin 'yetkilerim' cevabı yeni kuralı taşır, eskisini taşımaz", async () => {
    const kurallar = await yetkilerim(okuyucu.erisimBelirteci);
    expect(kurallar).toContainEqual({
      yetenekId: yeni,
      action: 'oku',
      subject: 'Kullanici',
      fields: KOLONLAR,
      conditions: { AND: [{ kullaniciAdi: { in: ['ali', 'veli'] } }] },
    });
    expect(kurallar.map((kural) => kural['yetenekId'])).not.toContain(Y_A);
  });

  it('Yetenek:yenile ve Yetenek:olustur yeteneği olan başka bir kişi de yeniler; notlar onun yetenekleriyle yazılır', async () => {
    const once = await durum();
    const cevap = await yenile(Y_C, icerik(), ikisi.erisimBelirteci);
    expect(cevap.status).toBe(201);
    const yeniC = (cevap.body as { id: string }).id;
    expect((await durum()).sayac).toBe(once.sayac + 1);
    expect(await yetenekNotu(Y_C, 'guncelleme')).toMatchObject({
      kullanici_id: ikisi.id,
      yetenek_id: ikisininYenilemesi,
    });
    expect(await yetenekNotu(yeniC, 'olusturma')).toMatchObject({
      kullanici_id: ikisi.id,
      yetenek_id: ikisininOlusturmasi,
    });
  });
});

describe("b) 'yetenek yaz'ın denetimleri: 400 dogrulama_hatasi, hiçbir satır değişmez", () => {
  const belirtec = (): string => ortam.superadmin.erisimBelirteci;

  it('hem butunKayitlar hem sart', async () => {
    await reddedilir(
      () => yenile(Y_B, icerik({ sart: SART }), belirtec()),
      400,
      'dogrulama_hatasi',
    );
  });

  it('şartta kaynağın alanı olmayan alan', async () => {
    await reddedilir(
      () =>
        yenile(
          Y_B,
          icerik({
            butunKayitlar: false,
            sart: [{ alan: 'parolaOzeti', islec: 'esit', deger: 'x' }],
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
        yenile(
          Y_B,
          icerik({ butunKolonlar: false, kolonlar: ['gorunenAd', 'yokKolon'] }),
          belirtec(),
        ),
      400,
      'dogrulama_hatasi',
    );
  });
});

describe('c) silinmiş satır', () => {
  it('yenilenemez: 404 bulunamadi', async () => {
    await reddedilir(
      () => yenile(Y_A, icerik(), ortam.superadmin.erisimBelirteci),
      404,
      'bulunamadi',
    );
  });
});

describe('d) sistem satırı ve tohum satırı yenilenemez: 409 cakisma, satırlar ve genel sayaç değişmez', () => {
  const belirtec = (): string => ortam.superadmin.erisimBelirteci;

  it('tohumun yazdığı sistem satırı', async () => {
    const id = await tohumSatiri('kimlik:Yetenek:sil:superadmin');
    await reddedilir(() => yenile(id, icerik(), belirtec()), 409, 'cakisma');
  });

  it('tohum anahtarı olmayan sistem satırı', async () => {
    await reddedilir(
      () => yenile(Y_SISTEM, icerik(), belirtec()),
      409,
      'cakisma',
    );
  });

  it('sistem satırı olmayan, tohum anahtarı taşıyan satır', async () => {
    await reddedilir(
      () => yenile(Y_TOHUM, icerik(), belirtec()),
      409,
      'cakisma',
    );
  });
});

describe('yetki sınırları: 403 yetki_yok, hiçbir satır değişmez', () => {
  it('yalnız Yetenek:yenile yeteneği olan kişi (Yetenek:olustur yok)', async () => {
    await reddedilir(
      () => yenile(Y_B, icerik(), yenileyici.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('yenile ve olustur yeteneği olan ama yetenekleri sistemSatiri kolonu olmadan okuyan kişi', async () => {
    await reddedilir(
      () => yenile(Y_B, icerik(), kolonsuz.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    await reddedilir(() => yenile(Y_B, icerik()), 401, 'kimlik_gerekli');
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok ve hiçbir satır değişmez', async () => {
    // Okuyucunun yalnız Kullanici:oku yeteneği vardır.
    await reddedilir(
      () => yenile(Y_B, icerik(), okuyucu.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('var olmayan kimlik 404 bulunamadi', async () => {
    await reddedilir(
      () => yenile(YOK, icerik(), ortam.superadmin.erisimBelirteci),
      404,
      'bulunamadi',
    );
  });

  it('şemaya uymayan gövde ve yol parametresi 400 dogrulama_hatasi', async () => {
    const belirtec = ortam.superadmin.erisimBelirteci;
    const eksik = Object.fromEntries(
      Object.entries(icerik()).filter(([alan]) => alan !== 'butunBirimler'),
    );
    for (const bozuk of [
      icerik({ butunKayitlar: 'evet' }),
      icerik({ sart: [] }),
      icerik({ butunKolonlar: false, kolonlar: [] }),
      icerik({ butunKayitlar: false, sart: [{ alan: 'kullaniciAdi' }] }),
      icerik({ butunKolonlar: false, kolonlar: KOLONLAR, butunKayitlar: 1 }),
      eksik,
    ]) {
      await reddedilir(
        () => yenile(Y_B, bozuk, belirtec),
        400,
        'dogrulama_hatasi',
      );
    }
    await reddedilir(
      () => yenile('abc', icerik(), belirtec),
      400,
      'dogrulama_hatasi',
    );
  });

  it('şemada olmayan alan 400 dogrulama_hatasi (grup, rol ve izin değişmez)', async () => {
    const belirtec = ortam.superadmin.erisimBelirteci;
    for (const fazla of [
      { grupId: GRUP_A },
      { rolId: ROL_A },
      { izinId: kullaniciOku },
      { yerineGectigiId: Y_A },
      { koken: 'goc' },
      { sistemSatiri: true },
      { tohumAnahtari: 'x' },
      { id: YOK },
    ]) {
      await reddedilir(
        () => yenile(Y_B, icerik(fazla), belirtec),
        400,
        'dogrulama_hatasi',
      );
    }
  });
});

describe('e) etki ve öncelik (TS-008; KU-020; yazım kapalı, kapanan AU-17)', () => {
  // (GRUP_A, ROL_A) kümesine Kullanici:oku veren satırlar: etkisiz, öncelikli (7) ve yasak. Öncelikli ve
  // yasak satır, eski satırdan taşınan değeri göstermek için kısıt düşürülerek SQL ile yazılır.
  const Y_D = 'c4000000-0000-4000-8000-000000000006';
  const Y_ONCELIKLI = 'c4000000-0000-4000-8000-000000000007';
  const Y_YASAK = 'c4000000-0000-4000-8000-000000000008';
  const ROL_ETKISIZ = 'c2000000-0000-4000-8000-000000000005';
  const belirtec = (): string => ortam.superadmin.erisimBelirteci;
  let etkisiz: { id: string; erisimBelirteci: string };
  let yeniD: string;

  async function etkisi(id: string): Promise<Kayit | undefined> {
    const {
      rows: [satir],
    } = await ortam.db.query<Kayit>(
      'select giremez, oncelik from yetenek where id = $1',
      [id],
    );
    return satir;
  }

  async function ayrinti(id: string, govde: Govde): Promise<unknown> {
    const cevap = await yenile(id, govde, belirtec());
    expect(cevap.status).toBe(400);
    return (cevap.body as { ayrinti: unknown }).ayrinti;
  }

  beforeAll(async () => {
    await yasakKisitiniBaglantiylaDusur(ortam.db);
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, giremez,
                            oncelik, koken)
       values ($1, $4, $5, $6, true, true, false, 0, 'yonetici'),
              ($2, $4, $5, $6, true, true, false, 7, 'yonetici'),
              ($3, $4, $5, $6, true, true, true, 0, 'yonetici')`,
      [Y_D, Y_ONCELIKLI, Y_YASAK, GRUP_A, ROL_A, kullaniciOku],
    );
    // İki kolonu göremeyen: yenileyip oluşturabilir, yetenekleri giremez ve oncelik dışındaki bütün
    // kolonlarla okur.
    await ortam.db.query(
      "insert into rol (id, ad) values ($1, 'Etkiyi göremeyen')",
      [ROL_ETKISIZ],
    );
    await yetenekVer(ROL_ETKISIZ, await izinKimligi('Yetenek', 'oku'), [
      ...SISTEM_SATIRI_DISINDA,
      'sistemSatiri',
    ]);
    await yetenekVer(ROL_ETKISIZ, await izinKimligi('Yetenek', 'yenile'));
    await yetenekVer(ROL_ETKISIZ, await izinKimligi('Yetenek', 'olustur'));
    await yetenekVer(ROL_ETKISIZ, await izinKimligi('Izin', 'oku'));
    etkisiz = await ortam.kullaniciAc('etkisiz');
    await uyeYap(etkisiz.id, ROL_ETKISIZ);
  });

  it('gövdede giremez 400 dogrulama_hatasi: etki çevrilemez', async () => {
    for (const giremez of [true, false]) {
      await reddedilir(
        () => yenile(Y_D, icerik({ giremez }), belirtec()),
        400,
        'dogrulama_hatasi',
      );
    }
  });

  it('giremez ve oncelik kolonlarını göremeyen kişi karar kolonu kuralıyla 403 yetki_yok alır', async () => {
    await reddedilir(
      () => yenile(Y_D, icerik(), etkisiz.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('öncelik verilmeden yenilenen satırın etkisi ve önceliği eski satırınkidir (yeni satırda okunur)', async () => {
    const cevap = await yenile(Y_D, icerik(), belirtec());
    expect(cevap.status).toBe(201);
    yeniD = (cevap.body as { id: string }).id;
    expect(await etkisi(yeniD)).toEqual({ giremez: false, oncelik: 0 });
  });

  it('öncelik verilmezse eski satırın sıfırdan farklı önceliği taşınır ve yazım kapalı reddeder', async () => {
    await reddedilir(
      () => yenile(Y_ONCELIKLI, icerik(), belirtec()),
      400,
      'dogrulama_hatasi',
    );
    expect(await ayrinti(Y_ONCELIKLI, icerik())).toEqual([
      { alan: 'oncelik', neden: 'sıfırdan farklı öncelik kapalı' },
    ]);
  });

  it('verilen öncelik eskisinin yerine yazılır', async () => {
    const cevap = await yenile(Y_ONCELIKLI, icerik({ oncelik: 0 }), belirtec());
    expect(cevap.status).toBe(201);
    expect(await etkisi((cevap.body as { id: string }).id)).toEqual({
      giremez: false,
      oncelik: 0,
    });
  });

  it('etki eski satırdan gelir: yasak satırın yenilemesi yazım kapalıyla reddedilir', async () => {
    await reddedilir(
      () => yenile(Y_YASAK, icerik(), belirtec()),
      400,
      'dogrulama_hatasi',
    );
    expect(await ayrinti(Y_YASAK, icerik())).toEqual([
      { alan: 'giremez', neden: 'yasak yazımı kapalı' },
    ]);
  });

  it('oncelik 5 ile yenileme 400 dogrulama_hatasi; hiçbir satır değişmez', async () => {
    await reddedilir(
      () => yenile(yeniD, icerik({ oncelik: 5 }), belirtec()),
      400,
      'dogrulama_hatasi',
    );
  });
});
