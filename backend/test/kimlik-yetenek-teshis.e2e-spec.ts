// Teşhis ucu: bir kişi, eylem, kaynak ve kayıt için tutan kurallar, karar veren kural ve ret kayıtları
// (GV-156; TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-14, AU-19 ve AU-32; KU-017, KU-018).
// Koşturma:
//   pnpm -C backend test:e2e test/kimlik-yetenek-teshis.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; başlangıcı tohum
// koşucusu kurar. Yasak satırları asıl veritabanına doğrudan yazılır; yasak yazımını kapatan geçici kısıt
// test yardımcısıyla düşürülür. Her yetenek satırından sonra genel sayaç artırılır (derlenmiş yetki
// yenilenir). İstekler uçtan (HTTP) gönderilir. Teşhisin kararı, aynı kişinin aynı kaydı uçtan okumasıyla
// (motorun kararı) karşılaştırılır.
import { type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { KIMLIK_KURULUM_GOCU } from '../src/features/kimlik/_shared/infrastructure/tohum/kimlik-kurulum.goc.js';
import { BelirtecServisi } from '../src/shared/guvenlik/application/belirtec.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/application/istemci-adresi-imzasi.js';
import {
  ISTEK_KIMLIGI_BASLIGI,
  varsaIstekBaglami,
} from '../src/shared/observability/istek-baglami/istek-baglami.js';
import { TohumKosucusu } from '../src/shared/tohum/infrastructure/tohum-kosucusu.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const IP = '203.0.113.37';
const TARAYICI = 'Mozilla/5.0 teshis deneme';

// Kimlikler: kişiler c0…, gruplar c1…, roller c2…, üyelikler c3…, yetenekler c4…, oturumlar c5…, okunan
// hedef kullanıcılar c6…; doğrudan yazılan ret kayıtları c7…, istekleri c8…, kayıtları c9….
const MUDUR = 'c2000000-0000-4000-8000-000000000001';
const STAJYER = 'c2000000-0000-4000-8000-000000000002';
const H1 = 'c6000000-0000-4000-8000-000000000001';
const H2 = 'c6000000-0000-4000-8000-000000000002';

// Senaryo 2'nin yasağının şartı: oturumun sahibi isteği yapan değil.
const BASKASININ_OTURUMU = [
  { alan: 'kullaniciId', islec: 'esit_degil', deger: { yerTutucu: 'isteyen' } },
];

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let izGozlemci: pg.Client;
let gozlemciPidleri: number[];
let kokGrup: string;
let kokYonetici: Kisi;
let yetenekNo = 0;

function uygulama(): INestApplication<App> {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app;
}

async function tekSatir<T extends pg.QueryResultRow>(
  istemci: pg.Client,
  sql: string,
  degerler: unknown[] = [],
): Promise<T> {
  const [satir] = (await istemci.query<T>(sql, degerler)).rows;
  if (satir === undefined) {
    throw new Error(`satır yok: ${sql}`);
  }
  return satir;
}

function kimlik(onek: string, no: number): string {
  return `${onek}000000-0000-4000-8000-${String(no).padStart(12, '0')}`;
}

interface Kisi {
  readonly id: string;
  readonly grup: string;
  readonly oturum: string;
}

async function oturumAc(kisi: string, no: number): Promise<string> {
  const oturum = kimlik('c5', no);
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(), $3, $4)`,
    [oturum, kisi, IP, TARAYICI],
  );
  return oturum;
}

// Kişi: kendi grubu (kökün altında), oturumu ve grubunda Müdür ile Stajyer üyelikleri.
async function kisiKur(no: number): Promise<Kisi> {
  const id = kimlik('c0', no);
  const grup = kimlik('c1', no);
  await gozlemci.query(
    'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
    [grup, kokGrup, `Grup ${String(no)}`],
  );
  await gozlemci.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
    [id, `teshiskisi${String(no)}`],
  );
  for (const [sira, rol] of [MUDUR, STAJYER].entries()) {
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [kimlik('c3', no * 10 + sira), id, grup, rol],
    );
  }
  return { id, grup, oturum: await oturumAc(id, no) };
}

interface YetenekSecenekleri {
  readonly grup: string;
  readonly rol: string;
  readonly kaynak?: string;
  readonly eylem?: string;
  readonly giremez?: boolean;
  readonly oncelik?: number;
  // Saklanan şart olduğu gibi yazılır; verilmezse bütün kayıtlar.
  readonly sart?: unknown;
  // Verilmezse bütün kolonlar.
  readonly kolonlar?: readonly string[];
}

// Yetenek satırı; kaynak verilmezse Kullanici, eylem verilmezse oku. Genel sayaç artırılır.
async function yetenekEkle({
  grup,
  rol,
  kaynak = 'Kullanici',
  eylem = 'oku',
  giremez = false,
  oncelik = 0,
  sart,
  kolonlar,
}: YetenekSecenekleri): Promise<string> {
  yetenekNo += 1;
  const id = kimlik('c4', yetenekNo);
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, giremez, oncelik, koken)
     values ($1, $2, $3, (select id from izin where kaynak = $4 and eylem = $5), $6::jsonb,
             $6::jsonb is null, $7, $7::text[] is null, $8, $9, 'yonetici')`,
    [
      id,
      grup,
      rol,
      kaynak,
      eylem,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
      giremez,
      oncelik,
    ],
  );
  await gozlemci.query('update yetki_surumu set sayac = sayac + 1');
  return id;
}

async function istek(
  kisi: Kisi,
  yontem: (sunucu: ReturnType<typeof request>) => request.Test,
): Promise<request.Response> {
  const zaman = Date.now();
  const belirtec = await new BelirtecServisi(process.env).erisimBelirteciUret({
    kullaniciId: kisi.id,
    oturumId: kisi.oturum,
  });
  return yontem(request(uygulama().getHttpServer())).set({
    authorization: `Bearer ${belirtec}`,
    [ISTEMCI_BASLIKLARI.adres]: IP,
    [ISTEMCI_BASLIKLARI.tarayici]: TARAYICI,
    [ISTEMCI_BASLIKLARI.zaman]: String(zaman),
    [ISTEMCI_BASLIKLARI.imza]: istemciImzasiUret(
      process.env[ARACI_KATMAN_SIRRI_DEGISKENI] ?? '',
      { adres: IP, tarayici: TARAYICI, zaman },
    ),
  });
}

interface TeshisSorgusu {
  readonly kullaniciId: string;
  readonly kaynak: string;
  readonly eylem: string;
  readonly kayitId: string;
}

interface TeshisCevabi {
  readonly tutanKurallar: {
    readonly yetenekId: string;
    readonly etki: 'izin' | 'yasak';
    readonly oncelik: number;
    readonly butunKolonlar: boolean;
    readonly kolonlar: string[];
    readonly muaf: boolean;
    readonly bozuk: boolean;
    readonly degerlendirilemedi: boolean;
  }[];
  readonly kolonKararlari: {
    readonly kolon: string;
    readonly acik: boolean | null;
    readonly kararVeren: string | null;
  }[];
  readonly kayitKarari: { acik: boolean | null; kararVeren: string | null };
  readonly retKayitlari: {
    readonly zaman: string;
    readonly eylem: string;
    readonly kaynak: string;
    readonly kayitId: string | null;
    readonly kararVerenYasakId: string;
  }[];
}

function teshisIstegi(
  soran: Kisi,
  sorgu: TeshisSorgusu,
): Promise<request.Response> {
  return istek(soran, (sunucu) =>
    sunucu.get('/kimlik/yetenek/teshis').query({ ...sorgu }),
  );
}

// Kök yöneticinin sorduğu teşhis; 200 beklenir.
async function teshis(sorgu: TeshisSorgusu): Promise<TeshisCevabi> {
  const cevap = await teshisIstegi(kokYonetici, sorgu);
  expect(cevap.status).toBe(200);
  return cevap.body as TeshisCevabi;
}

// Kolon başına [açık mı, karar veren].
function kolonKararlari(
  cevap: TeshisCevabi,
): Record<string, [boolean | null, string | null]> {
  return Object.fromEntries(
    cevap.kolonKararlari.map((k) => [k.kolon, [k.acik, k.kararVeren]]),
  );
}

// Bütün kolonlar, telefon dışında, verilen kuralla açık; telefon verilen kararla.
function telefonDisindaAcik(
  cevap: TeshisCevabi,
  izin: string,
  telefon: [boolean, string | null],
): Record<string, [boolean, string | null]> {
  return Object.fromEntries(
    cevap.kolonKararlari.map((k) => [
      k.kolon,
      k.kolon === 'telefon' ? telefon : [true, izin],
    ]),
  );
}

// Kişinin kayıt sayfası (motorun kararı).
function kullaniciOku(kisi: Kisi, id: string): Promise<request.Response> {
  return istek(kisi, (sunucu) => sunucu.get(`/kimlik/kullanici/${id}`));
}

function kullaniciTeshisi(kisi: Kisi, kayitId = H1): TeshisSorgusu {
  return { kullaniciId: kisi.id, kaynak: 'Kullanici', eylem: 'oku', kayitId };
}

async function pid(istemci: pg.Client): Promise<number> {
  return (
    await tekSatir<{ pid: number }>(istemci, 'select pg_backend_pid() as pid')
  ).pid;
}

beforeAll(async () => {
  databases = await createAppDatabases({ migrations: true });
  gozlemci = new pg.Client({ connectionString: databases.asil.url });
  izGozlemci = new pg.Client({ connectionString: databases.iz.url });
  try {
    await gozlemci.connect();
    await izGozlemci.connect();
    gozlemciPidleri = [await pid(gozlemci), await pid(izGozlemci)];
    const modul = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    expect(await uygulama().get(TohumKosucusu).kos()).toContain(
      KIMLIK_KURULUM_GOCU,
    );
    await yasakKisitiniDusur(databases.asil);
    kokGrup = (
      await tekSatir<{ id: string }>(
        gozlemci,
        'select id from grup where ust_grup_id is null',
      )
    ).id;
    const kokYoneticiId = (
      await tekSatir<{ id: string }>(
        gozlemci,
        "select id from kullanici where kullanici_adi = 'superadmin'",
      )
    ).id;
    kokYonetici = {
      id: kokYoneticiId,
      grup: kokGrup,
      oturum: await oturumAc(kokYoneticiId, 900),
    };
    await gozlemci.query(
      "insert into rol (id, ad) values ($1, 'Müdür'), ($2, 'Stajyer')",
      [MUDUR, STAJYER],
    );
    await gozlemci.query(
      `insert into kullanici (id, gorunen_ad, telefon)
       values ($1, 'Hedef Bir', '5550001'), ($2, 'Hedef İki', '5550002')`,
      [H1, H2],
    );
  } catch (error) {
    await app?.close();
    await gozlemci.end();
    await izGozlemci.end();
    await databases.drop();
    throw error;
  }
}, 60_000);

afterAll(async () => {
  await app?.close();
  const acikKalan = [
    await kalanBaglantiSayisi(gozlemci, databases.asil.name, gozlemciPidleri),
    await kalanBaglantiSayisi(gozlemci, databases.iz.name, gozlemciPidleri),
  ];
  await gozlemci.end();
  await izGozlemci.end();
  await databases.drop();
  expect(acikKalan).toEqual([0, 0]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('a) teshis izni olmayan kişi 403 alır; kök yönetici 200 alır ve teşhis bir okuma olarak erişim kaydına yazılır', async () => {
  const kisi = await kisiKur(1);
  await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
  await yetenekEkle({ grup: kisi.grup, rol: MUDUR, kaynak: 'Yetenek' });

  const ret = await teshisIstegi(kisi, kullaniciTeshisi(kisi));
  const cevap = await teshisIstegi(kokYonetici, kullaniciTeshisi(kisi));

  expect(ret.status).toBe(403);
  expect(ret.body).toEqual({
    kod: 'yetki_yok',
    ileti: 'Bu işlem için yetki yok',
    ayrinti: null,
  });
  expect(cevap.status).toBe(200);
  const kayitlar = await izGozlemci.query<{ is_adi: string }>(
    'select is_adi from erisim_kaydi where istek_id = $1',
    [cevap.headers[ISTEK_KIMLIGI_BASLIGI]],
  );
  expect(kayitlar.rows).toEqual([{ is_adi: 'YetenekController.teshis' }]);
});

it('b) ve j) Senaryo 1: tutan kurallar izni ve yasağı gösterir; telefonun kararı kapalı ve onu yasak verir, öbür kolonlar açıktır; motor aynı kararı verir; cevapta kaydın değerleri yoktur', async () => {
  const kisi = await kisiKur(2);
  const izin = await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
  const yasak = await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    kolonlar: ['telefon'],
  });

  const cevap = await teshis(kullaniciTeshisi(kisi));

  expect(cevap.tutanKurallar).toEqual([
    {
      yetenekId: izin,
      etki: 'izin',
      oncelik: 0,
      butunKolonlar: true,
      kolonlar: [],
      muaf: false,
      bozuk: false,
      degerlendirilemedi: false,
    },
    {
      yetenekId: yasak,
      etki: 'yasak',
      oncelik: 10,
      butunKolonlar: false,
      kolonlar: ['telefon'],
      muaf: false,
      bozuk: false,
      degerlendirilemedi: false,
    },
  ]);
  expect(kolonKararlari(cevap)).toEqual(
    telefonDisindaAcik(cevap, izin, [false, yasak]),
  );
  expect(cevap.kolonKararlari.map((k) => k.kolon)).toContain('gorunenAd');
  expect(cevap.kayitKarari).toEqual({ acik: true, kararVeren: izin });
  expect(cevap.retKayitlari).toEqual([]);
  // Motorun kararı: kayıt gelir, telefon gelmez.
  const kayit = await kullaniciOku(kisi, H1);
  expect(kayit.status).toBe(200);
  expect(Object.keys(kayit.body as object)).not.toContain('telefon');
  expect(kayit.body).toMatchObject({ id: H1, gorunenAd: 'Hedef Bir' });

  // j) Alan adları dökümü: kaydın kolon değerleri cevapta yoktur.
  expect(Object.keys(cevap).sort()).toEqual([
    'kayitKarari',
    'kolonKararlari',
    'retKayitlari',
    'tutanKurallar',
  ]);
  expect(cevap.tutanKurallar.map((k) => Object.keys(k).sort())).toEqual(
    Array(2).fill([
      'bozuk',
      'butunKolonlar',
      'degerlendirilemedi',
      'etki',
      'kolonlar',
      'muaf',
      'oncelik',
      'yetenekId',
    ]),
  );
  expect(
    new Set(cevap.kolonKararlari.map((k) => Object.keys(k).sort().join())),
  ).toEqual(new Set(['acik,kararVeren,kolon']));
  expect(Object.keys(cevap.kayitKarari).sort()).toEqual(['acik', 'kararVeren']);
  const metin = JSON.stringify(cevap);
  expect(metin).not.toContain('Hedef Bir');
  expect(metin).not.toContain('5550001');
});

it('c) öncelik: yasak 10 ve izin 20 iken kararı izin verir; ikisi 10 iken yasak verir; motor aynı kararı verir', async () => {
  const ust = await kisiKur(3);
  const ustIzin = await yetenekEkle({
    grup: ust.grup,
    rol: MUDUR,
    oncelik: 20,
  });
  await yetenekEkle({
    grup: ust.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    kolonlar: ['telefon'],
  });
  const esit = await kisiKur(4);
  const esitIzin = await yetenekEkle({
    grup: esit.grup,
    rol: MUDUR,
    oncelik: 10,
  });
  const esitYasak = await yetenekEkle({
    grup: esit.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    kolonlar: ['telefon'],
  });

  const ustCevap = await teshis(kullaniciTeshisi(ust));
  const esitCevap = await teshis(kullaniciTeshisi(esit));

  expect(kolonKararlari(ustCevap)).toEqual(
    telefonDisindaAcik(ustCevap, ustIzin, [true, ustIzin]),
  );
  expect(kolonKararlari(esitCevap)).toEqual(
    telefonDisindaAcik(esitCevap, esitIzin, [false, esitYasak]),
  );
  expect((await kullaniciOku(ust, H1)).body).toMatchObject({
    telefon: '5550001',
  });
  expect(
    Object.keys((await kullaniciOku(esit, H1)).body as object),
  ).not.toContain('telefon');
});

it('d) kısıt niyetiyle yazılıp önceliği izinden düşük kalan yasak cevapta görünür ve karar veren kural izindir', async () => {
  const kisi = await kisiKur(5);
  const izin = await yetenekEkle({ grup: kisi.grup, rol: MUDUR, oncelik: 10 });
  const yasak = await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 5,
    kolonlar: ['telefon'],
  });

  const cevap = await teshis(kullaniciTeshisi(kisi));

  expect(cevap.tutanKurallar.map((k) => [k.yetenekId, k.etki])).toEqual([
    [izin, 'izin'],
    [yasak, 'yasak'],
  ]);
  expect(kolonKararlari(cevap)).toEqual(
    telefonDisindaAcik(cevap, izin, [true, izin]),
  );
  expect((await kullaniciOku(kisi, H1)).body).toMatchObject({
    telefon: '5550001',
  });
});

it("e) bozuk yasak 'bozuk' işaretiyle görünür ve bütün kolonların kararını o verir; motor kaydı vermez", async () => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const kisi = await kisiKur(6);
  const izin = await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
  // Kolonlarından biri şemada yok: yasak daralarak yaşamaz, o izni o kişide kapatır.
  const yasak = await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    kolonlar: ['gorunenAd', 'eskiKolon'],
  });

  const cevap = await teshis(kullaniciTeshisi(kisi));

  expect(cevap.tutanKurallar).toEqual([
    expect.objectContaining({ yetenekId: izin, bozuk: false }),
    {
      yetenekId: yasak,
      etki: 'yasak',
      oncelik: 100,
      butunKolonlar: true,
      kolonlar: [],
      muaf: false,
      bozuk: true,
      degerlendirilemedi: false,
    },
  ]);
  expect(
    new Set(
      cevap.kolonKararlari.map((k) => JSON.stringify([k.acik, k.kararVeren])),
    ),
  ).toEqual(new Set([JSON.stringify([false, yasak])]));
  expect(cevap.kayitKarari).toEqual({ acik: false, kararVeren: yasak });
  expect((await kullaniciOku(kisi, H1)).status).toBe(404);
});

it("f) muaf kural 'muaf' işaretiyle görünür; kök yöneticinin kümesine yazılan yasak kolonu kapatmaz", async () => {
  const kokYoneticiRol = (
    await tekSatir<{ id: string }>(
      gozlemci,
      "select id from rol where kod = 'superadmin'",
    )
  ).id;
  const yasak = await yetenekEkle({
    grup: kokGrup,
    rol: kokYoneticiRol,
    giremez: true,
    oncelik: 100,
    kolonlar: ['telefon'],
  });
  try {
    const cevap = await teshis(kullaniciTeshisi(kokYonetici));

    const muaflar = cevap.tutanKurallar.filter((k) => k.muaf);
    expect(muaflar.length).toBeGreaterThan(0);
    expect(muaflar.every((k) => k.etki === 'izin')).toBe(true);
    expect(cevap.tutanKurallar).toContainEqual(
      expect.objectContaining({ yetenekId: yasak, etki: 'yasak', muaf: false }),
    );
    const [telefonAcik, telefonKarari] = kolonKararlari(cevap)['telefon'] ?? [];
    expect(telefonAcik).toBe(true);
    expect(muaflar.map((k) => k.yetenekId)).toContain(telefonKarari);
  } finally {
    await gozlemci.query(
      'update yetenek set silinme_zamani = clock_timestamp() where id = $1',
      [yasak],
    );
    await gozlemci.query('update yetki_surumu set sayac = sayac + 1');
  }
});

it('g) kaydı tutmayan şartlı yasak listede yoktur; kaydı tutan şartlı yasak vardır', async () => {
  const kisi = await kisiKur(7);
  const izin = await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
  await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef İki' }],
    kolonlar: ['telefon'],
  });
  const tutan = await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
    kolonlar: ['kullaniciAdi'],
  });

  const cevap = await teshis(kullaniciTeshisi(kisi));

  expect(cevap.tutanKurallar.map((k) => k.yetenekId)).toEqual([izin, tutan]);
  expect(kolonKararlari(cevap)['telefon']).toEqual([true, izin]);
  expect(kolonKararlari(cevap)['kullaniciAdi']).toEqual([false, tutan]);
  // Motorun kararı: telefon gelir, kullanıcı adı gelmez.
  const kayit = await kullaniciOku(kisi, H1);
  expect(kayit.body).toMatchObject({ id: H1, telefon: '5550001' });
  expect(Object.keys(kayit.body as object)).not.toContain('kullaniciAdi');
});

it('g2) motorla eşlik: kolon listeli iznin tek kolonunu kapatan şartlı yasak, tuttuğu kayıtta izni bütünüyle kapatır', async () => {
  const kisi = await kisiKur(14);
  const izin = await yetenekEkle({
    grup: kisi.grup,
    rol: MUDUR,
    kolonlar: ['gorunenAd'],
  });
  const yasak = await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
    kolonlar: ['gorunenAd'],
  });

  const tutulan = await teshis(kullaniciTeshisi(kisi, H1));
  const tutulmayan = await teshis(kullaniciTeshisi(kisi, H2));

  expect(tutulan.tutanKurallar.map((k) => k.yetenekId)).toEqual([izin, yasak]);
  expect(tutulan.kayitKarari).toEqual({ acik: false, kararVeren: yasak });
  expect(kolonKararlari(tutulan)['gorunenAd']).toEqual([false, yasak]);
  expect(kolonKararlari(tutulan)['telefon']).toEqual([false, null]);
  expect(tutulmayan.tutanKurallar.map((k) => k.yetenekId)).toEqual([izin]);
  expect(tutulmayan.kayitKarari).toEqual({ acik: true, kararVeren: izin });
  expect(kolonKararlari(tutulmayan)['gorunenAd']).toEqual([true, izin]);
  expect(kolonKararlari(tutulmayan)['telefon']).toEqual([false, null]);
  // Motorun kararı: Hedef Bir gelmez; Hedef İki yalnız kimlik ve görünen adla gelir.
  expect((await kullaniciOku(kisi, H1)).status).toBe(404);
  const okunan = await kullaniciOku(kisi, H2);
  expect(okunan.status).toBe(200);
  expect(Object.keys(okunan.body as object).sort()).toEqual([
    'gorunenAd',
    'id',
  ]);
});

it('l2) soranın göremediği kolona bakan şart sorulmaz: kural değerlendirilemedi gelir, ona bağlı kararlar belirsizdir ve gizli kolonun değeri cevabı değiştirmez; kök yönetici kesin karar verir; görünen kolona bakan şart değerlendirilir', async () => {
  const h3 = kimlik('c6', 3);
  await gozlemci.query(
    "insert into kullanici (id, gorunen_ad, telefon) values ($1, 'Hedef Üç', '5550031')",
    [h3],
  );
  const hedef = await kisiKur(15);
  const genis = await yetenekEkle({ grup: hedef.grup, rol: MUDUR });
  const gizliIzin = await yetenekEkle({
    grup: hedef.grup,
    rol: MUDUR,
    oncelik: 20,
    sart: [{ alan: 'telefon', islec: 'esit', deger: '5550039' }],
    kolonlar: ['kullaniciAdi'],
  });
  const gizliYasak = await yetenekEkle({
    grup: hedef.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    sart: [{ alan: 'telefon', islec: 'esit', deger: '5550031' }],
    kolonlar: ['gorunenAd'],
  });
  const gorunenYasak = await yetenekEkle({
    grup: hedef.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Üç' }],
    kolonlar: ['telefon'],
  });
  // Soran: teşhis izni olan, kullanıcılarda yalnız görünen adı gören ikinci yönetici.
  const soran = await kisiKur(16);
  await yetenekEkle({
    grup: soran.grup,
    rol: MUDUR,
    kaynak: 'Yetenek',
    eylem: 'teshis',
  });
  await yetenekEkle({ grup: soran.grup, rol: MUDUR, kaynak: 'Izin' });
  await yetenekEkle({ grup: soran.grup, rol: MUDUR, kolonlar: ['gorunenAd'] });
  const sorgu = kullaniciTeshisi(hedef, h3);
  const telefonla = async (
    telefon: string,
  ): Promise<{ dar: TeshisCevabi; kok: TeshisCevabi }> => {
    await gozlemci.query('update kullanici set telefon = $2 where id = $1', [
      h3,
      telefon,
    ]);
    const dar = await teshisIstegi(soran, sorgu);
    expect(dar.status).toBe(200);
    return { dar: dar.body as TeshisCevabi, kok: await teshis(sorgu) };
  };
  const kararlar = (
    cevap: TeshisCevabi,
    farkli: Record<string, [boolean | null, string | null]>,
    varsayilan: string,
  ): Record<string, [boolean | null, string | null]> =>
    Object.fromEntries(
      cevap.kolonKararlari.map((k) => [
        k.kolon,
        farkli[k.kolon] ?? [true, varsayilan],
      ]),
    );
  const durumlar = (cevap: TeshisCevabi): [string, boolean][] =>
    cevap.tutanKurallar.map((k) => [k.yetenekId, k.degerlendirilemedi]);

  const bir = await telefonla('5550031');
  const dokuz = await telefonla('5550039');

  // a) Daraltılmış soranda telefona bakan iki kural değerlendirilemedi; cevap telefonun değerinden
  // bağımsızdır.
  expect(dokuz.dar).toEqual(bir.dar);
  expect(durumlar(bir.dar)).toEqual([
    [genis, false],
    [gizliIzin, true],
    [gizliYasak, true],
    [gorunenYasak, false],
  ]);
  // c) Görünen kolona bakan yasak değerlendirilir; ona bağlı olmayan kararlar kesindir.
  expect(kolonKararlari(bir.dar)).toEqual(
    kararlar(
      bir.dar,
      {
        telefon: [false, gorunenYasak],
        gorunenAd: [null, gizliYasak],
        kullaniciAdi: [null, gizliIzin],
        id: [null, gizliIzin],
      },
      genis,
    ),
  );
  expect(bir.dar.kayitKarari).toEqual({ acik: null, kararVeren: gizliIzin });
  // b) Kök yönetici aynı sorguda kesin karar verir.
  expect(durumlar(bir.kok)).toEqual([
    [genis, false],
    [gizliYasak, false],
    [gorunenYasak, false],
  ]);
  expect(kolonKararlari(bir.kok)).toEqual(
    kararlar(
      bir.kok,
      { telefon: [false, gorunenYasak], gorunenAd: [false, gizliYasak] },
      genis,
    ),
  );
  expect(bir.kok.kayitKarari).toEqual({ acik: true, kararVeren: genis });
  expect(durumlar(dokuz.kok)).toEqual([
    [genis, false],
    [gizliIzin, false],
    [gorunenYasak, false],
  ]);
  expect(kolonKararlari(dokuz.kok)).toEqual(
    kararlar(
      dokuz.kok,
      {
        telefon: [false, gorunenYasak],
        kullaniciAdi: [true, gizliIzin],
        id: [true, gizliIzin],
      },
      genis,
    ),
  );
  expect(dokuz.kok.kayitKarari).toEqual({ acik: true, kararVeren: gizliIzin });
});

it('l3) bileşim sınırı: 8 değerlendirilemeyen kuralda bileşimler hesaplanır; 9 kuralda hesaplanmaz, onların etkileyebileceği kararlar belirsizdir, öbürleri kesindir ve gizli kolonun değeri cevabı değiştirmez', async () => {
  const h4 = kimlik('c6', 4);
  await gozlemci.query(
    "insert into kullanici (id, gorunen_ad, telefon) values ($1, 'Hedef Dört', '5550041')",
    [h4],
  );
  const hedef = await kisiKur(17);
  const genis = await yetenekEkle({
    grup: hedef.grup,
    rol: MUDUR,
    oncelik: 100,
  });
  // Soran: teşhis izni olan, kullanıcılarda yalnız görünen adı gören ikinci yönetici.
  const soran = await kisiKur(18);
  await yetenekEkle({
    grup: soran.grup,
    rol: MUDUR,
    kaynak: 'Yetenek',
    eylem: 'teshis',
  });
  await yetenekEkle({ grup: soran.grup, rol: MUDUR, kaynak: 'Izin' });
  await yetenekEkle({ grup: soran.grup, rol: MUDUR, kolonlar: ['gorunenAd'] });
  const sorgu = kullaniciTeshisi(hedef, h4);
  const darTeshis = async (): Promise<TeshisCevabi> => {
    const cevap = await teshisIstegi(soran, sorgu);
    expect(cevap.status).toBe(200);
    return cevap.body as TeshisCevabi;
  };
  // Telefona bakan, yalnız kullanıcı adını veren, geniş izinden düşük öncelikli izinler: kullanıcı adının
  // ve kaydın kararını her bileşimde geniş izin verir.
  const gizliler: string[] = [];
  const gizliEkle = async (): Promise<void> => {
    gizliler.push(
      await yetenekEkle({
        grup: hedef.grup,
        rol: STAJYER,
        sart: [
          {
            alan: 'telefon',
            islec: 'esit',
            deger: `555009${String(gizliler.length)}`,
          },
        ],
        kolonlar: ['kullaniciAdi'],
      }),
    );
  };
  const beklenen = (
    cevap: TeshisCevabi,
    farkli: Record<string, [boolean | null, string | null]>,
  ): Record<string, [boolean | null, string | null]> =>
    Object.fromEntries(
      cevap.kolonKararlari.map((k) => [
        k.kolon,
        farkli[k.kolon] ?? [true, genis],
      ]),
    );
  const durumlar = (cevap: TeshisCevabi): [string, boolean][] =>
    cevap.tutanKurallar.map((k) => [k.yetenekId, k.degerlendirilemedi]);

  while (gizliler.length < 8) {
    await gizliEkle();
  }
  const sekiz = await darTeshis();
  expect(durumlar(sekiz)).toEqual([
    [genis, false],
    ...gizliler.map((g): [string, boolean] => [g, true]),
  ]);
  expect(kolonKararlari(sekiz)).toEqual(beklenen(sekiz, {}));
  expect(sekiz.kayitKarari).toEqual({ acik: true, kararVeren: genis });

  await gizliEkle();
  const dokuz = await darTeshis();
  await gozlemci.query('update kullanici set telefon = $2 where id = $1', [
    h4,
    '5550090',
  ]);
  expect(await darTeshis()).toEqual(dokuz);
  expect(durumlar(dokuz)).toEqual([
    [genis, false],
    ...gizliler.map((g): [string, boolean] => [g, true]),
  ]);
  expect(kolonKararlari(dokuz)).toEqual(
    beklenen(dokuz, {
      kullaniciAdi: [null, gizliler[0] ?? null],
      id: [null, gizliler[0] ?? null],
    }),
  );
  expect(dokuz.kayitKarari).toEqual({
    acik: null,
    kararVeren: gizliler[0],
  });
});

it('h) Senaryo 2: ret kaydı teşhis cevabında görünür; 21 ret varken en yeni 20 ret döner', async () => {
  const kisi = await kisiKur(8);
  const izin = await yetenekEkle({
    grup: kisi.grup,
    rol: MUDUR,
    kaynak: 'Oturum',
    eylem: 'kapat',
  });
  await yetenekEkle({ grup: kisi.grup, rol: MUDUR, kaynak: 'Oturum' });
  const yasak = await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    kaynak: 'Oturum',
    eylem: 'kapat',
    giremez: true,
    oncelik: 10,
    sart: BASKASININ_OTURUMU,
  });
  const baskasi = await kisiKur(9);
  const ret = await istek(kisi, (sunucu) =>
    sunucu.post(`/kimlik/oturum/${baskasi.oturum}/kapat`),
  );
  expect(ret.status).toBe(403);
  const sorgu: TeshisSorgusu = {
    kullaniciId: kisi.id,
    kaynak: 'Oturum',
    eylem: 'kapat',
    kayitId: baskasi.oturum,
  };

  const cevap = await teshis(sorgu);

  expect(cevap.tutanKurallar.map((k) => [k.yetenekId, k.etki])).toEqual([
    [izin, 'izin'],
    [yasak, 'yasak'],
  ]);
  expect(cevap.kayitKarari).toEqual({ acik: false, kararVeren: yasak });
  expect(cevap.retKayitlari).toEqual([
    {
      zaman: expect.any(String) as unknown,
      eylem: 'kapat',
      kaynak: 'Oturum',
      kayitId: baskasi.oturum,
      kararVerenYasakId: yasak,
    },
  ]);

  // Yirmi eski ret: n dakika önce.
  for (let n = 1; n <= 20; n += 1) {
    await izGozlemci.query(
      `insert into ret_kaydi (id, istek_id, kullanici_id, eylem, kaynak, kayit_id,
                              karar_veren_yasak_id, olusma_zamani)
       values ($1, $2, $3, 'kapat', 'Oturum', $4, $5,
               clock_timestamp() - make_interval(mins => $6))`,
      [kimlik('c7', n), kimlik('c8', n), kisi.id, kimlik('c9', n), yasak, n],
    );
  }
  const yirmiBir = await teshis(sorgu);

  expect(yirmiBir.retKayitlari.map((r) => r.kayitId)).toEqual([
    baskasi.oturum,
    ...Array.from({ length: 19 }, (_, i) => kimlik('c9', i + 1)),
  ]);
});

it('i) soranın okuyamadığı kayıt ve kişi için cevap bulunamadıdır (süzgeci daraltılmış ikinci yönetici)', async () => {
  const hedef = await kisiKur(10);
  await yetenekEkle({ grup: hedef.grup, rol: MUDUR });
  const ikinci = await kisiKur(11);
  await yetenekEkle({
    grup: ikinci.grup,
    rol: MUDUR,
    kaynak: 'Yetenek',
    eylem: 'teshis',
  });
  await yetenekEkle({ grup: ikinci.grup, rol: MUDUR, kaynak: 'Izin' });
  // Okuma süzgeci daraltılmış: Hedef Bir'i göremez.
  await yetenekEkle({
    grup: ikinci.grup,
    rol: MUDUR,
    sart: [{ alan: 'gorunenAd', islec: 'esit_degil', deger: 'Hedef Bir' }],
  });
  const bulunamadi = {
    kod: 'bulunamadi',
    ileti: 'Kayıt bulunamadı',
    ayrinti: null,
  };

  const gorulmeyen = await teshisIstegi(ikinci, kullaniciTeshisi(hedef, H1));
  const gorulen = await teshisIstegi(ikinci, kullaniciTeshisi(hedef, H2));
  const kisiYok = await teshisIstegi(ikinci, {
    ...kullaniciTeshisi(hedef, H2),
    kullaniciId: kimlik('c0', 999),
  });

  expect(gorulmeyen.status).toBe(404);
  expect(gorulmeyen.body).toEqual(bulunamadi);
  expect(gorulen.status).toBe(200);
  expect(kisiYok.status).toBe(404);
  expect(kisiYok.body).toEqual(bulunamadi);
  // Kök yönetici aynı kaydı görür.
  expect(
    (await teshisIstegi(kokYonetici, kullaniciTeshisi(hedef, H1))).status,
  ).toBe(200);
});

it('k) katalogda olmayan kaynak ya da eylem doğrulama hatasıdır', async () => {
  const kisi = await kisiKur(12);
  const gecersizler = [
    { ...kullaniciTeshisi(kisi), kaynak: 'Yok' },
    { ...kullaniciTeshisi(kisi), eylem: 'ucur' },
    { ...kullaniciTeshisi(kisi), kaynak: 'Izin', eylem: 'sil' },
  ];

  for (const sorgu of gecersizler) {
    const cevap = await teshisIstegi(kokYonetici, sorgu);
    expect(cevap.status).toBe(400);
    expect(cevap.body).toMatchObject({ kod: 'dogrulama_hatasi' });
  }
  const eksik = await istek(kokYonetici, (sunucu) =>
    sunucu.get('/kimlik/yetenek/teshis').query({ kullaniciId: kisi.id }),
  );
  expect(eksik.status).toBe(400);
  expect(eksik.body).toMatchObject({ kod: 'dogrulama_hatasi' });
});

// Ölçüm (beklenti konmaz): teşhis isteğinin veritabanlarına gönderdiği deyimler. node-postgres
// istemcisinin query metodu sarılır; yalnız bir isteğin bağlamında gönderilen deyimler sayılır (arka plan
// döngüleri sayılmaz). Deyimler veritabanına göre ayrılıp test notuna yazılır.
it('ölçüm: teşhisin attığı sorgu sayısı (hedefin yetkisi derlenirken ve bellekten gelirken)', async ({
  annotate,
}) => {
  const kisi = await kisiKur(13);
  await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
  await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
  });
  for (const deger of ['Hedef Bir', 'Hedef İki']) {
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      oncelik: 10,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger }],
      kolonlar: ['telefon'],
    });
  }
  const asil = Reflect.get(pg.Client.prototype, 'query') as (
    ...args: unknown[]
  ) => unknown;
  let deyimler: string[] = [];
  vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (
    this: pg.Client,
    ...args: unknown[]
  ) {
    const [deyim] = args;
    if (varsaIstekBaglami() !== undefined) {
      deyimler.push(
        `${this.database ?? ''}: ${typeof deyim === 'string' ? deyim : String((deyim as { text?: unknown }).text)}`,
      );
    }
    return asil.apply(this, args);
  });

  for (const olcum of ['derlenirken', 'bellekten']) {
    deyimler = [];
    const cevap = await teshis(kullaniciTeshisi(kisi));
    expect(cevap.tutanKurallar).toHaveLength(3);
    await annotate(
      `${olcum}: ${String(deyimler.length)} deyim: ${JSON.stringify(deyimler)}`,
    );
  }
});
