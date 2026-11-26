// Ret kaydı: iz veritabanında tablo, göç ve geri alınan işlemin dışında yazım (GV-155; TS-008 "Veri
// modeli", "Yapı" altında "Okuma" ve "Yazma", AK-5; kapanan AU-14, AU-23 ve AU-31). Koşturma:
//   pnpm -C backend test:e2e test/ret-kaydi.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; başlangıcı tohum
// koşucusu kurar. Yasak satırları asıl veritabanına doğrudan yazılır; yasak yazımını kapatan geçici kısıt
// test yardımcısıyla düşürülür. İstekler uçtan (HTTP) gönderilir; iz veritabanı ayrı bir bağlantıdan (iz
// gözlemcisi) okunur. Her test kendi kişisiyle çalışır, çünkü yetki belleği süreç boyunca yaşar.
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
import { ISTEK_KIMLIGI_BASLIGI } from '../src/shared/observability/istek-baglami/istek-baglami.js';
import { TohumKosucusu } from '../src/shared/tohum/infrastructure/tohum-kosucusu.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const IZ_GOCLERI = `${BACKEND}prisma/iz/migrations`;
// Var olan iz göçlerinin bu görevden önceki özetleri (sha256); dosyalar değişirse test kırılır.
const ESKI_GOC_OZETLERI = {
  '20261124165338_degisiklik_kaydi':
    '68da0f26d9d6a3465627a00b89bc7b83c89df4c4861f42fec08d3b85be402683',
  '20261125120000_erisim_kaydi':
    '0797d7bbde3e4694e9c3f29d4330ade75b5449f591185c42c33e65c9c3db634a',
};
const YENI_GOC = '20261126120000_ret_kaydi';

const IP = '203.0.113.36';
const TARAYICI = 'Mozilla/5.0 ret kaydi deneme';

// Kimlikler: kişiler 80…, gruplar 81…, roller 82…, üyelikler 83…, yetenekler 84…, oturumlar 85….
const MUDUR = '82000000-0000-4000-8000-000000000001';
const STAJYER = '82000000-0000-4000-8000-000000000002';

const RET_GOVDESI = {
  kod: 'yetki_yok',
  ileti: 'Bu işlem için yetki yok',
  ayrinti: null,
};

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

async function oturumAc(kisi: string, no: number): Promise<string> {
  const oturum = kimlik('85', no);
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(), $3, $4)`,
    [oturum, kisi, IP, TARAYICI],
  );
  return oturum;
}

interface Kisi {
  readonly id: string;
  readonly grup: string;
  readonly oturum: string;
}

// Kişi: kendi grubu (kökün altında), oturumu ve grubunda Müdür ile Stajyer üyelikleri.
async function kisiKur(no: number): Promise<Kisi> {
  const id = kimlik('80', no);
  const grup = kimlik('81', no);
  await gozlemci.query(
    'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
    [grup, kokGrup, `Grup ${String(no)}`],
  );
  await gozlemci.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
    [id, `retkisi${String(no)}`],
  );
  for (const [sira, rol] of [MUDUR, STAJYER].entries()) {
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [kimlik('83', no * 10 + sira), id, grup, rol],
    );
  }
  return { id, grup, oturum: await oturumAc(id, no) };
}

interface YetenekSecenekleri {
  readonly kaynak: string;
  readonly eylem: string;
  readonly oncelik?: number;
  // Saklanan şart olduğu gibi yazılır; verilmezse bütün kayıtlar.
  readonly sart?: unknown;
}

// Bütün kolonlu yetenek: Müdür'e izin, Stajyer'e yasak.
async function yetenekEkle(
  kisi: Kisi,
  giremez: boolean,
  { kaynak, eylem, oncelik = 0, sart }: YetenekSecenekleri,
): Promise<string> {
  yetenekNo += 1;
  const id = kimlik('84', yetenekNo);
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, giremez, oncelik, koken)
     values ($1, $2, $3, (select id from izin where kaynak = $4 and eylem = $5), $6::jsonb,
             $6::jsonb is null, null, true, $7, $8, 'yonetici')`,
    [
      id,
      kisi.grup,
      giremez ? STAJYER : MUDUR,
      kaynak,
      eylem,
      sart === undefined ? null : JSON.stringify(sart),
      giremez,
      oncelik,
    ],
  );
  return id;
}

async function izinVer(
  kisi: Kisi,
  kaynak: string,
  eylemler: readonly string[],
): Promise<void> {
  for (const eylem of eylemler) {
    await yetenekEkle(kisi, false, { kaynak, eylem });
  }
}

function yasakla(kisi: Kisi, secenekler: YetenekSecenekleri): Promise<string> {
  return yetenekEkle(kisi, true, secenekler);
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

function kapat(kisi: Kisi, oturum: string): Promise<request.Response> {
  return istek(kisi, (sunucu) => sunucu.post(`/kimlik/oturum/${oturum}/kapat`));
}

function istekKimligi(cevap: request.Response): string {
  const kimligi: unknown = cevap.headers[ISTEK_KIMLIGI_BASLIGI];
  if (typeof kimligi !== 'string') {
    throw new Error('istek kimliği başlığı yok');
  }
  return kimligi;
}

interface RetSatiri {
  id: string;
  istek_id: string;
  kullanici_id: string;
  eylem: string;
  kaynak: string;
  kayit_id: string | null;
  karar_veren_yasak_id: string;
}

// Kişinin ret kayıtları, yazılma sırasıyla.
async function retKayitlari(kisi: Kisi): Promise<RetSatiri[]> {
  return (
    await izGozlemci.query<RetSatiri>(
      `select id, istek_id, kullanici_id, eylem, kaynak, kayit_id, karar_veren_yasak_id
         from ret_kaydi where kullanici_id = $1 order by yazilma_zamani, id`,
      [kisi.id],
    )
  ).rows;
}

async function oturumSatiri(id: string): Promise<unknown> {
  return (await gozlemci.query('select * from oturum where id = $1', [id]))
    .rows[0];
}

// Kaydın değişiklik kaydı notlarının sayısı.
async function notSayisi(kayitId: string): Promise<number> {
  return (
    await tekSatir<{ sayi: number }>(
      gozlemci,
      "select count(*)::int as sayi from outbox_iz where govde->>'kayit_id' = $1",
      [kayitId],
    )
  ).sayi;
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
    await gozlemci.query(
      "insert into rol (id, ad) values ($1, 'Müdür'), ($2, 'Stajyer')",
      [MUDUR, STAJYER],
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

describe('g) göç', () => {
  it('ret_kaydi tablosu kolonlarıyla hedefteki gibidir', async () => {
    const { rows } = await izGozlemci.query<{
      kolon: string;
      tur: string;
      bos: string;
      varsayilan: string | null;
    }>(
      `select column_name as kolon, data_type as tur, is_nullable as bos, column_default as varsayilan
         from information_schema.columns
        where table_schema = 'public' and table_name = 'ret_kaydi'
        order by ordinal_position`,
    );
    const tz = 'timestamp with time zone';
    expect(rows.map((s) => [s.kolon, s.tur, s.bos, s.varsayilan])).toEqual([
      ['id', 'uuid', 'NO', null],
      ['istek_id', 'uuid', 'NO', null],
      ['kullanici_id', 'uuid', 'NO', null],
      ['eylem', 'text', 'NO', null],
      ['kaynak', 'text', 'NO', null],
      ['kayit_id', 'uuid', 'YES', null],
      ['karar_veren_yasak_id', 'uuid', 'NO', null],
      ['olusma_zamani', tz, 'NO', null],
      ['yazilma_zamani', tz, 'NO', 'clock_timestamp()'],
    ]);
  });

  it('tek kısıt birincil anahtardır; yabancı anahtar yoktur', async () => {
    const { rows } = await izGozlemci.query<{ ad: string; tanim: string }>(
      `select conname as ad, pg_get_constraintdef(oid) as tanim
         from pg_constraint
        where conrelid = 'ret_kaydi'::regclass and contype <> 'n'
        order by conname`,
    );
    expect(rows.map((s) => [s.ad, s.tanim])).toEqual([
      ['ret_kaydi_ba', 'PRIMARY KEY (id)'],
    ]);
  });

  it('iz veritabanının tabloları ve uygulanan göçleri yeni tabloyla genişler; var olan iz göçleri değişmemiştir', async () => {
    const tablolar = await izGozlemci.query<{ ad: string }>(
      "select table_name as ad from information_schema.tables where table_schema = 'public' order by 1",
    );
    expect(tablolar.rows.map((s) => s.ad)).toEqual([
      '_prisma_migrations',
      'degisiklik_kaydi',
      'erisim_kaydi',
      'erisim_kaydi_uyelik',
      'erisim_kaydi_yetenek',
      'ret_kaydi',
    ]);
    const klasorler = (await readdir(IZ_GOCLERI, { withFileTypes: true }))
      .filter((g) => g.isDirectory())
      .map((g) => g.name)
      .sort();
    expect(klasorler).toEqual([...Object.keys(ESKI_GOC_OZETLERI), YENI_GOC]);
    const uygulanan = await izGozlemci.query<{ ad: string }>(
      'select migration_name as ad from _prisma_migrations where finished_at is not null order by 1',
    );
    expect(uygulanan.rows.map((s) => s.ad)).toEqual(klasorler);
    const ozetler: Record<string, string> = {};
    for (const goc of Object.keys(ESKI_GOC_OZETLERI)) {
      ozetler[goc] = createHash('sha256')
        .update(await readFile(`${IZ_GOCLERI}/${goc}/migration.sql`))
        .digest('hex');
    }
    expect(ozetler).toEqual(ESKI_GOC_OZETLERI);
  });
});

it('a) Senaryo 2: başkasının oturumunu kapatma yetki yok alır ve ret kaydına tek satır düşer; asıl veritabanında satır değişmez, değişiklik kaydı yazılmaz', async () => {
  const kisi = await kisiKur(1);
  await izinVer(kisi, 'Oturum', ['kapat', 'oku']);
  const yasak = await yasakla(kisi, {
    kaynak: 'Oturum',
    eylem: 'kapat',
    oncelik: 10,
    sart: BASKASININ_OTURUMU,
  });
  const baskasi = await kisiKur(2);
  const onceki = await oturumSatiri(baskasi.oturum);

  const ret = await kapat(kisi, baskasi.oturum);

  expect(ret.status).toBe(403);
  expect(ret.body).toEqual(RET_GOVDESI);
  const satirlar = await retKayitlari(kisi);
  expect(satirlar).toEqual([
    {
      id: expect.any(String) as unknown,
      istek_id: istekKimligi(ret),
      kullanici_id: kisi.id,
      eylem: 'kapat',
      kaynak: 'Oturum',
      kayit_id: baskasi.oturum,
      karar_veren_yasak_id: yasak,
    },
  ]);
  // Cevaba ne karar veren yasak ne ret kaydının kimliği sızar.
  expect(ret.text).not.toContain(yasak);
  expect(ret.text).not.toContain(satirlar[0]?.id);
  expect(await oturumSatiri(baskasi.oturum)).toEqual(onceki);
  expect(await notSayisi(baskasi.oturum)).toBe(0);
});

it('b) kişi kendi oturumunu kapatınca ret kaydı yazılmaz', async () => {
  const kisi = await kisiKur(3);
  await izinVer(kisi, 'Oturum', ['kapat', 'oku']);
  await yasakla(kisi, {
    kaynak: 'Oturum',
    eylem: 'kapat',
    oncelik: 10,
    sart: BASKASININ_OTURUMU,
  });
  const kendi = await oturumAc(kisi.id, 31);

  expect((await kapat(kisi, kendi)).status).toBe(204);
  expect(
    await tekSatir<{ kapali: boolean }>(
      gozlemci,
      'select kapatilma_zamani is not null as kapali from oturum where id = $1',
      [kendi],
    ),
  ).toEqual({ kapali: true });
  expect(await retKayitlari(kisi)).toEqual([]);
});

it('c) hiç izni olmayan kişinin yetki yokunda ret kaydı yazılmaz', async () => {
  const kisi = await kisiKur(4);
  await izinVer(kisi, 'Oturum', ['oku']);
  const baskasi = await kisiKur(5);

  const ret = await kapat(kisi, baskasi.oturum);

  expect(ret.status).toBe(403);
  expect(ret.body).toEqual(RET_GOVDESI);
  expect(await retKayitlari(kisi)).toEqual([]);
});

it('d) yasaklı okumada (süzülen liste) ret kaydı yazılmaz', async () => {
  const kisi = await kisiKur(6);
  await izinVer(kisi, 'Oturum', ['oku']);
  await yasakla(kisi, {
    kaynak: 'Oturum',
    eylem: 'oku',
    oncelik: 10,
    sart: BASKASININ_OTURUMU,
  });
  const baskasi = await kisiKur(7);

  const liste = await istek(kisi, (sunucu) =>
    sunucu.get(`/kimlik/oturum?kullaniciId=${baskasi.id}`),
  );
  const tek = await istek(kisi, (sunucu) =>
    sunucu.get(`/kimlik/oturum/${baskasi.oturum}`),
  );

  expect(liste.status).toBe(200);
  expect(liste.text).not.toContain(baskasi.oturum);
  expect(tek.status).toBe(404);
  expect(await retKayitlari(kisi)).toEqual([]);
});

it('e) aynı ret üç kez yinelenince üç satır vardır', async () => {
  const kisi = await kisiKur(8);
  await izinVer(kisi, 'Oturum', ['kapat', 'oku']);
  const yasak = await yasakla(kisi, {
    kaynak: 'Oturum',
    eylem: 'kapat',
    oncelik: 10,
    sart: BASKASININ_OTURUMU,
  });
  const baskasi = await kisiKur(9);

  const istekler: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const ret = await kapat(kisi, baskasi.oturum);
    expect(ret.status).toBe(403);
    istekler.push(istekKimligi(ret));
  }

  const satirlar = await retKayitlari(kisi);
  expect(satirlar.map((s) => s.istek_id)).toEqual(istekler);
  expect(new Set(satirlar.map((s) => s.id)).size).toBe(3);
  for (const satir of satirlar) {
    expect(satir).toMatchObject({
      eylem: 'kapat',
      kaynak: 'Oturum',
      kayit_id: baskasi.oturum,
      karar_veren_yasak_id: yasak,
    });
  }
});

it('f) ret kaydı yazılamazsa (ret_kaydi tablosunun adı değiştirilmişken) cevap yine yetki yoktur ve günlüğe hata düşer', async () => {
  const kisi = await kisiKur(10);
  await izinVer(kisi, 'Oturum', ['kapat', 'oku']);
  await yasakla(kisi, {
    kaynak: 'Oturum',
    eylem: 'kapat',
    oncelik: 10,
    sart: BASKASININ_OTURUMU,
  });
  const baskasi = await kisiKur(11);
  const onceki = await oturumSatiri(baskasi.oturum);
  const hatalar = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);

  await izGozlemci.query('alter table ret_kaydi rename to ret_kaydi_kapali');
  let ret: request.Response;
  try {
    ret = await kapat(kisi, baskasi.oturum);
  } finally {
    await izGozlemci.query('alter table ret_kaydi_kapali rename to ret_kaydi');
  }

  expect(ret.status).toBe(403);
  expect(ret.body).toEqual(RET_GOVDESI);
  expect(
    hatalar.mock.calls.filter(([ileti]) =>
      String(ileti).startsWith(
        `istek ${istekKimligi(ret)}: ret kaydı yazılamadı:`,
      ),
    ),
  ).toHaveLength(1);
  expect(await retKayitlari(kisi)).toEqual([]);
  expect(await oturumSatiri(baskasi.oturum)).toEqual(onceki);
});

it('oluşturmada ret kaydının kaydı boştur; yazılan satır işle birlikte geri alınır', async () => {
  const kisi = await kisiKur(12);
  await izinVer(kisi, 'Kullanici', ['olustur']);
  const yasak = await yasakla(kisi, {
    kaynak: 'Kullanici',
    eylem: 'olustur',
    oncelik: 10,
    sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Yasaklı Ad' }],
  });

  const ret = await istek(kisi, (sunucu) =>
    sunucu
      .post('/kimlik/kullanici')
      .send({ kullaniciAdi: 'retyeni', gorunenAd: 'Yasaklı Ad' }),
  );

  expect(ret.status).toBe(403);
  expect(ret.body).toEqual(RET_GOVDESI);
  expect(await retKayitlari(kisi)).toEqual([
    {
      id: expect.any(String) as unknown,
      istek_id: istekKimligi(ret),
      kullanici_id: kisi.id,
      eylem: 'olustur',
      kaynak: 'Kullanici',
      kayit_id: null,
      karar_veren_yasak_id: yasak,
    },
  ]);
  expect(
    (
      await gozlemci.query(
        "select 1 from kullanici where kullanici_adi = 'retyeni'",
      )
    ).rows,
  ).toEqual([]);
});
