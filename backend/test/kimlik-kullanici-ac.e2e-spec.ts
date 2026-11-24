// Kullanıcı aç (GV-062; TS-002 "İşlem sınırları", AK-39; KR-008 Seçim 31; izin Kullanici:olustur).
// Koşturma:
//   pnpm -C backend test:e2e test/kimlik-kullanici-ac.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) göçleri uygulanmış geçici veritabanlarında
// açılır: tohum, giriş yapmış ilk yönetici (superadmin). Yetkisi daraltılmış kişilerin rol, üyelik ve
// yetenek satırları SQL ile yazılır. Notlar outbox_iz tablosundan okunur.
import { createHash } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/istemci-adresi-imzasi.js';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

const UC = '/kimlik/kullanici';
const IS_ADI = 'kimlik:kullanici-ac';
const PAROLA = 'yeni kisinin uzun ve dogru parola cümlesi';
const IP = '203.0.113.62';
const TARAYICI = 'Mozilla/5.0 kullanici ac';

const ROL_DAR = '92000000-0000-4000-8000-000000000001';
const UYELIK_DAR = '93000000-0000-4000-8000-000000000001';
const YETENEK_DAR = '94000000-0000-4000-8000-000000000001';

interface Not {
  kullanici_id: string;
  uyelik_id: string | null;
  yetenek_id: string | null;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  veri_sahibi_kullanici_id: string | null;
  eylem: string;
  degisen: Record<string, { eski?: unknown; yeni?: unknown }>;
}

interface Acilan {
  id: string;
  parolaBaglantisiKodu: string;
}

let ortam: KimlikOrtami;

function ac(govde: unknown, erisimBelirteci?: string): request.Test {
  const istek = request(ortam.app.getHttpServer()).post(UC);
  return (
    erisimBelirteci === undefined
      ? istek
      : istek.set(ortam.basliklar(erisimBelirteci))
  ).send(govde as object);
}

async function basariylaAc(govde: unknown): Promise<Acilan> {
  const cevap = await ac(govde, ortam.superadmin.erisimBelirteci);
  expect(cevap.status).toBe(201);
  return cevap.body as Acilan;
}

// Oturumsuz uçlar için aracı katmanın imzaladığı istemci adresi başlıkları.
function adresBasliklari(): Record<string, string> {
  const zaman = Date.now();
  return {
    [ISTEMCI_BASLIKLARI.adres]: IP,
    [ISTEMCI_BASLIKLARI.tarayici]: TARAYICI,
    [ISTEMCI_BASLIKLARI.zaman]: String(zaman),
    [ISTEMCI_BASLIKLARI.imza]: istemciImzasiUret(
      process.env[ARACI_KATMAN_SIRRI_DEGISKENI] ?? '',
      { adres: IP, tarayici: TARAYICI, zaman },
    ),
  };
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await ortam.db.query<T>(sql, degerler)).rows;
}

// Bu işin, verilen kişiyle ilgili notları (kişinin kendi kaydı ya da verisinin sahibi olduğu kayıtlar).
async function notlar(kullaniciId: string): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      `select govde from outbox_iz
        where govde->>'is_adi' = $1
          and (govde->>'kayit_id' = $2 or govde->>'veri_sahibi_kullanici_id' = $2)
        order by olusturma_zamani, id`,
      [IS_ADI, kullaniciId],
    )
  ).map((s) => s.govde);
}

// Reddedilen işin hiçbir satırı değiştirmediğini göstermek için ilgili tabloların sayıları.
async function sayilar(): Promise<Record<string, number>> {
  const [satir] = await satirlar<Record<string, number>>(
    `select (select count(*)::int from kullanici) as kullanici,
            (select count(*)::int from uyelik) as uyelik,
            (select count(*)::int from parola_baglantisi) as baglanti,
            (select count(*)::int from outbox_iz) as iz,
            (select count(*)::int from outbox_olay) as olay`,
  );
  return satir ?? {};
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
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

describe('a) ilk yönetici kullanıcı açar', () => {
  let acilan: Acilan;
  let olayOncesi: number;
  const ciktilar: string[] = [];

  beforeAll(async () => {
    olayOncesi = (await sayilar())['olay'] ?? -1;
    // Kod günlüğe yazılmaz: istek boyunca standart çıktı ve hata akışına yazılanlar toplanır.
    const yakala = (akis: NodeJS.WriteStream) =>
      vi.spyOn(akis, 'write').mockImplementation((parca: unknown) => {
        ciktilar.push(String(parca));
        return true;
      });
    const casuslar = [yakala(process.stdout), yakala(process.stderr)];
    try {
      acilan = await basariylaAc({
        kullaniciAdi: 'Ayse.Yilmaz_1-a',
        gorunenAd: '  Ayşe Yılmaz  ',
      });
    } finally {
      for (const casus of casuslar) {
        casus.mockRestore();
      }
    }
  });

  it('201 yalnız kimlik ve kod döner', () => {
    expect(Object.keys(acilan).sort()).toEqual(['id', 'parolaBaglantisiKodu']);
    expect(acilan.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(acilan.parolaBaglantisiKodu).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('kullanici satırı küçük harfli adla ve boşluğu atılmış görünen adla yazılmıştır', async () => {
    expect(
      await satirlar(
        'select kullanici_adi, gorunen_ad, telefon, sistem_aktoru, pasif_zamani from kullanici where id = $1',
        [acilan.id],
      ),
    ).toEqual([
      {
        kullanici_adi: 'ayse.yilmaz_1-a',
        gorunen_ad: 'Ayşe Yılmaz',
        telefon: null,
        sistem_aktoru: false,
        pasif_zamani: null,
      },
    ]);
  });

  it('kişinin tek üyeliği canlı (Kök, Temel) üyeliğidir', async () => {
    expect(
      await satirlar(
        `select g.ust_grup_id is null as kok, r.kod, u.silinme_zamani
           from uyelik u join grup g on g.id = u.grup_id join rol r on r.id = u.rol_id
          where u.kullanici_id = $1`,
        [acilan.id],
      ),
    ).toEqual([{ kok: true, kod: 'temel', silinme_zamani: null }]);
  });

  it('parola_baglantisi satırında yalnız kodun özeti vardır ve olusturan_id isteği yapandır', async () => {
    const baglantilar = await satirlar<{ metin: string }>(
      'select to_jsonb(b)::text as metin from parola_baglantisi b where kullanici_id = $1',
      [acilan.id],
    );
    expect(baglantilar).toHaveLength(1);
    expect(baglantilar[0]?.metin).not.toContain(acilan.parolaBaglantisiKodu);
    expect(
      await satirlar(
        'select kod_ozeti, olusturan_id, kullanilma_zamani from parola_baglantisi where kullanici_id = $1',
        [acilan.id],
      ),
    ).toEqual([
      {
        kod_ozeti: createHash('sha256')
          .update(acilan.parolaBaglantisiKodu)
          .digest('hex'),
        olusturan_id: ortam.superadmin.id,
        kullanilma_zamani: null,
      },
    ]);
  });

  it('kod istek boyunca günlüğe yazılmaz ve olay yazılmaz', async () => {
    expect(ciktilar.join('')).not.toContain(acilan.parolaBaglantisiKodu);
    expect((await sayilar())['olay']).toBe(olayOncesi);
  });

  it('f) kullanici, uyelik ve bağlantı için notlar yazılmıştır; bağlantının notu kodu ya da özetini taşımaz', async () => {
    const hepsi = await notlar(acilan.id);
    expect(hepsi.map((n) => [n.kaynak, n.eylem]).sort()).toEqual([
      ['Kullanici', 'olusturma'],
      ['ParolaBaglantisi', 'olusturma'],
      ['Uyelik', 'olusturma'],
    ]);
    for (const not of hepsi) {
      expect(not.is_adi).toBe(IS_ADI);
      expect(not.kullanici_id).toBe(ortam.superadmin.id);
    }
    const kullanici = hepsi.find((n) => n.kaynak === 'Kullanici');
    expect(kullanici).toMatchObject({ kayit_id: acilan.id });
    // Kapıdan geçen yazma, kullanılan yeteneği ve üyeliği taşır.
    expect(kullanici?.yetenek_id).not.toBeNull();
    expect(kullanici?.uyelik_id).not.toBeNull();
    expect(kullanici?.degisen).toMatchObject({
      kullanici_adi: { yeni: 'ayse.yilmaz_1-a' },
      gorunen_ad: { yeni: 'Ayşe Yılmaz' },
      sistem_aktoru: { yeni: false },
    });
    const uyelik = hepsi.find((n) => n.kaynak === 'Uyelik');
    expect(uyelik?.veri_sahibi_kullanici_id).toBe(acilan.id);
    expect(Object.keys(uyelik?.degisen ?? {})).toEqual(
      expect.arrayContaining(['kullanici_id', 'grup_id', 'rol_id']),
    );
    const baglanti = hepsi.find((n) => n.kaynak === 'ParolaBaglantisi');
    expect(baglanti?.degisen).toMatchObject({
      kullanici_id: { yeni: acilan.id },
      olusturan_id: { yeni: ortam.superadmin.id },
    });
    const metin = JSON.stringify(baglanti);
    expect(metin).not.toContain(acilan.parolaBaglantisiKodu);
    expect(metin).not.toContain(
      createHash('sha256').update(acilan.parolaBaglantisiKodu).digest('hex'),
    );
    expect(Object.keys(baglanti?.degisen ?? {})).not.toContain('kod_ozeti');
  });
});

describe('b) gerçek yol', () => {
  it('dönen kodla parola belirlenir ve yeni kişi giriş yapar', async () => {
    const acilan = await basariylaAc({
      kullaniciAdi: 'Yeni.Kisi',
      gorunenAd: 'Yeni Kişi',
    });
    const belirle = await request(ortam.app.getHttpServer())
      .post('/kimlik/parola/belirle')
      .send({ kod: acilan.parolaBaglantisiKodu, parola: PAROLA });
    expect(belirle.status).toBe(204);
    const giris = await request(ortam.app.getHttpServer())
      .post('/kimlik/oturum/giris')
      .set(adresBasliklari())
      .send({ kullaniciAdi: 'yeni.kisi', parola: PAROLA });
    expect(giris.status).toBe(200);
    expect(giris.body).toHaveProperty('erisimBelirteci');
    expect(
      await satirlar(
        'select count(*)::int as sayi from oturum where kullanici_id = $1',
        [acilan.id],
      ),
    ).toEqual([{ sayi: 1 }]);
  });
});

describe('c) aynı kullanıcı adı', () => {
  it('aynı ad ve büyük harfli yazımı 409 cakisma döner, ikinci satır oluşmaz ve not yazılmaz', async () => {
    await basariylaAc({ kullaniciAdi: 'cakisan', gorunenAd: 'İlk' });
    const once = await sayilar();
    for (const kullaniciAdi of ['cakisan', 'CAKISAN', 'Cakisan']) {
      const cevap = await ac(
        { kullaniciAdi, gorunenAd: 'İkinci' },
        ortam.superadmin.erisimBelirteci,
      );
      expect(cevap.status).toBe(409);
      expect(cevap.body).toMatchObject({ kod: 'cakisma' });
    }
    expect(await sayilar()).toEqual(once);
    expect(
      await satirlar(
        "select gorunen_ad from kullanici where lower(kullanici_adi) = 'cakisan'",
      ),
    ).toEqual([{ gorunen_ad: 'İlk' }]);
  });
});

describe('d) doğrulama', () => {
  const gecerli = { kullaniciAdi: 'gecerli.ad', gorunenAd: 'Geçerli' };
  const govdeler: [string, unknown][] = [
    ['iki karakterli ad', { ...gecerli, kullaniciAdi: 'ab' }],
    ['65 karakterli ad', { ...gecerli, kullaniciAdi: 'a'.repeat(65) }],
    ['boşluklu ad', { ...gecerli, kullaniciAdi: 'ali veli' }],
    ['Türkçe harfli ad', { ...gecerli, kullaniciAdi: 'ayşe' }],
    ['izin verilmeyen işaretli ad', { ...gecerli, kullaniciAdi: 'ali@veli' }],
    ['boş ad', { ...gecerli, kullaniciAdi: '' }],
    ['sayı olan ad', { ...gecerli, kullaniciAdi: 12345 }],
    ['boş görünen ad', { ...gecerli, gorunenAd: '' }],
    ['yalnız boşluk olan görünen ad', { ...gecerli, gorunenAd: '   ' }],
    ['201 karakterli görünen ad', { ...gecerli, gorunenAd: 'a'.repeat(201) }],
    ['telefon alanı', { ...gecerli, telefon: '+905551112233' }],
    ['sistemAktoru alanı', { ...gecerli, sistemAktoru: true }],
    [
      'şemada olmayan alan',
      { ...gecerli, id: '00000000-0000-7000-8000-000000000001' },
    ],
    ['eksik görünen ad', { kullaniciAdi: 'gecerli.ad' }],
    ['eksik kullanıcı adı', { gorunenAd: 'Geçerli' }],
  ];

  it.each(govdeler)(
    '%s 400 dogrulama_hatasi döner ve satır değişmez',
    async (_ad, govde) => {
      const once = await sayilar();
      const cevap = await ac(govde, ortam.superadmin.erisimBelirteci);
      expect(cevap.status).toBe(400);
      expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
      expect(await sayilar()).toEqual(once);
    },
  );

  it('sınırdaki değerler kabul edilir: 3 ve 64 karakterli ad, 200 karakterli görünen ad', async () => {
    await basariylaAc({ kullaniciAdi: 'a.b', gorunenAd: 'g'.repeat(200) });
    await basariylaAc({ kullaniciAdi: 'b'.repeat(64), gorunenAd: 'Uzun ad' });
  });
});

describe('e) kolonla sınırlı oluşturma yeteneği', () => {
  it('gorunenAd kolonunu kapsamayan Kullanici:olustur yeteneği 403 yetki_yok alır ve satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('dar-olusturucu');
    // Üyelik ve yetenek kişinin ilk oturumlu isteğinden önce yazılır; yetkisi bunlarla derlenir.
    await ortam.db.query(
      "insert into rol (id, ad) values ($1, 'Dar oluşturucu')",
      [ROL_DAR],
    );
    await ortam.db.query(
      `insert into uyelik (id, kullanici_id, grup_id, rol_id)
         select $1, $2, g.id, $3 from grup g
          where g.ust_grup_id is null and g.silinme_zamani is null`,
      [UYELIK_DAR, kisi.id, ROL_DAR],
    );
    await ortam.db.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, kolonlar, koken)
         select $1, g.id, $2, i.id, true, array['kullaniciAdi'], 'yonetici' from grup g, izin i
          where g.ust_grup_id is null and g.silinme_zamani is null
            and i.kaynak = 'Kullanici' and i.eylem = 'olustur'`,
      [YETENEK_DAR, ROL_DAR],
    );
    const once = await sayilar();
    const cevap = await ac(
      { kullaniciAdi: 'dar.yoldan', gorunenAd: 'Dar' },
      kisi.erisimBelirteci,
    );
    expect(cevap.status).toBe(403);
    expect(cevap.body).toMatchObject({ kod: 'yetki_yok' });
    expect(await sayilar()).toEqual(once);
  });
});

describe('ortak', () => {
  it('belirteçsiz istek 401 kimlik_gerekli', async () => {
    const once = await sayilar();
    const cevap = await ac({ kullaniciAdi: 'belirtecsiz', gorunenAd: 'B' });
    expect(cevap.status).toBe(401);
    expect(cevap.body).toMatchObject({ kod: 'kimlik_gerekli' });
    expect(await sayilar()).toEqual(once);
  });

  it('Kullanici:olustur izni olmayan giriş yapmış kişi 403 yetki_yok alır ve satır değişmez', async () => {
    const kisi = await ortam.kullaniciAc('yetkisiz');
    const once = await sayilar();
    const cevap = await ac(
      { kullaniciAdi: 'yetkisizden', gorunenAd: 'Y' },
      kisi.erisimBelirteci,
    );
    expect(cevap.status).toBe(403);
    expect(cevap.body).toMatchObject({ kod: 'yetki_yok' });
    expect(await sayilar()).toEqual(once);
  });
});
