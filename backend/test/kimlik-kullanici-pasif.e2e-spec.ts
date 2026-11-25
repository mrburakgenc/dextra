// Kullanıcıyı pasife al ve yeniden aç (GV-064; TS-002 AK-39, "İşlem sınırları"; KR-008 Seçim 43 ve
// 47; izin Kullanici:pasife_al ve Kullanici:yeniden_ac). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-kullanici-pasif.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Hazırlık kişileri, rolleri, üyelikleri ve
// yetenekleri SQL ile yazılır; yetenekler kişinin ilk oturumlu isteğinden önce yazılır (yetkisi
// bunlarla derlenir). Notlar outbox_iz tablosundan okunur. Reddedilen işte kullanıcı, üyelik ve oturum
// satırları, genel sayaç, notlar ve olaylar değişmez (işlem geri alınır). Bölümler sırayla koşar: son
// bölüm ilk yöneticiyi pasife alır.
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YOL = '/kimlik/kullanici';
const PASIFE_AL = 'kimlik:kullanici-pasife-al';
const YENIDEN_AC = 'kimlik:kullanici-yeniden-ac';
// Yardımcının açtığı kişilerin parolası (kimlik-yardimci.ts).
const PAROLA = 'yardimcinin uzun ve dogru parola cümlesi';
const YOK = '9c000000-0000-7000-8000-0000000000ff';

// Hazırlık kişileri (SQL ile yazılır; parola sırları olmadığı için girebilen değildirler).
const SA_HEDEF = '9c000000-0000-7000-8000-000000000001';
const SISTEM = '9c000000-0000-7000-8000-000000000002';
const SISTEM_PASIF = '9c000000-0000-7000-8000-000000000003';
const PASIF = '9c000000-0000-7000-8000-000000000004';
const UNUTULMUS = '9c000000-0000-7000-8000-000000000005';

const ROL_EK = '9d000000-0000-7000-8000-000000000001';
const ROL_PASIFE_AL = '9d000000-0000-7000-8000-000000000002';

interface Not {
  kullanici_id: string;
  yetenek_id: string | null;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

interface Durum {
  notlar: number;
  olaylar: number;
  sayac: number;
  kullanicilar: unknown;
  uyelikler: unknown;
  oturumlar: unknown;
}

let ortam: KimlikOrtami;

function niyet(
  eylem: 'pasife-al' | 'yeniden-ac',
  id: string,
  belirtec: string | undefined,
  govde?: unknown,
): request.Test {
  const istek = request(ortam.app.getHttpServer()).post(
    `${YOL}/${id}/${eylem}`,
  );
  const basli =
    belirtec === undefined ? istek : istek.set(ortam.basliklar(belirtec));
  return govde === undefined ? basli : basli.send(govde as object);
}

const pasifeAl = (id: string, belirtec?: string, govde?: unknown) =>
  niyet('pasife-al', id, belirtec ?? ortam.superadmin.erisimBelirteci, govde);

const yenidenAc = (id: string, belirtec?: string, govde?: unknown) =>
  niyet('yeniden-ac', id, belirtec ?? ortam.superadmin.erisimBelirteci, govde);

// İmzalı istemci adresi başlıkları, Authorization olmadan (oturumsuz uçlar için).
function adresBasliklari(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ortam.basliklar('')).filter(
      ([ad]) => ad !== 'authorization',
    ),
  );
}

function giris(kullaniciAdi: string): request.Test {
  return request(ortam.app.getHttpServer())
    .post('/kimlik/oturum/giris')
    .set(adresBasliklari())
    .send({ kullaniciAdi, parola: PAROLA });
}

// Oturumlu bir okuma: geçerli oturum 403 (okuma yeteneği yok) ya da 200, kapalı oturum 401 alır.
function oku(id: string, belirtec: string): request.Test {
  return request(ortam.app.getHttpServer())
    .get(`${YOL}/${id}`)
    .set(ortam.basliklar(belirtec));
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await ortam.db.query<T>(sql, degerler)).rows;
}

async function kisi(
  id: string,
): Promise<{ pasif_zamani: Date | null; yetki_surumu: number }> {
  const [satir] = await satirlar<{
    pasif_zamani: Date | null;
    yetki_surumu: number;
  }>('select pasif_zamani, yetki_surumu from kullanici where id = $1', [id]);
  if (satir === undefined) {
    throw new Error(`kişi yok: ${id}`);
  }
  return satir;
}

async function sayac(): Promise<number> {
  const [satir] = await satirlar<{ sayac: number }>(
    'select sayac from yetki_surumu',
  );
  return satir?.sayac ?? -1;
}

// Kişinin üyelikleri, oluşturulma sırasıyla; küme kök grup ve rol koduyla adlandırılır.
async function uyelikler(
  kullaniciId: string,
): Promise<{ kume: string; canli: boolean }[]> {
  return satirlar(
    `select case when g.ust_grup_id is null then 'kok' else 'alt' end || ':' ||
            coalesce(r.kod, r.ad) as kume,
            u.silinme_zamani is null as canli
       from uyelik u join grup g on g.id = u.grup_id join rol r on r.id = u.rol_id
      where u.kullanici_id = $1 order by u.olusturma_zamani, u.id`,
    [kullaniciId],
  );
}

async function oturumlar(
  kullaniciId: string,
): Promise<{ kapali: boolean; neden: string | null }[]> {
  return satirlar(
    `select kapatilma_zamani is not null as kapali, kapatilma_nedeni as neden
       from oturum where kullanici_id = $1 order by baslangic_zamani, id`,
    [kullaniciId],
  );
}

// Verilen işin, kişiyle ilgili notları (kişinin kendi kaydı ya da verisinin sahibi olduğu kayıtlar).
async function notlar(isAdi: string, kullaniciId: string): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      `select govde from outbox_iz
        where govde->>'is_adi' = $1
          and (govde->>'kayit_id' = $2 or govde->>'veri_sahibi_kullanici_id' = $2)
        order by olusturma_zamani, id`,
      [isAdi, kullaniciId],
    )
  ).map((s) => s.govde);
}

// Notun değişen kolonları, ada göre sıralı (jsonb anahtar sırasını korumaz).
function kolonlar(not: Not): string[] {
  return Object.keys(not.degisen).sort();
}

async function durum(): Promise<Durum> {
  const [sonuc] = await satirlar<Durum>(
    `select (select count(*)::int from outbox_iz) as notlar,
            (select count(*)::int from outbox_olay) as olaylar,
            (select sayac from yetki_surumu) as sayac,
            (select json_agg(k order by k.id) from kullanici k) as kullanicilar,
            (select json_agg(u order by u.id) from uyelik u) as uyelikler,
            (select coalesce(json_agg(o order by o.id), '[]'::json) from oturum o) as oturumlar`,
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

// Hedef kişiyi SQL ile yazar.
async function kisiYaz(
  id: string,
  kullaniciAdi: string,
  {
    sistemAktoru = false,
    pasif = false,
    unutulmus = false,
  }: { sistemAktoru?: boolean; pasif?: boolean; unutulmus?: boolean } = {},
): Promise<void> {
  await ortam.db.query(
    `insert into kullanici (id, kullanici_adi, gorunen_ad, sistem_aktoru, pasif_zamani, unutulma_zamani)
     values ($1, $2, 'Hazırlık', $3, $4, $5)`,
    [
      id,
      kullaniciAdi,
      sistemAktoru,
      pasif ? new Date() : null,
      unutulmus ? new Date() : null,
    ],
  );
}

// Kişiye kök grupta, kodu verilen rolün üyeliğini yazar.
async function kokUyeligiYaz(
  kullaniciId: string,
  rolKodu: string,
): Promise<void> {
  await ortam.db.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id)
       select gen_random_uuid(), $1, g.id, r.id from grup g, rol r
        where g.ust_grup_id is null and g.silinme_zamani is null and r.kod = $2`,
    [kullaniciId, rolKodu],
  );
}

// Kişiye kök grupta verilen rolün üyeliğini yazar; rol yoksa açılır.
async function rolUyeligiYaz(
  kullaniciId: string,
  rolId: string,
): Promise<void> {
  await ortam.db.query(
    'insert into rol (id, ad) values ($1, $2) on conflict (id) do nothing',
    [rolId, rolId],
  );
  await ortam.db.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id)
       select gen_random_uuid(), $1, g.id, $2 from grup g
        where g.ust_grup_id is null and g.silinme_zamani is null`,
    [kullaniciId, rolId],
  );
}

// Kişiye yeni bir rolle kök grupta üyelik verir; role Kullanici:<eylem> yeteneği (bütün kayıtlar,
// bütün kolonlar) yazılır.
async function yetkiVer(
  kullaniciId: string,
  rolId: string,
  eylem: string,
): Promise<void> {
  await rolUyeligiYaz(kullaniciId, rolId);
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, koken)
       select gen_random_uuid(), g.id, $1, i.id, true, true, 'yonetici'
         from grup g, izin i
        where g.ust_grup_id is null and g.silinme_zamani is null
          and i.kaynak = 'Kullanici' and i.eylem = $2`,
    [rolId, eylem],
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
  await kisiYaz(SA_HEDEF, 'sa-hedef');
  await kokUyeligiYaz(SA_HEDEF, 'temel');
  await kokUyeligiYaz(SA_HEDEF, 'superadmin');
  await kisiYaz(SISTEM, 'sistem-aktoru', { sistemAktoru: true });
  await kisiYaz(SISTEM_PASIF, 'pasif-sistem-aktoru', {
    sistemAktoru: true,
    pasif: true,
  });
  await kisiYaz(PASIF, 'pasif-kisi', { pasif: true });
  await kisiYaz(UNUTULMUS, 'unutulmus-kisi', { pasif: true, unutulmus: true });
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) ve b) pasife alınan kişi, sonra yeniden açılan kişi', () => {
  let hedef: { id: string; erisimBelirteci: string };
  let ikinciBelirtec: string;

  beforeAll(async () => {
    hedef = await ortam.kullaniciAc('pasif-hedefi');
    // Kök üyeliğe ek bir üyelik ve ikinci bir açık oturum.
    await rolUyeligiYaz(hedef.id, ROL_EK);
    const ikinci = await giris('pasif-hedefi');
    expect(ikinci.status).toBe(200);
    ikinciBelirtec = (ikinci.body as { erisimBelirteci: string })
      .erisimBelirteci;
  });

  it('a) 204 gövdesiz; pasif zamanı dolar, bütün üyelikler silinmiş, açık oturumlar pasife_alma ile kapalı; belirteç 401, giriş yapılamaz; kişinin sayısı artar, genel sayaç artmaz; notlar', async () => {
    // Oturumlar geçerli: okuma yeteneği olmadığı için 403.
    expect((await oku(hedef.id, hedef.erisimBelirteci)).status).toBe(403);
    expect((await oku(hedef.id, ikinciBelirtec)).status).toBe(403);
    expect(await uyelikler(hedef.id)).toEqual([
      { kume: 'kok:temel', canli: true },
      { kume: `kok:${ROL_EK}`, canli: true },
    ]);
    const { yetki_surumu: surum } = await kisi(hedef.id);
    const genel = await sayac();
    const olaylar = (await durum()).olaylar;

    const cevap = await pasifeAl(hedef.id, undefined, {});
    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');

    const sonra = await kisi(hedef.id);
    expect(sonra.pasif_zamani).toBeInstanceOf(Date);
    expect(sonra.yetki_surumu).toBe(surum + 1);
    expect(await sayac()).toBe(genel);
    expect(await uyelikler(hedef.id)).toEqual([
      { kume: 'kok:temel', canli: false },
      { kume: `kok:${ROL_EK}`, canli: false },
    ]);
    expect(await oturumlar(hedef.id)).toEqual([
      { kapali: true, neden: 'pasife_alma' },
      { kapali: true, neden: 'pasife_alma' },
    ]);
    for (const belirtec of [hedef.erisimBelirteci, ikinciBelirtec]) {
      const okuma = await oku(hedef.id, belirtec);
      expect(okuma.status).toBe(401);
      expect(okuma.body).toMatchObject({ kod: 'kimlik_gerekli' });
    }
    const girisDenemesi = await giris('pasif-hedefi');
    expect(girisDenemesi.status).toBe(401);
    expect(await oturumlar(hedef.id)).toHaveLength(2);
    expect((await durum()).olaylar).toBe(olaylar);

    // Notlar: kapının kilit notu (değişen kolon yok), iki üyelik, iki oturum, pasif zamanı, sayı.
    const hepsi = await notlar(PASIFE_AL, hedef.id);
    expect(hepsi.map((n) => [n.kaynak, kolonlar(n)])).toEqual([
      ['Kullanici', []],
      ['Uyelik', ['silinme_zamani']],
      ['Uyelik', ['silinme_zamani']],
      ['Oturum', ['kapatilma_nedeni', 'kapatilma_zamani']],
      ['Oturum', ['kapatilma_nedeni', 'kapatilma_zamani']],
      ['Kullanici', ['pasif_zamani']],
      ['Kullanici', ['yetki_surumu']],
    ]);
    for (const not of hepsi) {
      expect(not).toMatchObject({
        is_adi: PASIFE_AL,
        kullanici_id: ortam.superadmin.id,
        eylem: 'guncelleme',
      });
    }
    expect(hepsi[5]).toMatchObject({
      kayit_id: hedef.id,
      degisen: {
        pasif_zamani: { eski: null, yeni: sonra.pasif_zamani?.toISOString() },
      },
    });
    expect(hepsi[5]?.yetenek_id).not.toBeNull();
    expect(hepsi[6]?.degisen).toEqual({
      yetki_surumu: { eski: surum, yeni: surum + 1 },
    });
  });

  it('b) 204 gövdesiz; pasif zamanı boşalır, yalnız bir canlı (Kök, Temel) üyeliği vardır, eski üyelikler geri gelmez; eski parolayla giriş yapılır; notlar', async () => {
    const { yetki_surumu: surum, pasif_zamani: pasifZamani } = await kisi(
      hedef.id,
    );
    const genel = await sayac();
    const olaylar = (await durum()).olaylar;

    const cevap = await yenidenAc(hedef.id);
    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');

    const sonra = await kisi(hedef.id);
    expect(sonra.pasif_zamani).toBeNull();
    expect(sonra.yetki_surumu).toBe(surum + 1);
    expect(await sayac()).toBe(genel);
    expect(await uyelikler(hedef.id)).toEqual([
      { kume: 'kok:temel', canli: false },
      { kume: `kok:${ROL_EK}`, canli: false },
      { kume: 'kok:temel', canli: true },
    ]);
    expect((await durum()).olaylar).toBe(olaylar);

    const hepsi = await notlar(YENIDEN_AC, hedef.id);
    expect(hepsi.map((n) => [n.kaynak, n.eylem, kolonlar(n)])).toEqual([
      ['Kullanici', 'guncelleme', []],
      ['Kullanici', 'guncelleme', ['pasif_zamani']],
      [
        'Uyelik',
        'olusturma',
        ['grup_id', 'kullanici_id', 'olusturma_zamani', 'rol_id'],
      ],
      ['Kullanici', 'guncelleme', ['yetki_surumu']],
    ]);
    for (const not of hepsi) {
      expect(not).toMatchObject({
        is_adi: YENIDEN_AC,
        kullanici_id: ortam.superadmin.id,
      });
    }
    expect(hepsi[1]?.degisen).toEqual({
      pasif_zamani: { eski: pasifZamani?.toISOString(), yeni: null },
    });

    const girisi = await giris('pasif-hedefi');
    expect(girisi.status).toBe(200);
    const belirtec = (girisi.body as { erisimBelirteci: string })
      .erisimBelirteci;
    expect((await oku(hedef.id, belirtec)).status).toBe(403);
  });
});

describe('d) SuperAdmin koruması', () => {
  let yonetici: string;

  beforeAll(async () => {
    const kisi = await ortam.kullaniciAc('pasif-yoneticisi');
    await yetkiVer(kisi.id, ROL_PASIFE_AL, 'pasife_al');
    yonetici = kisi.erisimBelirteci;
  });

  it("SuperAdmin olmayan, Kullanici:pasife_al yeteneği olan yönetici bir SuperAdmin'i pasife alamaz (403); hiçbir şey değişmez", async () => {
    for (const hedef of [SA_HEDEF, ortam.superadmin.id]) {
      await reddedilir(() => pasifeAl(hedef, yonetici), 403, 'yetki_yok');
    }
  });

  it('aynı yönetici sıradan kullanıcıyı pasife alır', async () => {
    const hedef = await ortam.kullaniciAc('siradan-hedef');
    const cevap = await pasifeAl(hedef.id, yonetici);
    expect(cevap.status).toBe(204);
    expect((await kisi(hedef.id)).pasif_zamani).toBeInstanceOf(Date);
    expect(await uyelikler(hedef.id)).toEqual([
      { kume: 'kok:temel', canli: false },
    ]);
  });

  it('yönetici yeniden açamaz: yeniden_ac izni yok (403)', async () => {
    await reddedilir(() => yenidenAc(PASIF, yonetici), 403, 'yetki_yok');
  });
});

describe('e) reddedilen kişiler', () => {
  it.each([
    ['SQL ile yazılmış sistem aktörü', SISTEM],
    ['zaten pasif kişi', PASIF],
    ['unutulmuş kişi', UNUTULMUS],
  ])('pasife al: %s için 409 cakisma; hiçbir şey değişmez', async (_ad, id) => {
    await reddedilir(() => pasifeAl(id), 409, 'cakisma');
  });

  it('pasife al: tohumun yazdığı sistem aktörleri için 409 cakisma', async () => {
    const aktorler = await satirlar<{ id: string }>(
      'select id from kullanici where sistem_aktoru and id <> all($1)',
      [[SISTEM, SISTEM_PASIF]],
    );
    expect(aktorler.length).toBeGreaterThan(0);
    for (const { id } of aktorler) {
      await reddedilir(() => pasifeAl(id), 409, 'cakisma');
    }
  });

  it.each([
    ['pasif olmayan kişi', SA_HEDEF],
    ['pasif olmayan sistem aktörü', SISTEM],
    ['pasif sistem aktörü', SISTEM_PASIF],
    ['unutulmuş kişi', UNUTULMUS],
  ])(
    'yeniden aç: %s için 409 cakisma; hiçbir şey değişmez',
    async (_ad, id) => {
      await reddedilir(() => yenidenAc(id), 409, 'cakisma');
    },
  );

  it('yeniden aç: oturumu ve üyelikleri olan pasif olmayan kişi için 409; hiçbir şey değişmez', async () => {
    const kisi = await ortam.kullaniciAc('acik-kisi');
    await reddedilir(() => yenidenAc(kisi.id), 409, 'cakisma');
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    for (const eylem of ['pasife-al', 'yeniden-ac'] as const) {
      await reddedilir(
        () => niyet(eylem, PASIF, undefined),
        401,
        'kimlik_gerekli',
      );
    }
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok; hiçbir satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('pasif-yetkisiz');
    await reddedilir(
      () => pasifeAl(SA_HEDEF, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
    await reddedilir(
      () => yenidenAc(PASIF, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('var olmayan kimlik 404 bulunamadi', async () => {
    await reddedilir(() => pasifeAl(YOK), 404, 'bulunamadi');
    await reddedilir(() => yenidenAc(YOK), 404, 'bulunamadi');
  });

  it('şemaya uymayan gövde, şemada olmayan alan ve kimlik olmayan yol 400 dogrulama_hatasi', async () => {
    for (const istek of [pasifeAl, yenidenAc]) {
      for (const govde of [{ pasifZamani: null }, { neden: 'x' }, [1]]) {
        await reddedilir(
          () => istek(PASIF, undefined, govde),
          400,
          'dogrulama_hatasi',
        );
      }
      await reddedilir(() => istek('abc'), 400, 'dogrulama_hatasi');
    }
  });
});

describe('c) girebilen son SuperAdmin', () => {
  it('tek girebilen SuperAdmin kendini pasife alamaz (409); hiçbir şey değişmez', async () => {
    await reddedilir(() => pasifeAl(ortam.superadmin.id), 409, 'cakisma');
  });

  it('ikinci bir girebilen SuperAdmin varken kendini pasife alır; oturumu kapanır, öbürü çalışmaya devam eder', async () => {
    const ikinci = await ortam.kullaniciAc('ikinci-superadmin');
    await kokUyeligiYaz(ikinci.id, 'superadmin');
    expect((await oku(ikinci.id, ikinci.erisimBelirteci)).status).toBe(200);

    const cevap = await pasifeAl(ortam.superadmin.id);
    expect(cevap.status).toBe(204);
    expect((await kisi(ortam.superadmin.id)).pasif_zamani).toBeInstanceOf(Date);
    expect(
      (await oku(ortam.superadmin.id, ortam.superadmin.erisimBelirteci)).status,
    ).toBe(401);
    expect((await oku(ikinci.id, ikinci.erisimBelirteci)).status).toBe(200);

    // Artık girebilen son SuperAdmin ikincisidir: kendini pasife alamaz.
    await reddedilir(
      () => pasifeAl(ikinci.id, ikinci.erisimBelirteci),
      409,
      'cakisma',
    );
  });
});
