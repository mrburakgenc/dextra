// Üyelik: ver ve kaldır (GV-082; TS-002 AK-39, "İşlem sınırları"; KR-008 Seçim 47 ve eki; izin
// Uyelik:olustur ve Uyelik:sil). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-uyelik-yaz.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Hazırlık grupları, rolleri, yetenekleri ve
// kişileri SQL ile yazılır. Her başarılı işte genel sayaç değişmez, kişinin sayısı bir artar;
// reddedilen işte hiçbir satır ve not değişmez (işlem geri alınır). Dosyadaki bölümler sırayla koşar:
// son bölüm ilk yöneticinin SuperAdmin üyeliğini kaldırır.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YOL = '/kimlik/uyelik';
// Yardımcının açtığı kişilerin parolası (kimlik-yardimci.ts).
const ESKI_PAROLA = 'yardimcinin uzun ve dogru parola cümlesi';
const YENI_PAROLA = 'yukselen kisinin yeni ve uzun parola cümlesi';

const GRUP_X = '97000000-0000-4000-8000-000000000001';
const GRUP_SILINMIS = '97000000-0000-4000-8000-0000000000dd';
const ROL_X = '98000000-0000-4000-8000-000000000001';
const ROL_YONETICI = '98000000-0000-4000-8000-000000000002';
const ROL_SILINMIS = '98000000-0000-4000-8000-0000000000dd';
const YETENEK_X = '99000000-0000-4000-8000-000000000001';
const PASIF = '9a000000-0000-4000-8000-000000000001';
const UNUTULMUS = '9a000000-0000-4000-8000-000000000002';
const ADSIZ = '9a000000-0000-4000-8000-000000000003';
const YOK = '9b000000-0000-4000-8000-0000000000ff';

// Uyelik satırının bütün kolonları (TS-002 "Veri modeli").
const UYELIK_KOLONLARI = [
  'grup_id',
  'id',
  'kullanici_id',
  'olusturma_zamani',
  'rol_id',
  'silinme_zamani',
];

type Not = Record<string, unknown>;

interface UyelikSatiri {
  kullanici_id: string;
  grup_id: string;
  rol_id: string;
  silinme_zamani: Date | null;
}

interface Durum {
  sayac: number;
  notlar: number;
  uyelikler: unknown;
  kullanicilar: unknown;
  oturumlar: unknown;
  sirlar: unknown;
  baglantilar: unknown;
}

let ortam: KimlikOrtami;
let kok: string;
let temel: string;
let superadminRol: string;

function gonder(
  yontem: 'post' | 'delete',
  yol: string,
  govde: unknown,
  erisimBelirteci?: string,
): request.Test {
  const istek = request(ortam.app.getHttpServer())[yontem](yol);
  const basli =
    erisimBelirteci === undefined
      ? istek
      : istek.set(ortam.basliklar(erisimBelirteci));
  return govde === undefined ? basli : basli.send(govde as object);
}

const ver = (govde: unknown, belirtec?: string): request.Test =>
  gonder('post', YOL, govde, belirtec ?? ortam.superadmin.erisimBelirteci);

const kaldir = (id: string, belirtec?: string): request.Test =>
  gonder(
    'delete',
    `${YOL}/${id}`,
    undefined,
    belirtec ?? ortam.superadmin.erisimBelirteci,
  );

// İmzalı istemci adresi başlıkları, Authorization olmadan (oturumsuz uçlar için).
function adresBasliklari(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ortam.basliklar('')).filter(
      ([ad]) => ad !== 'authorization',
    ),
  );
}

function giris(kullaniciAdi: string, parola: string): request.Test {
  return request(ortam.app.getHttpServer())
    .post('/kimlik/oturum/giris')
    .set(adresBasliklari())
    .send({ kullaniciAdi, parola });
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  parametreler: unknown[] = [],
): Promise<T[]> {
  return (await ortam.db.query<T>(sql, parametreler)).rows;
}

async function sayac(): Promise<number> {
  const [satir] = await satirlar<{ sayac: number }>(
    'select sayac from yetki_surumu',
  );
  return satir?.sayac ?? -1;
}

async function kisiSurumu(id: string): Promise<number> {
  const [satir] = await satirlar<{ yetki_surumu: number }>(
    'select yetki_surumu from kullanici where id = $1',
    [id],
  );
  return satir?.yetki_surumu ?? -1;
}

async function uyelik(id: string): Promise<UyelikSatiri | undefined> {
  const [satir] = await satirlar<UyelikSatiri>(
    'select kullanici_id, grup_id, rol_id, silinme_zamani from uyelik where id = $1',
    [id],
  );
  return satir;
}

// Kişinin canlı üyeliğinin kimliği.
async function uyelikKimligi(
  kullaniciId: string,
  grupId: string,
  rolId: string,
): Promise<string> {
  const [satir] = await satirlar<{ id: string }>(
    `select id from uyelik
      where kullanici_id = $1 and grup_id = $2 and rol_id = $3 and silinme_zamani is null`,
    [kullaniciId, grupId, rolId],
  );
  if (satir === undefined) {
    throw new Error('canlı üyelik yok');
  }
  return satir.id;
}

// Bir kaydın değişiklik kaydı notları, yazılma sırasıyla.
async function notlar(kaynak: string, kayitId: string): Promise<Not[]> {
  const rows = await satirlar<{ govde: Not }>(
    `select govde from outbox_iz
      where govde->>'kaynak' = $1 and govde->>'kayit_id' = $2
      order by olusturma_zamani, id`,
    [kaynak, kayitId],
  );
  return rows.map((satir) => satir.govde);
}

// Reddedilen işin dokunmaması gereken her şey.
async function durum(): Promise<Durum> {
  const [sonuc] = await satirlar<Durum>(
    `select (select sayac from yetki_surumu) as sayac,
            (select count(*)::int from outbox_iz) as notlar,
            (select json_agg(u order by u.id) from uyelik u) as uyelikler,
            (select json_agg(json_build_array(k.id, k.yetki_surumu) order by k.id)
               from kullanici k) as kullanicilar,
            (select json_agg(json_build_array(o.id, o.kapatilma_zamani, o.kapatilma_nedeni)
                             order by o.id) from oturum o) as oturumlar,
            (select json_agg(s order by s.kullanici_id) from kullanici_sirri s) as sirlar,
            (select json_agg(b order by b.id) from parola_baglantisi b) as baglantilar`,
  );
  if (sonuc === undefined) {
    throw new Error('durum okunamadı');
  }
  return sonuc;
}

// İstek reddedilir ve hiçbir şey değişmez.
async function reddedilir(
  istek: () => request.Test,
  durumKodu: number,
  kod: string,
): Promise<void> {
  const once = await durum();
  const cevap = await istek();
  expect(cevap.status).toBe(durumKodu);
  expect(cevap.body).toMatchObject({ kod });
  expect(await durum()).toEqual(once);
}

// Kişinin "yetkilerim" cevabındaki kuralların yetenek kimlikleri.
async function yetenekleri(erisimBelirteci: string): Promise<string[]> {
  const cevap = await request(ortam.app.getHttpServer())
    .get('/kimlik/oturum/yetkilerim')
    .set(ortam.basliklar(erisimBelirteci));
  expect(cevap.status).toBe(200);
  return (cevap.body as { kurallar: { yetenekId: string }[] }).kurallar.map(
    (kural) => kural.yetenekId,
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

// (grupId, rolId) kümesine verilen izin için bütün kayıtlı, bütün kolonlu yetenek yazar.
async function yetenekYaz(
  grupId: string,
  rolId: string,
  kaynak: string,
  eylem: string,
  id?: string,
): Promise<void> {
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, koken)
     select coalesce($5::uuid, gen_random_uuid()), $1, $2, i.id, true, true, 'yonetici'
       from izin i where i.kaynak = $3 and i.eylem = $4`,
    [grupId, rolId, kaynak, eylem, id ?? null],
  );
}

beforeAll(async () => {
  ortam = await kimlikOrtamiKur();
  const [kokSatiri] = await satirlar<{ id: string }>(
    'select id from grup where ust_grup_id is null and silinme_zamani is null',
  );
  const roller = await satirlar<{ id: string; kod: string }>(
    'select id, kod from rol where kod is not null',
  );
  kok = kokSatiri?.id ?? '';
  temel = roller.find((r) => r.kod === 'temel')?.id ?? '';
  superadminRol = roller.find((r) => r.kod === 'superadmin')?.id ?? '';
  await ortam.db.query(
    `insert into grup (id, ust_grup_id, ad, silinme_zamani)
     values ($1, $3, 'X', null), ($2, $3, 'Silinmiş', now())`,
    [GRUP_X, GRUP_SILINMIS, kok],
  );
  await ortam.db.query(
    `insert into rol (id, ad, silinme_zamani)
     values ($1, 'X rolü', null), ($2, 'Üyelik yöneticisi', null), ($3, 'Silinmiş', now())`,
    [ROL_X, ROL_YONETICI, ROL_SILINMIS],
  );
  await yetenekYaz(GRUP_X, ROL_X, 'Grup', 'oku', YETENEK_X);
  await ortam.db.query(
    `insert into kullanici (id, kullanici_adi, gorunen_ad, pasif_zamani, unutulma_zamani, telefon)
     values ($1, 'pasif-kisi', 'Pasif', now(), null, null),
            ($2, null, 'Unutulmuş', now(), now(), null),
            ($3, null, 'Adsız', null, null, '+905550000001')`,
    [PASIF, UNUTULMUS, ADSIZ],
  );
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a–c) ver ve kaldır', () => {
  let kisi: { id: string; erisimBelirteci: string };
  let uyelikId: string;

  it('a) üyelik verilir: satır yazılır, kişinin sayısı artar, genel sayaç artmaz; yetkilerim kümenin yeteneğini taşır', async () => {
    kisi = await ortam.kullaniciAc('uye-alan');
    expect(await yetenekleri(kisi.erisimBelirteci)).not.toContain(YETENEK_X);
    const sayac0 = await sayac();
    const surum0 = await kisiSurumu(kisi.id);

    const cevap = await ver({ kullaniciId: kisi.id, grupId: GRUP_X, rolId: ROL_X });
    expect(cevap.status).toBe(201);
    expect(Object.keys(cevap.body as object)).toEqual(['id']);
    uyelikId = (cevap.body as { id: string }).id;
    expect(await uyelik(uyelikId)).toEqual({
      kullanici_id: kisi.id,
      grup_id: GRUP_X,
      rol_id: ROL_X,
      silinme_zamani: null,
    });
    expect(await kisiSurumu(kisi.id)).toBe(surum0 + 1);
    expect(await sayac()).toBe(sayac0);
    expect(await yetenekleri(kisi.erisimBelirteci)).toContain(YETENEK_X);

    const [olusturma, ...fazla] = await notlar('Uyelik', uyelikId);
    expect(fazla).toEqual([]);
    expect(olusturma).toMatchObject({
      is_adi: 'kimlik:uyelik-ver',
      kullanici_id: ortam.superadmin.id,
      eylem: 'olusturma',
      kayit_id: uyelikId,
      degisen: {
        kullanici_id: { yeni: kisi.id },
        grup_id: { yeni: GRUP_X },
        rol_id: { yeni: ROL_X },
        silinme_zamani: { yeni: null },
      },
    });
    expect(Object.keys(olusturma?.['degisen'] as object).sort()).toEqual(
      UYELIK_KOLONLARI,
    );
    expect((await notlar('Kullanici', kisi.id)).at(-1)).toMatchObject({
      is_adi: 'kimlik:uyelik-ver',
      kullanici_id: ortam.superadmin.id,
      eylem: 'guncelleme',
      degisen: { yetki_surumu: { eski: surum0, yeni: surum0 + 1 } },
    });
  });

  it('b) aynı canlı üçlü, silinmiş grup ya da rol, pasif, unutulmuş kişi ve sistem aktörü 409 cakisma', async () => {
    const [aktor] = await satirlar<{ id: string }>(
      'select id from kullanici where sistem_aktoru limit 1',
    );
    for (const govde of [
      { kullaniciId: kisi.id, grupId: GRUP_X, rolId: ROL_X },
      { kullaniciId: kisi.id, grupId: GRUP_SILINMIS, rolId: ROL_X },
      { kullaniciId: kisi.id, grupId: GRUP_X, rolId: ROL_SILINMIS },
      { kullaniciId: kisi.id, grupId: YOK, rolId: ROL_X },
      { kullaniciId: PASIF, grupId: GRUP_X, rolId: ROL_X },
      { kullaniciId: UNUTULMUS, grupId: GRUP_X, rolId: ROL_X },
      { kullaniciId: aktor?.id, grupId: GRUP_X, rolId: ROL_X },
    ]) {
      await reddedilir(() => ver(govde), 409, 'cakisma');
    }
  });

  it('c) üyelik kaldırılır: satır silinmiş işaretlenir, kişinin sayısı artar, genel sayaç artmaz; yetkilerim yeteneği taşımaz', async () => {
    const sayac0 = await sayac();
    const surum0 = await kisiSurumu(kisi.id);

    const cevap = await kaldir(uyelikId);
    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');
    expect((await uyelik(uyelikId))?.silinme_zamani).toBeInstanceOf(Date);
    expect(await kisiSurumu(kisi.id)).toBe(surum0 + 1);
    expect(await sayac()).toBe(sayac0);
    expect(await yetenekleri(kisi.erisimBelirteci)).not.toContain(YETENEK_X);

    const silme = (await notlar('Uyelik', uyelikId)).at(-1);
    expect(silme).toMatchObject({
      is_adi: 'kimlik:uyelik-kaldir',
      kullanici_id: ortam.superadmin.id,
      eylem: 'silme',
      kayit_id: uyelikId,
      degisen: { kullanici_id: { eski: kisi.id }, silinme_zamani: { eski: null } },
    });
    expect((await notlar('Kullanici', kisi.id)).at(-1)).toMatchObject({
      is_adi: 'kimlik:uyelik-kaldir',
      kullanici_id: ortam.superadmin.id,
      degisen: { yetki_surumu: { eski: surum0, yeni: surum0 + 1 } },
    });

    // Silinmiş üyelik yeniden kaldırılamaz; aynı üçlü yeniden verilebilir.
    await reddedilir(() => kaldir(uyelikId), 404, 'bulunamadi');
    const yeniden = await ver({ kullaniciId: kisi.id, grupId: GRUP_X, rolId: ROL_X });
    expect(yeniden.status).toBe(201);
  });
});

describe('d) korunan üyelikler', () => {
  it('kişinin (Kök, Temel) üyeliği kaldırılamaz: 409 cakisma', async () => {
    const kisi = await ortam.kullaniciAc('kok-uyeligi-korunan');
    const kokUyelik = await uyelikKimligi(kisi.id, kok, temel);
    await reddedilir(() => kaldir(kokUyelik), 409, 'cakisma');
    expect((await uyelik(kokUyelik))?.silinme_zamani).toBeNull();
  });

  it('tek SuperAdmin\'in SuperAdmin üyeliği kaldırılamaz: 409 cakisma', async () => {
    const saUyelik = await uyelikKimligi(ortam.superadmin.id, kok, superadminRol);
    await reddedilir(() => kaldir(saUyelik), 409, 'cakisma');
  });
});

describe('e) SuperAdmin üyeliği verme', () => {
  let yukselen: { id: string; erisimBelirteci: string };
  let yeniBelirtec: string;

  it('oturumlar yetki_yukseltme ile kapanır, sır ve eski bağlantı silinir; cevaptaki kodla parola belirlenir ve kişi SuperAdmin yetenekleriyle girer', async () => {
    yukselen = await ortam.kullaniciAc('yukselen');
    const ikinciGiris = await giris('yukselen', ESKI_PAROLA);
    expect(ikinciGiris.status).toBe(200);
    const eskiBaglanti = '9c000000-0000-4000-8000-000000000001';
    await ortam.db.query(
      `insert into parola_baglantisi (id, kullanici_id, kod_ozeti, son_gecerlilik_zamani)
       values ($1, $2, 'eski-ozet', now() + interval '1 day')`,
      [eskiBaglanti, yukselen.id],
    );
    const sayac0 = await sayac();
    const surum0 = await kisiSurumu(yukselen.id);

    const cevap = await ver({
      kullaniciId: yukselen.id,
      grupId: kok,
      rolId: superadminRol,
    });
    expect(cevap.status).toBe(201);
    expect(Object.keys(cevap.body as object).sort()).toEqual([
      'id',
      'parolaBaglantisiKodu',
    ]);
    const { id, parolaBaglantisiKodu } = cevap.body as {
      id: string;
      parolaBaglantisiKodu: string;
    };
    expect(await uyelik(id)).toMatchObject({
      kullanici_id: yukselen.id,
      grup_id: kok,
      rol_id: superadminRol,
      silinme_zamani: null,
    });
    expect(await kisiSurumu(yukselen.id)).toBe(surum0 + 1);
    expect(await sayac()).toBe(sayac0);

    // Oturumlar kapandı; eski belirteç ve eski parola çalışmaz.
    const oturumlar = await satirlar<{ kapatilma_nedeni: string | null }>(
      'select kapatilma_nedeni from oturum where kullanici_id = $1',
      [yukselen.id],
    );
    expect(oturumlar).toHaveLength(2);
    expect(oturumlar.map((o) => o.kapatilma_nedeni)).toEqual([
      'yetki_yukseltme',
      'yetki_yukseltme',
    ]);
    const eskiBelirtecle = await request(ortam.app.getHttpServer())
      .get('/kimlik/oturum/yetkilerim')
      .set(ortam.basliklar(yukselen.erisimBelirteci));
    expect(eskiBelirtecle.status).toBe(401);
    expect((await giris('yukselen', ESKI_PAROLA)).status).toBe(401);

    // Sır ve eski bağlantı silindi; yerine superadmin'in ürettiği tek kullanılmamış bağlantı var.
    expect(
      await satirlar('select 1 from kullanici_sirri where kullanici_id = $1', [
        yukselen.id,
      ]),
    ).toEqual([]);
    const baglantilar = await satirlar<{ id: string; olusturan_id: string }>(
      `select id, olusturan_id from parola_baglantisi
        where kullanici_id = $1 and kullanilma_zamani is null`,
      [yukselen.id],
    );
    expect(baglantilar).toHaveLength(1);
    expect(baglantilar[0]?.id).not.toBe(eskiBaglanti);
    expect(baglantilar[0]?.olusturan_id).toBe(ortam.superadmin.id);

    // Notlar işin adını ve yazanı taşır.
    const isinNotlari = await satirlar<{ kaynak: string; eylem: string }>(
      `select govde->>'kaynak' as kaynak, govde->>'eylem' as eylem from outbox_iz
        where govde->>'is_adi' = 'kimlik:uyelik-ver'
          and govde->>'kullanici_id' = $1
          and govde->>'veri_sahibi_kullanici_id' = $2`,
      [ortam.superadmin.id, yukselen.id],
    );
    expect(isinNotlari.map((n) => `${n.kaynak}:${n.eylem}`).sort()).toEqual(
      [
        'Kullanici:guncelleme',
        'KullaniciSirri:silme',
        'Oturum:guncelleme',
        'Oturum:guncelleme',
        'ParolaBaglantisi:olusturma',
        'ParolaBaglantisi:silme',
      ].sort(),
    );
    expect((await notlar('Uyelik', id))[0]).toMatchObject({
      is_adi: 'kimlik:uyelik-ver',
      kullanici_id: ortam.superadmin.id,
      eylem: 'olusturma',
    });

    // Kodla parola belirlenir, kişi girer ve SuperAdmin yeteneklerini taşır.
    const belirle = await request(ortam.app.getHttpServer())
      .post('/kimlik/parola/belirle')
      .send({ kod: parolaBaglantisiKodu, parola: YENI_PAROLA });
    expect(belirle.status).toBe(204);
    const yeniGiris = await giris('yukselen', YENI_PAROLA);
    expect(yeniGiris.status).toBe(200);
    yeniBelirtec = (yeniGiris.body as { erisimBelirteci: string })
      .erisimBelirteci;
    const saYetenekleri = await satirlar<{ id: string }>(
      `select id from yetenek
        where grup_id = $1 and rol_id = $2 and silinme_zamani is null`,
      [kok, superadminRol],
    );
    expect(saYetenekleri.length).toBeGreaterThan(0);
    expect(await yetenekleri(yeniBelirtec)).toEqual(
      expect.arrayContaining(saYetenekleri.map((y) => y.id)),
    );
  });

  it('zaten SuperAdmin olan kişiye 409 cakisma; oturumlarına, sırrına ve bağlantısına dokunulmaz', async () => {
    await reddedilir(
      () =>
        ver({ kullaniciId: yukselen.id, grupId: kok, rolId: superadminRol }),
      409,
      'cakisma',
    );
    expect(await yetenekleri(yeniBelirtec)).not.toEqual([]);
  });

  it('kullanıcı adı boş kişiye verilince kod dönmez ve kullanılmamış bağlantısı silinir', async () => {
    await ortam.db.query(
      `insert into parola_baglantisi (id, kullanici_id, kod_ozeti, son_gecerlilik_zamani)
       values (gen_random_uuid(), $1, 'adsiz-ozet', now() + interval '1 day')`,
      [ADSIZ],
    );
    await ortam.db.query(
      `insert into uyelik (id, kullanici_id, grup_id, rol_id)
       values (gen_random_uuid(), $1, $2, $3)`,
      [ADSIZ, kok, temel],
    );
    const cevap = await ver({
      kullaniciId: ADSIZ,
      grupId: kok,
      rolId: superadminRol,
    });
    expect(cevap.status).toBe(201);
    expect(Object.keys(cevap.body as object)).toEqual(['id']);
    expect(
      await satirlar('select 1 from parola_baglantisi where kullanici_id = $1', [
        ADSIZ,
      ]),
    ).toEqual([]);
  });
});

describe('f) SuperAdmin olmayan üyelik yöneticisi', () => {
  it('Uyelik:olustur ve Uyelik:sil yeteneğiyle olağan üyeliği verir, SuperAdmin üyeliğini veremez ve kaldıramaz (403)', async () => {
    const yonetici = await ortam.kullaniciAc('uyelik-yoneticisi');
    await ortam.db.query(
      `insert into uyelik (id, kullanici_id, grup_id, rol_id)
       values (gen_random_uuid(), $1, $2, $3)`,
      [yonetici.id, GRUP_X, ROL_YONETICI],
    );
    await yetenekYaz(GRUP_X, ROL_YONETICI, 'Uyelik', 'olustur');
    await yetenekYaz(GRUP_X, ROL_YONETICI, 'Uyelik', 'sil');
    const hedef = await ortam.kullaniciAc('yonetilen');

    const olagan = await ver(
      { kullaniciId: hedef.id, grupId: GRUP_X, rolId: ROL_X },
      yonetici.erisimBelirteci,
    );
    expect(olagan.status).toBe(201);
    expect(
      (await notlar('Uyelik', (olagan.body as { id: string }).id))[0],
    ).toMatchObject({ is_adi: 'kimlik:uyelik-ver', kullanici_id: yonetici.id });

    await reddedilir(
      () =>
        ver(
          { kullaniciId: hedef.id, grupId: kok, rolId: superadminRol },
          yonetici.erisimBelirteci,
        ),
      403,
      'yetki_yok',
    );
    const saUyelik = await uyelikKimligi(ortam.superadmin.id, kok, superadminRol);
    await reddedilir(
      () => kaldir(saUyelik, yonetici.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    await reddedilir(
      () => gonder('post', YOL, { kullaniciId: YOK, grupId: GRUP_X, rolId: ROL_X }),
      401,
      'kimlik_gerekli',
    );
    await reddedilir(
      () => gonder('delete', `${YOL}/${YOK}`, undefined),
      401,
      'kimlik_gerekli',
    );
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok; hiçbir satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('uyelik-yetkisiz');
    const kokUyelik = await uyelikKimligi(kisi.id, kok, temel);
    await reddedilir(
      () =>
        ver(
          { kullaniciId: kisi.id, grupId: GRUP_X, rolId: ROL_X },
          kisi.erisimBelirteci,
        ),
      403,
      'yetki_yok',
    );
    await reddedilir(
      () => kaldir(kokUyelik, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('var olmayan kimlik 404 bulunamadi', async () => {
    await reddedilir(() => kaldir(YOK), 404, 'bulunamadi');
  });

  it('şemaya uymayan gövde, şemada olmayan alan ve kimlik olmayan yol 400 dogrulama_hatasi', async () => {
    const tam = { kullaniciId: ADSIZ, grupId: GRUP_X, rolId: ROL_X };
    for (const govde of [
      {},
      { grupId: GRUP_X, rolId: ROL_X },
      { kullaniciId: ADSIZ, rolId: ROL_X },
      { kullaniciId: ADSIZ, grupId: GRUP_X },
      { ...tam, kullaniciId: 'abc' },
      { ...tam, grupId: null },
      { ...tam, rolId: 5 },
      { ...tam, id: YOK },
      { ...tam, silinmeZamani: null },
    ]) {
      await reddedilir(() => ver(govde), 400, 'dogrulama_hatasi');
    }
    await reddedilir(() => kaldir('abc'), 400, 'dogrulama_hatasi');
  });
});

describe('d) ikinci girebilen SuperAdmin varken', () => {
  it('ilk yöneticinin SuperAdmin üyeliği ikinci SuperAdmin tarafından kaldırılır', async () => {
    // e) bölümünde SuperAdmin yapılan "yukselen" parolasını belirledi; artık girebilir.
    const yukselenGiris = await giris('yukselen', YENI_PAROLA);
    expect(yukselenGiris.status).toBe(200);
    const belirtec = (yukselenGiris.body as { erisimBelirteci: string })
      .erisimBelirteci;
    const saUyelik = await uyelikKimligi(ortam.superadmin.id, kok, superadminRol);
    const surum0 = await kisiSurumu(ortam.superadmin.id);

    const cevap = await kaldir(saUyelik, belirtec);
    expect(cevap.status).toBe(204);
    expect((await uyelik(saUyelik))?.silinme_zamani).toBeInstanceOf(Date);
    expect(await kisiSurumu(ortam.superadmin.id)).toBe(surum0 + 1);
  });
});
