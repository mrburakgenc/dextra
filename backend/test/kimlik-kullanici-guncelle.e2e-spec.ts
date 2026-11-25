// Kullanıcı güncelle ve parola bağlantısı üret (GV-063; TS-002 AK-39, "İşlem sınırları"; KR-008
// Seçim 47; KR-009 Seçim 9; izin Kullanici:guncelle ve Kullanici:parola_baglantisi_uret). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-kullanici-guncelle.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Hedef kişiler ve yetkisi daraltılmış
// kişilerin rol, üyelik ve yetenek satırları SQL ile yazılır; yetenekler kişinin ilk oturumlu
// isteğinden önce yazılır (yetkisi bunlarla derlenir). Notlar outbox_iz tablosundan okunur. Reddedilen
// işte kullanıcı ve bağlantı satırları, notlar ve olaylar değişmez (işlem geri alınır).
import { createHash } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const YOL = '/kimlik/kullanici';
const GUNCELLE = 'kimlik:kullanici-guncelle';
const BAGLANTI = 'kimlik:parola-baglantisi-uret';
const PAROLA = 'baglantiyla belirlenen uzun parola cümlesi';
const YOK = '95000000-0000-7000-8000-0000000000ff';

// Hazırlık kişileri (SQL ile yazılır).
const SA_HEDEF = '95000000-0000-7000-8000-000000000001';
const SISTEM = '95000000-0000-7000-8000-000000000002';
const PASIF = '95000000-0000-7000-8000-000000000003';
const UNUTULMUS = '95000000-0000-7000-8000-000000000004';
const ADSIZ = '95000000-0000-7000-8000-000000000005';
const SIRADAN = '95000000-0000-7000-8000-000000000006';
// Unutulmuş ama pasif olmayan kişi: güncellemenin 409'u unutulmuşluk denetiminden gelir.
const UNUTULMUS_AKTIF = '95000000-0000-7000-8000-000000000007';

const ROL_SARTLI = '96000000-0000-7000-8000-000000000001';
const ROL_DAR = '96000000-0000-7000-8000-000000000002';
const ROL_BAGLANTI = '96000000-0000-7000-8000-000000000003';
const ROL_SARTLI_AKTOR = '96000000-0000-7000-8000-000000000004';

interface Not {
  kullanici_id: string;
  uyelik_id: string | null;
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
  kullanicilar: unknown;
  baglantilar: unknown;
}

let ortam: KimlikOrtami;

function gonder(
  yontem: 'post' | 'patch',
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

const guncelle = (
  id: string,
  govde: unknown,
  belirtec?: string,
): request.Test =>
  gonder(
    'patch',
    `${YOL}/${id}`,
    govde,
    belirtec ?? ortam.superadmin.erisimBelirteci,
  );

const baglantiUret = (
  id: string,
  belirtec?: string,
  govde?: unknown,
): request.Test =>
  gonder(
    'post',
    `${YOL}/${id}/parola-baglantisi`,
    govde,
    belirtec ?? ortam.superadmin.erisimBelirteci,
  );

const ozet = (kod: string): string =>
  createHash('sha256').update(kod).digest('hex');

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await ortam.db.query<T>(sql, degerler)).rows;
}

async function gorunenAd(id: string): Promise<string | undefined> {
  const [satir] = await satirlar<{ gorunen_ad: string }>(
    'select gorunen_ad from kullanici where id = $1',
    [id],
  );
  return satir?.gorunen_ad;
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

// Kişinin bağlantı satırları, oluşturulma sırasıyla.
async function baglantilar(
  kullaniciId: string,
): Promise<
  { kod_ozeti: string; kullanilmis: boolean; olusturan_id: string }[]
> {
  return satirlar(
    `select kod_ozeti, kullanilma_zamani is not null as kullanilmis, olusturan_id
       from parola_baglantisi where kullanici_id = $1 order by olusturma_zamani, id`,
    [kullaniciId],
  );
}

async function durum(): Promise<Durum> {
  const [sonuc] = await satirlar<Durum>(
    `select (select count(*)::int from outbox_iz) as notlar,
            (select count(*)::int from outbox_olay) as olaylar,
            (select json_agg(k order by k.id) from kullanici k) as kullanicilar,
            (select coalesce(json_agg(b order by b.id), '[]'::json)
               from parola_baglantisi b) as baglantilar`,
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
  kullaniciAdi: string | null,
  {
    sistemAktoru = false,
    pasif = false,
    unutulmus = false,
  }: { sistemAktoru?: boolean; pasif?: boolean; unutulmus?: boolean } = {},
): Promise<void> {
  await ortam.db.query(
    `insert into kullanici (id, kullanici_adi, telefon, gorunen_ad, sistem_aktoru, pasif_zamani, unutulma_zamani)
     values ($1, $2, $3, 'Hazırlık', $4, $5, $6)`,
    [
      id,
      kullaniciAdi,
      kullaniciAdi === null ? `+90555${id.slice(-7)}` : null,
      sistemAktoru,
      pasif ? new Date() : null,
      unutulmus ? new Date() : null,
    ],
  );
}

// Kişiye kök gruptaki, kodu verilen rolün üyeliğini yazar.
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

// Kişiye yeni bir rol ve o rolle kök grupta üyelik verir; role Kullanici:<eylem> yeteneği yazılır.
// Şart verilmezse bütün kayıtlar, kolonlar verilmezse bütün kolonlar.
async function yetkiVer(
  kullaniciId: string,
  rolId: string,
  eylem: string,
  { sart, kolonlar }: { sart?: unknown; kolonlar?: string[] } = {},
): Promise<void> {
  await ortam.db.query('insert into rol (id, ad) values ($1, $2)', [
    rolId,
    `Sınama ${eylem}`,
  ]);
  await ortam.db.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id)
       select gen_random_uuid(), $1, g.id, $2 from grup g
        where g.ust_grup_id is null and g.silinme_zamani is null`,
    [kullaniciId, rolId],
  );
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar, butun_kolonlar, koken)
       select gen_random_uuid(), g.id, $1, i.id, $2::jsonb, $2::jsonb is null,
              $3::text[], $3::text[] is null, 'yonetici'
         from grup g, izin i
        where g.ust_grup_id is null and g.silinme_zamani is null
          and i.kaynak = 'Kullanici' and i.eylem = $4`,
    [
      rolId,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
      eylem,
    ],
  );
}

async function parolaBelirle(kod: string): Promise<request.Response> {
  return request(ortam.app.getHttpServer())
    .post('/kimlik/parola/belirle')
    .send({ kod, parola: PAROLA });
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
  await kisiYaz(PASIF, 'pasif-kisi', { pasif: true });
  await kisiYaz(UNUTULMUS, 'unutulmus-kisi', { pasif: true, unutulmus: true });
  await kisiYaz(ADSIZ, null);
  await kisiYaz(UNUTULMUS_AKTIF, 'unutulmus-aktif', { unutulmus: true });
  await kisiYaz(SIRADAN, 'siradan');
  await kokUyeligiYaz(SIRADAN, 'temel');
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) görünen ad değişir', () => {
  it('204 gövdesiz döner; satırda yalnız görünen ad değişir; not eski ve yeni değeri taşır; olay yazılmaz', async () => {
    const hedef = await ortam.kullaniciAc('ad-hedefi');
    const [once] = await satirlar('select * from kullanici where id = $1', [
      hedef.id,
    ]);
    const olaylar = (await durum()).olaylar;

    const cevap = await guncelle(hedef.id, {
      gorunenAd: '  Yeni Görünen Ad  ',
    });
    expect(cevap.status).toBe(204);
    expect(cevap.text).toBe('');
    const [sonra] = await satirlar('select * from kullanici where id = $1', [
      hedef.id,
    ]);
    expect(sonra).toEqual({ ...once, gorunen_ad: 'Yeni Görünen Ad' });
    expect((await durum()).olaylar).toBe(olaylar);

    const [not, ...fazla] = await notlar(GUNCELLE, hedef.id);
    expect(fazla).toEqual([]);
    expect(not).toMatchObject({
      is_adi: GUNCELLE,
      kullanici_id: ortam.superadmin.id,
      eylem: 'guncelleme',
      kaynak: 'Kullanici',
      kayit_id: hedef.id,
    });
    expect(not?.yetenek_id).not.toBeNull();
    expect(not?.uyelik_id).not.toBeNull();
    expect(not?.degisen).toEqual({
      gorunen_ad: { eski: 'ad-hedefi', yeni: 'Yeni Görünen Ad' },
    });
  });

  it('aynı değerle güncelleme 204 döner, satır değişmez ve not değişen kolon taşımaz', async () => {
    const hedef = await ortam.kullaniciAc('ayni-deger');
    const [once] = await satirlar('select * from kullanici where id = $1', [
      hedef.id,
    ]);
    const cevap = await guncelle(hedef.id, { gorunenAd: 'ayni-deger' });
    expect(cevap.status).toBe(204);
    expect(
      await satirlar('select * from kullanici where id = $1', [hedef.id]),
    ).toEqual([once]);
    const hepsi = await notlar(GUNCELLE, hedef.id);
    expect(hepsi.map((n) => n.degisen)).toEqual([{}]);
  });

  it('boşlukları atıldıktan sonra 200 karakter olan ad kabul edilir', async () => {
    const ad = 'g'.repeat(200);
    const cevap = await guncelle(SIRADAN, { gorunenAd: ` ${ad} ` });
    expect(cevap.status).toBe(204);
    expect(await gorunenAd(SIRADAN)).toBe(ad);
  });
});

describe('b) güncelleme yalnız görünen adı kabul eder', () => {
  const govdeler: [string, unknown][] = [
    ['kullaniciAdi', { gorunenAd: 'X', kullaniciAdi: 'baska.ad' }],
    ['pasifZamani', { gorunenAd: 'X', pasifZamani: new Date().toISOString() }],
    ['sistemAktoru', { gorunenAd: 'X', sistemAktoru: true }],
    ['yalnız kullaniciAdi', { kullaniciAdi: 'baska.ad' }],
    ['yalnız pasifZamani', { pasifZamani: null }],
    ['yalnız sistemAktoru', { sistemAktoru: false }],
    ['telefon', { gorunenAd: 'X', telefon: '+905551112233' }],
    ['yetkiSurumu', { gorunenAd: 'X', yetkiSurumu: 9 }],
    ['unutulmaZamani', { gorunenAd: 'X', unutulmaZamani: null }],
    ['id', { gorunenAd: 'X', id: YOK }],
  ];

  it.each(govdeler)(
    'gövdede %s 400 dogrulama_hatasi döner ve satır değişmez',
    async (_ad, govde) => {
      await reddedilir(() => guncelle(SIRADAN, govde), 400, 'dogrulama_hatasi');
    },
  );
});

describe('c) şartlı ve kolonla sınırlı güncelleme yeteneği', () => {
  it('yeteneğinin şartı kaydı tutmayan kişi 404 bulunamadi alır; şartın tuttuğu kaydı günceller', async () => {
    const kisi = await ortam.kullaniciAc('sartli-guncelleyici');
    await yetkiVer(kisi.id, ROL_SARTLI, 'guncelle', {
      sart: [{ alan: 'kullaniciAdi', islec: 'esit', deger: 'siradan' }],
    });
    await reddedilir(
      () => guncelle(PASIF, { gorunenAd: 'Dışarıda' }, kisi.erisimBelirteci),
      404,
      'bulunamadi',
    );
    const cevap = await guncelle(
      SIRADAN,
      { gorunenAd: 'Şartın içinde' },
      kisi.erisimBelirteci,
    );
    expect(cevap.status).toBe(204);
    expect(await gorunenAd(SIRADAN)).toBe('Şartın içinde');
    expect((await notlar(GUNCELLE, SIRADAN)).at(-1)).toMatchObject({
      kullanici_id: kisi.id,
      degisen: { gorunen_ad: { yeni: 'Şartın içinde' } },
    });
  });

  it('kolon listesinde gorunenAd olmayan kişi 403 yetki_yok alır ve satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('dar-guncelleyici');
    await yetkiVer(kisi.id, ROL_DAR, 'guncelle', {
      kolonlar: ['kullaniciAdi', 'telefon'],
    });
    await reddedilir(
      () => guncelle(SIRADAN, { gorunenAd: 'Dar' }, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });
});

// TS-002 değişmez 16: güncelleme sistem aktörü hedefini reddeder (çekirdek yollar kimlik sistem
// aktörünü görünen adıyla bulur).
describe('sistem aktörünün görünen adı değişmez', () => {
  it('SQL ile yazılmış sistem aktörü için 409 cakisma; hiçbir şey değişmez', async () => {
    await reddedilir(
      () => guncelle(SISTEM, { gorunenAd: 'Yeni Ad' }),
      409,
      'cakisma',
    );
  });

  it('tohumun yazdığı kimlik sistem aktörü için 409 cakisma; aktör adıyla bulunmaya devam eder', async () => {
    const [aktor] = await satirlar<{ id: string }>(
      "select id from kullanici where sistem_aktoru and gorunen_ad = 'kimlik'",
    );
    expect(aktor).toBeDefined();
    await reddedilir(
      () => guncelle(aktor?.id ?? '', { gorunenAd: 'Kimlik Sistemi' }),
      409,
      'cakisma',
    );
    expect(await gorunenAd(aktor?.id ?? '')).toBe('kimlik');
  });

  it('yeteneğinin şartı sistem aktörünü tutmayan kişi 409 değil 404 bulunamadi alır', async () => {
    const kisi = await ortam.kullaniciAc('sartli-aktor-deneyen');
    await yetkiVer(kisi.id, ROL_SARTLI_AKTOR, 'guncelle', {
      sart: [{ alan: 'kullaniciAdi', islec: 'esit', deger: 'siradan' }],
    });
    await reddedilir(
      () => guncelle(SISTEM, { gorunenAd: 'X' }, kisi.erisimBelirteci),
      404,
      'bulunamadi',
    );
  });
});

// TS-002 AK-47: unutulmuş kişinin görünen adı kişiye geri götürmeyen sabit değerdir (KR-012).
describe('unutulmuş kişinin görünen adı değişmez', () => {
  it.each([
    ['pasif olmayan', UNUTULMUS_AKTIF],
    ['pasif', UNUTULMUS],
  ])(
    '%s unutulmuş kişi için 409 cakisma unutulmuşluk iletisiyle döner; hiçbir şey değişmez',
    async (_ad, id) => {
      const once = await durum();
      const cevap = await guncelle(id, { gorunenAd: 'Kişisel Ad' });
      expect(cevap.status).toBe(409);
      expect(cevap.body).toMatchObject({
        kod: 'cakisma',
        ileti: 'Unutulmuş kişinin görünen adı değiştirilmez',
      });
      expect(await durum()).toEqual(once);
      expect(await gorunenAd(id)).toBe('Hazırlık');
    },
  );
});

describe('d) parola bağlantısı üretilir', () => {
  it('kod döner; önceki kullanılmamış bağlantı silinir; yeni kodla parola belirlenir, eski kodla belirlenemez', async () => {
    const hedef = await ortam.kullaniciAc('baglanti-hedefi');
    const olaylar = (await durum()).olaylar;

    const ilk = await baglantiUret(hedef.id);
    expect(ilk.status).toBe(201);
    expect(Object.keys(ilk.body as object)).toEqual(['parolaBaglantisiKodu']);
    const eskiKod = (ilk.body as { parolaBaglantisiKodu: string })
      .parolaBaglantisiKodu;
    expect(eskiKod).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Alansız gövde de kabul edilir.
    const ikinci = await baglantiUret(hedef.id, undefined, {});
    expect(ikinci.status).toBe(201);
    const yeniKod = (ikinci.body as { parolaBaglantisiKodu: string })
      .parolaBaglantisiKodu;
    expect(yeniKod).not.toBe(eskiKod);
    expect(await baglantilar(hedef.id)).toEqual([
      {
        kod_ozeti: ozet(yeniKod),
        kullanilmis: false,
        olusturan_id: ortam.superadmin.id,
      },
    ]);
    expect((await durum()).olaylar).toBe(olaylar);

    const eskiyle = await parolaBelirle(eskiKod);
    expect(eskiyle.status).toBe(404);
    expect(eskiyle.body).toMatchObject({ kod: 'bulunamadi' });
    const yeniyle = await parolaBelirle(yeniKod);
    expect(yeniyle.status).toBe(204);

    // Kullanılmış bağlantı silinmez; yanına yeni bir kullanılmamış bağlantı yazılır.
    const ucuncu = await baglantiUret(hedef.id);
    expect(ucuncu.status).toBe(201);
    const ucuncuKod = (ucuncu.body as { parolaBaglantisiKodu: string })
      .parolaBaglantisiKodu;
    expect(await baglantilar(hedef.id)).toEqual([
      {
        kod_ozeti: ozet(yeniKod),
        kullanilmis: true,
        olusturan_id: ortam.superadmin.id,
      },
      {
        kod_ozeti: ozet(ucuncuKod),
        kullanilmis: false,
        olusturan_id: ortam.superadmin.id,
      },
    ]);

    // Notlar: her istekte kişinin satırına niyet notu (değişen kolon yok) ve bağlantının notları;
    // ikinci istek önceki bağlantıyı siler. Notlar kodu ya da özetini taşımaz.
    const hepsi = await notlar(BAGLANTI, hedef.id);
    expect(hepsi.map((n) => [n.kaynak, n.eylem])).toEqual([
      ['Kullanici', 'guncelleme'],
      ['ParolaBaglantisi', 'olusturma'],
      ['Kullanici', 'guncelleme'],
      ['ParolaBaglantisi', 'silme'],
      ['ParolaBaglantisi', 'olusturma'],
      ['Kullanici', 'guncelleme'],
      ['ParolaBaglantisi', 'olusturma'],
    ]);
    for (const not of hepsi) {
      expect(not.is_adi).toBe(BAGLANTI);
      expect(not.kullanici_id).toBe(ortam.superadmin.id);
      const metin = JSON.stringify(not);
      for (const kod of [eskiKod, yeniKod, ucuncuKod]) {
        expect(metin).not.toContain(kod);
        expect(metin).not.toContain(ozet(kod));
      }
    }
    const niyet = hepsi.filter((n) => n.kaynak === 'Kullanici');
    for (const not of niyet) {
      expect(not).toMatchObject({ kayit_id: hedef.id, degisen: {} });
      expect(not.yetenek_id).not.toBeNull();
    }
    expect(hepsi[1]?.degisen).toMatchObject({
      kullanici_id: { yeni: hedef.id },
      olusturan_id: { yeni: ortam.superadmin.id },
    });
    expect(Object.keys(hepsi[3]?.degisen ?? {})).toEqual(
      expect.arrayContaining(['kullanici_id', 'son_gecerlilik_zamani']),
    );
  });
});

describe('e) SuperAdmin koruması', () => {
  let yonetici: string;
  let saKodu: string;

  beforeAll(async () => {
    const kisi = await ortam.kullaniciAc('baglanti-yoneticisi');
    await yetkiVer(kisi.id, ROL_BAGLANTI, 'parola_baglantisi_uret');
    yonetici = kisi.erisimBelirteci;
    // SuperAdmin hedefin bekleyen bir bağlantısı olur.
    const cevap = await baglantiUret(SA_HEDEF);
    expect(cevap.status).toBe(201);
    saKodu = (cevap.body as { parolaBaglantisiKodu: string })
      .parolaBaglantisiKodu;
  });

  it('SuperAdmin olmayan yönetici bir SuperAdmin için bağlantı üretemez (403); var olan bağlantıya dokunulmaz', async () => {
    for (const hedef of [SA_HEDEF, ortam.superadmin.id]) {
      await reddedilir(() => baglantiUret(hedef, yonetici), 403, 'yetki_yok');
    }
    expect(await baglantilar(SA_HEDEF)).toEqual([
      {
        kod_ozeti: ozet(saKodu),
        kullanilmis: false,
        olusturan_id: ortam.superadmin.id,
      },
    ]);
  });

  it('aynı yönetici sıradan kullanıcı için üretebilir', async () => {
    const cevap = await baglantiUret(SIRADAN, yonetici);
    expect(cevap.status).toBe(201);
    const kod = (cevap.body as { parolaBaglantisiKodu: string })
      .parolaBaglantisiKodu;
    expect(await baglantilar(SIRADAN)).toEqual([
      expect.objectContaining({ kod_ozeti: ozet(kod), kullanilmis: false }),
    ]);
  });

  it('SuperAdmin, bir SuperAdmin için üretebilir; eski bağlantı silinir', async () => {
    const cevap = await baglantiUret(SA_HEDEF);
    expect(cevap.status).toBe(201);
    const kod = (cevap.body as { parolaBaglantisiKodu: string })
      .parolaBaglantisiKodu;
    expect(await baglantilar(SA_HEDEF)).toEqual([
      expect.objectContaining({ kod_ozeti: ozet(kod), kullanilmis: false }),
    ]);
  });
});

describe('f) bağlantı üretilmeyen kişiler', () => {
  it.each([
    ['sistem aktörü', SISTEM],
    ['pasif kişi', PASIF],
    ['unutulmuş kişi', UNUTULMUS],
    ['kullanıcı adı boş kişi', ADSIZ],
  ])('%s için 409 cakisma döner ve hiçbir şey değişmez', async (_ad, id) => {
    await reddedilir(() => baglantiUret(id), 409, 'cakisma');
  });

  it('tohumun yazdığı kimlik sistem aktörü için 409 cakisma', async () => {
    const [aktor] = await satirlar<{ id: string }>(
      "select id from kullanici where sistem_aktoru and gorunen_ad = 'kimlik'",
    );
    expect(aktor).toBeDefined();
    await reddedilir(() => baglantiUret(aktor?.id ?? ''), 409, 'cakisma');
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    await reddedilir(
      () => gonder('patch', `${YOL}/${SIRADAN}`, { gorunenAd: 'X' }),
      401,
      'kimlik_gerekli',
    );
    await reddedilir(
      () => gonder('post', `${YOL}/${SIRADAN}/parola-baglantisi`, undefined),
      401,
      'kimlik_gerekli',
    );
  });

  it('o işin izni olmayan giriş yapmış kişi 403 yetki_yok; hiçbir satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('kullanici-yetkisiz');
    await reddedilir(
      () => guncelle(SIRADAN, { gorunenAd: 'X' }, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
    await reddedilir(
      () => baglantiUret(SIRADAN, kisi.erisimBelirteci),
      403,
      'yetki_yok',
    );
  });

  it('var olmayan kimlik 404 bulunamadi', async () => {
    await reddedilir(
      () => guncelle(YOK, { gorunenAd: 'X' }),
      404,
      'bulunamadi',
    );
    await reddedilir(() => baglantiUret(YOK), 404, 'bulunamadi');
  });

  it('şemaya uymayan gövde, şemada olmayan alan ve kimlik olmayan yol 400 dogrulama_hatasi', async () => {
    for (const govde of [
      {},
      { gorunenAd: '' },
      { gorunenAd: '   ' },
      { gorunenAd: 'x'.repeat(201) },
      { gorunenAd: null },
      { gorunenAd: 5 },
      { gorunenAd: 'X', baska: 1 },
    ]) {
      await reddedilir(() => guncelle(SIRADAN, govde), 400, 'dogrulama_hatasi');
    }
    await reddedilir(
      () => guncelle('abc', { gorunenAd: 'X' }),
      400,
      'dogrulama_hatasi',
    );
    for (const govde of [{ gorunenAd: 'X' }, { kod: 'abc' }]) {
      await reddedilir(
        () => baglantiUret(SIRADAN, undefined, govde),
        400,
        'dogrulama_hatasi',
      );
    }
    await reddedilir(() => baglantiUret('abc'), 400, 'dogrulama_hatasi');
  });
});
