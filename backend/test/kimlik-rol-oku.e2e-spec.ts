// Rol ve izin okuma uçları (GV-056; TS-002 AK-39, "Uçlar ve izinler"). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-rol-oku.e2e-spec.ts --reporter=verbose
// Uygulama ortak kurulum yardımcısıyla (kimlik-yardimci.ts) açılır: tohum, giriş yapmış ilk yönetici
// ve SQL ile açılan kişiler. Bir kişiye yetenek, ona özel bir rolle (Kök, rol) üyeliği ve o kümeye
// bağlı yetenek satırı SQL ile yazılarak verilir; kişinin sayısı artırılır ki yetki belleği yenilensin.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { type KimlikOrtami, kimlikOrtamiKur } from './kimlik-yardimci.js';
import { localInfrastructure } from './local-infrastructure.js';

interface ListeCevabi {
  kayitlar: Record<string, unknown>[];
  sayfa: number;
  boyut: number;
  sonrakiVar: boolean;
}

// TS-002 "Uçlar ve izinler"deki Kullanici eylemleri.
const KULLANICI_EYLEMLERI = [
  'oku',
  'olustur',
  'guncelle',
  'giris_bilgisini_degistir',
  'pasife_al',
  'yeniden_ac',
  'parola_baglantisi_uret',
  'unut',
];

let ortam: KimlikOrtami;
let kokGrup: string;
let temelRol: string;
let adSayaci = 0;

function yeniAd(): string {
  adSayaci += 1;
  return `rolsinama${String(adSayaci)}`;
}

function getir(yol: string, belirtec?: string): request.Test {
  const istek = request(ortam.app.getHttpServer()).get(yol);
  return belirtec === undefined ? istek : istek.set(ortam.basliklar(belirtec));
}

async function rolEkle(ad: string, kod: string | null = null): Promise<string> {
  const id = randomUUID();
  await ortam.db.query('insert into rol (id, kod, ad) values ($1, $2, $3)', [
    id,
    kod,
    ad,
  ]);
  return id;
}

interface Yetenek {
  kaynak: string;
  sart?: object[];
  kolonlar?: string[];
}

// Kişiye (Kök, yeni rol) üyeliği ve o kümeye "oku" yeteneği verir. Şart yoksa bütün kayıtlar,
// kolon yoksa bütün kolonlar.
async function yetenekVer(
  kisiId: string,
  { kaynak, sart, kolonlar }: Yetenek,
): Promise<void> {
  const rolId = await rolEkle('Sınama');
  await ortam.db.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)`,
    [randomUUID(), kisiId, kokGrup, rolId],
  );
  await ortam.db.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, koken)
     select $1, $2, $3, i.id, $4::jsonb, $5, $6, $7, 'test'
       from izin i where i.kaynak = $8 and i.eylem = 'oku'`,
    [
      randomUUID(),
      kokGrup,
      rolId,
      sart === undefined ? null : JSON.stringify(sart),
      sart === undefined,
      kolonlar ?? null,
      kolonlar === undefined,
      kaynak,
    ],
  );
  await ortam.db.query(
    'update kullanici set yetki_surumu = yetki_surumu + 1 where id = $1',
    [kisiId],
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
    rows: [satir],
  } = await ortam.db.query<{ kok: string; temel: string }>(
    `select (select id from grup where ust_grup_id is null and silinme_zamani is null) as kok,
            (select id from rol where kod = 'temel') as temel`,
  );
  if (satir === undefined) {
    throw new Error('tohum kök grubu ya da temel rolü yazmadı');
  }
  kokGrup = satir.kok;
  temelRol = satir.temel;
}, 60_000);

afterAll(async () => {
  const adlar = ortam.veritabanlari;
  expect(await ortam.kapat()).toEqual({ kalanBaglanti: 0 });
  expect(await kalanVeritabanlari(adlar)).toEqual([]);
});

async function silinmisRolEkle(ad: string): Promise<string> {
  const id = await rolEkle(ad);
  await ortam.db.query(
    'update rol set silinme_zamani = clock_timestamp() where id = $1',
    [id],
  );
  return id;
}

describe('a) rol listesi ve tek kayıt', () => {
  it('silinmiş işaretlenen rol listede yoktur; tek kayıt ucunda kimliğiyle okunur (TS-002 AK-42)', async () => {
    const silinmis = await silinmisRolEkle('Silinmiş');
    const liste = await getir(
      '/kimlik/rol?boyut=100',
      ortam.superadmin.erisimBelirteci,
    );
    expect(liste.status).toBe(200);
    const govde = liste.body as ListeCevabi;
    expect(govde.sonrakiVar).toBe(false);
    expect(govde.kayitlar.length).toBeGreaterThan(0);
    expect(govde.kayitlar.map((k) => k['id'])).not.toContain(silinmis);
    for (const kayit of govde.kayitlar) {
      expect(kayit['silinmeZamani']).toBeNull();
    }

    const tek = await getir(
      `/kimlik/rol/${silinmis}`,
      ortam.superadmin.erisimBelirteci,
    );
    expect(tek.status).toBe(200);
    expect(tek.body).toMatchObject({ id: silinmis, ad: 'Silinmiş' });
    expect((tek.body as Record<string, unknown>)['silinmeZamani']).not.toBeNull();
  });

  it('ilk yönetici listede kurulumun iki sistem rolünü kodlarıyla görür', async () => {
    const cevap = await getir(
      '/kimlik/rol?boyut=100',
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(200);
    const govde = cevap.body as ListeCevabi;
    expect(govde).toMatchObject({ sayfa: 1, boyut: 100, sonrakiVar: false });
    const kodlar = govde.kayitlar.map((k) => k['kod']);
    expect(kodlar).toEqual(expect.arrayContaining(['temel', 'superadmin']));
  });

  it('ilk yönetici tek rol kaydını okur', async () => {
    const cevap = await getir(
      `/kimlik/rol/${temelRol}`,
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(200);
    expect(cevap.body).toMatchObject({ id: temelRol, kod: 'temel' });
  });
});

describe('b) izin listesi', () => {
  it('kurulumun yazdığı izinleri verir; Kullanici eylemleri TS-002 listesiyle aynıdır', async () => {
    const cevap = await getir(
      '/kimlik/izin?boyut=100',
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(200);
    const govde = cevap.body as ListeCevabi;
    expect(govde.sonrakiVar).toBe(false);
    const { rows } = await ortam.db.query<{
      id: string;
      kaynak: string;
      eylem: string;
    }>('select id, kaynak, eylem from izin');
    expect(rows.length).toBeGreaterThan(0);
    expect(govde.kayitlar).toHaveLength(rows.length);
    expect(govde.kayitlar).toEqual(expect.arrayContaining(rows));
    expect(
      govde.kayitlar
        .filter((k) => k['kaynak'] === 'Kullanici')
        .map((k) => k['eylem'])
        .sort(),
    ).toEqual([...KULLANICI_EYLEMLERI].sort());
  });
});

describe('ortak', () => {
  const uclar = () => [
    '/kimlik/rol',
    `/kimlik/rol/${temelRol}`,
    '/kimlik/izin',
  ];

  it('belirteçsiz istek 401 kimlik_gerekli döner', async () => {
    for (const yol of uclar()) {
      const cevap = await getir(yol);
      expect([yol, cevap.status, cevap.body]).toMatchObject([
        yol,
        401,
        { kod: 'kimlik_gerekli' },
      ]);
    }
  });

  it('okuma yeteneği olmayan giriş yapmış kişi 403 yetki_yok alır (tür düzeyi)', async () => {
    const kisi = await ortam.kullaniciAc(yeniAd());
    for (const yol of uclar()) {
      const cevap = await getir(yol, kisi.erisimBelirteci);
      expect([yol, cevap.status, cevap.body]).toMatchObject([
        yol,
        403,
        { kod: 'yetki_yok' },
      ]);
    }
  });

  it('var olmayan rol kimliği 404 bulunamadi döner', async () => {
    const cevap = await getir(
      `/kimlik/rol/${randomUUID()}`,
      ortam.superadmin.erisimBelirteci,
    );
    expect(cevap.status).toBe(404);
    expect(cevap.body).toMatchObject({ kod: 'bulunamadi' });
  });

  it('boyut 100den büyükse, sıralama alanı listede değilse ve kimlik biçimi bozuksa 400 dogrulama_hatasi döner', async () => {
    for (const yol of [
      '/kimlik/rol?boyut=101',
      '/kimlik/rol?sirala=silinmeZamani',
      '/kimlik/izin?boyut=101',
      '/kimlik/izin?sirala=-id',
      '/kimlik/rol/kimlik-degil',
    ]) {
      const cevap = await getir(yol, ortam.superadmin.erisimBelirteci);
      expect([yol, cevap.status, cevap.body]).toMatchObject([
        yol,
        400,
        { kod: 'dogrulama_hatasi' },
      ]);
    }
  });

  it('yalnız bir kolonu gören yetenekle gelen kayıtlar o kolonu ve kimliği taşır, başka kolon taşımaz', async () => {
    const kisi = await ortam.kullaniciAc(yeniAd());
    await yetenekVer(kisi.id, { kaynak: 'Rol', kolonlar: ['ad'] });
    await yetenekVer(kisi.id, { kaynak: 'Izin', kolonlar: ['kaynak'] });

    const rol = await getir(`/kimlik/rol/${temelRol}`, kisi.erisimBelirteci);
    expect(rol.status).toBe(200);
    expect(Object.keys(rol.body as object).sort()).toEqual(['ad', 'id']);

    const roller = await getir('/kimlik/rol', kisi.erisimBelirteci);
    expect(roller.status).toBe(200);
    const rolKayitlari = (roller.body as ListeCevabi).kayitlar;
    expect(rolKayitlari.length).toBeGreaterThan(0);
    for (const kayit of rolKayitlari) {
      expect(Object.keys(kayit).sort()).toEqual(['ad', 'id']);
    }

    const izinler = await getir('/kimlik/izin', kisi.erisimBelirteci);
    expect(izinler.status).toBe(200);
    const { kayitlar } = izinler.body as ListeCevabi;
    expect(kayitlar.length).toBeGreaterThan(0);
    for (const kayit of kayitlar) {
      expect(Object.keys(kayit).sort()).toEqual(['id', 'kaynak']);
    }
  });

  it('silinme zamanını göremeyen okuma yeteneği listede canlı rolleri kendi kolonlarıyla görür (TS-002 AK-42)', async () => {
    const kisi = await ortam.kullaniciAc(yeniAd());
    const canli = await rolEkle('Canlılık');
    const silinmis = await silinmisRolEkle('Canlılık');
    await yetenekVer(kisi.id, {
      kaynak: 'Rol',
      sart: [{ alan: 'ad', islec: 'esit', deger: 'Canlılık' }],
      kolonlar: ['ad'],
    });

    const cevap = await getir('/kimlik/rol', kisi.erisimBelirteci);
    expect(cevap.status).toBe(200);
    expect((cevap.body as ListeCevabi).kayitlar).toEqual([
      { id: canli, ad: 'Canlılık' },
    ]);

    const tek = await getir(`/kimlik/rol/${silinmis}`, kisi.erisimBelirteci);
    expect(tek.status).toBe(200);
    expect(tek.body).toEqual({ id: silinmis, ad: 'Canlılık' });
  });

  it('sayfa ve sonrakiVar boyut 2 ile üç kayıtta doğru çalışır (rol, kod sırasıyla)', async () => {
    const kisi = await ortam.kullaniciAc(yeniAd());
    for (const kod of ['sayfa3', 'sayfa1', 'sayfa2']) {
      await rolEkle('Sayfa', kod);
    }
    await yetenekVer(kisi.id, {
      kaynak: 'Rol',
      sart: [{ alan: 'ad', islec: 'esit', deger: 'Sayfa' }],
    });
    const sayfa = async (yol: string) => {
      const cevap = await getir(yol, kisi.erisimBelirteci);
      expect(cevap.status).toBe(200);
      const govde = cevap.body as ListeCevabi;
      return { ...govde, kayitlar: govde.kayitlar.map((k) => k['kod']) };
    };
    expect(await sayfa('/kimlik/rol?boyut=2&sirala=kod')).toEqual({
      kayitlar: ['sayfa1', 'sayfa2'],
      sayfa: 1,
      boyut: 2,
      sonrakiVar: true,
    });
    expect(await sayfa('/kimlik/rol?boyut=2&sayfa=2&sirala=kod')).toEqual({
      kayitlar: ['sayfa3'],
      sayfa: 2,
      boyut: 2,
      sonrakiVar: false,
    });
    expect(await sayfa('/kimlik/rol?boyut=2&sirala=-kod')).toEqual({
      kayitlar: ['sayfa3', 'sayfa2'],
      sayfa: 1,
      boyut: 2,
      sonrakiVar: true,
    });
  });

  it('sayfa ve sonrakiVar boyut 2 ile üç kayıtta doğru çalışır (izin, eylem sırasıyla)', async () => {
    const kisi = await ortam.kullaniciAc(yeniAd());
    await yetenekVer(kisi.id, {
      kaynak: 'Izin',
      sart: [{ alan: 'kaynak', islec: 'esit', deger: 'Uyelik' }],
    });
    const eylemler = async (yol: string) => {
      const cevap = await getir(yol, kisi.erisimBelirteci);
      expect(cevap.status).toBe(200);
      const govde = cevap.body as ListeCevabi;
      return [govde.kayitlar.map((k) => k['eylem']), govde.sonrakiVar];
    };
    expect(await eylemler('/kimlik/izin?boyut=2&sirala=eylem')).toEqual([
      ['oku', 'olustur'],
      true,
    ]);
    expect(await eylemler('/kimlik/izin?boyut=2&sayfa=2&sirala=eylem')).toEqual(
      [['sil'], false],
    );
  });
});
