// Ekranın okuma tarafı, arka yüz (GV-151; TS-008 "Yapı" altında "Ekran", Değişmez 1 ve 4, "Aşamalar" 3;
// KU-017, KU-018). Koşturma:
//   pnpm -C backend test:e2e test/yetki-yasak-ekran.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; başlangıcı tohum
// koşucusu kurar. Yasak satırları veritabanına doğrudan yazılır; yasak yazımını kapatan geçici kısıt
// test yardımcısıyla düşürülür. "yetkilerim" ve Senaryo 1 uçtan (HTTP) sınanır; eşlik verisinin
// (test/veri/yetki-eslik.json) kayıt ve kolon kararları kişinin uygulamadaki derlenmiş yetkisiyle okuma
// motorundan okunur. Her test kendi kişisiyle çalışır, çünkü yetki belleği süreç boyunca yaşar.
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { KIMLIK_KURULUM_GOCU } from '../src/features/kimlik/_shared/infrastructure/tohum/kimlik-kurulum.goc.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { BelirtecServisi } from '../src/shared/guvenlik/application/belirtec.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/application/istemci-adresi-imzasi.js';
import {
  YETKI_VERISI,
  type YetkiVerisi,
} from '../src/shared/kimlik/domain/i-yetki-verisi.contract.js';
import {
  istekBaglamiAraKatmani,
  istekYetkisiniYaz,
} from '../src/shared/observability/istek-baglami/istek-baglami.js';
import { TohumKosucusu } from '../src/shared/tohum/infrastructure/tohum-kosucusu.js';
import type {
  DerlemeSonucu,
  YetenekKurali,
} from '../src/shared/yetki/application/yetenek-derleyici.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../src/shared/yetki/domain/kaynak-katalogu.js';
import type { Kayit } from '../src/shared/yetki/domain/okuma-tipleri.js';
import { YetkiBellegi } from '../src/shared/yetki/infrastructure/yetki-bellegi.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';
import { EskiOkumaKapisi } from './yardimci/eski-yuz.js';
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const IP = '203.0.113.33';
const TARAYICI = 'Mozilla/5.0 yasak ekran deneme';
const YETKILERIM = '/kimlik/oturum/yetkilerim';

// Kimlikler: kişiler 90…, gruplar 91…, roller 92…, üyelikler 93…, oturumlar 95…, bu dosyanın yetenekleri
// 97…; eşlik verisinin kayıtları 98…, yetenekleri 99….
const MUDUR = '92000000-0000-4000-8000-000000000001';
const STAJYER = '92000000-0000-4000-8000-000000000002';

// Eşlik verisi (TS-008 "Doğrulama"): biçimi dosyanın "aciklama" alanındadır.
interface EslikYetenegi {
  readonly id: string;
  readonly giremez?: boolean;
  readonly oncelik?: number;
  readonly sart?: unknown;
  readonly kolonlar?: readonly string[];
  readonly muaf?: boolean;
}

interface EslikDurumu {
  readonly ad: string;
  readonly yetenekler: readonly EslikYetenegi[];
  readonly kurallar: readonly YetenekKurali[];
  readonly beklenen: Readonly<
    Record<string, Readonly<Record<string, boolean>>>
  >;
}

interface EslikVerisi {
  readonly kaynak: string;
  readonly eylem: string;
  readonly kolonlar: readonly string[];
  readonly kayitlar: readonly Readonly<Record<string, unknown>>[];
  readonly durumlar: readonly EslikDurumu[];
}

const ESLIK = JSON.parse(
  readFileSync(new URL('./veri/yetki-eslik.json', import.meta.url), 'utf8'),
) as EslikVerisi;

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;
let prisma: PrismaClient;
let kapi: EskiOkumaKapisi;
let kokGrup: string;
let kokYoneticiRol: string;

function uygulama(): INestApplication<App> {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app;
}

async function tekSatir<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T> {
  const [satir] = (await gozlemci.query<T>(sql, degerler)).rows;
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

// Kişi: kendi grubu (kökün altında), oturumu ve grubunda Müdür ile Stajyer üyelikleri.
async function kisiKur(no: number): Promise<Kisi> {
  const id = kimlik('90', no);
  const grup = kimlik('91', no);
  const oturum = kimlik('95', no);
  await gozlemci.query(
    'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
    [grup, kokGrup, `Grup ${String(no)}`],
  );
  await gozlemci.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
    [id, `ekran${String(no)}`],
  );
  for (const [sira, rol] of [MUDUR, STAJYER].entries()) {
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [kimlik('93', no * 10 + sira), id, grup, rol],
    );
  }
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(), $3, $4)`,
    [oturum, id, IP, TARAYICI],
  );
  return { id, grup, oturum };
}

// Kişiye (kök grup, kök yönetici) üyeliği.
async function kokYoneticiUyeligi(kisi: Kisi, no: number): Promise<void> {
  await gozlemci.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
    [kimlik('93', no), kisi.id, kokGrup, kokYoneticiRol],
  );
}

interface YetenekSatiri {
  readonly id: string;
  readonly grup: string;
  readonly rol: string;
  readonly giremez?: boolean;
  readonly oncelik?: number;
  // Saklanan şart olduğu gibi yazılır; verilmezse bütün kayıtlar.
  readonly sart?: unknown;
  // Verilmezse bütün kolonlar.
  readonly kolonlar?: readonly string[];
  readonly sistemSatiri?: boolean;
}

// Kullanici:oku yeteneği.
async function yetenekEkle({
  id,
  grup,
  rol,
  giremez = false,
  oncelik = 0,
  sart,
  kolonlar,
  sistemSatiri = false,
}: YetenekSatiri): Promise<void> {
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, giremez, oncelik, sistem_satiri, koken)
     values ($1, $2, $3, (select id from izin where kaynak = 'Kullanici' and eylem = 'oku'),
             $4::jsonb, $4::jsonb is null, $5, $5::text[] is null, $6, $7, $8,
             case when $8 then 'goc' else 'yonetici' end)`,
    [
      id,
      grup,
      rol,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
      giremez,
      oncelik,
      sistemSatiri,
    ],
  );
}

async function getir(kisi: Kisi, yol: string): Promise<request.Response> {
  const zaman = Date.now();
  const belirtec = await new BelirtecServisi(process.env).erisimBelirteciUret({
    kullaniciId: kisi.id,
    oturumId: kisi.oturum,
  });
  return request(uygulama().getHttpServer())
    .get(yol)
    .set({
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

async function yetkilerim(kisi: Kisi): Promise<YetenekKurali[]> {
  const cevap = await getir(kisi, YETKILERIM);
  expect(cevap.status).toBe(200);
  return (cevap.body as { kurallar: YetenekKurali[] }).kurallar;
}

// Kişinin, guard'ın kullandığı yetki belleğindeki derlenmiş yetkisi.
async function derlenmisYetki(kisi: string): Promise<DerlemeSonucu> {
  const surumler = await uygulama()
    .get<YetkiVerisi>(YETKI_VERISI)
    .surumler(kisi);
  return uygulama().get(YetkiBellegi).al(kisi, surumler);
}

// Eşlik verisinin kayıtlarının kişinin gözünden okuma motoruyla okunuşu.
async function eslikKayitlari(kisi: string): Promise<Kayit[]> {
  const yetki = await derlenmisYetki(kisi);
  return new Promise<Kayit[]>((coz, reddet) => {
    // Ara katman istekten bir şey okumaz, cevaba yalnız başlık yazar.
    const cevap = { setHeader: () => undefined };
    istekBaglamiAraKatmani(
      {} as unknown as IncomingMessage,
      cevap as unknown as ServerResponse,
      () => {
        istekYetkisiniYaz(yetki);
        kapi
          .liste(prisma, ESLIK.kaynak, {
            kosul: [
              {
                alan: 'id',
                islec: 'listede',
                deger: ESLIK.kayitlar.map((k) => String(k['id'])),
              },
            ],
          })
          .then(coz, reddet);
      },
    );
  });
}

// Uç listesinin kayıtları; liste bütün kullanıcıları tek sayfada verir.
async function listele(kisi: Kisi, yol: string): Promise<Kayit[]> {
  const cevap = await getir(kisi, `${yol}?boyut=100`);
  expect(cevap.status).toBe(200);
  return (cevap.body as { kayitlar: Kayit[] }).kayitlar;
}

beforeAll(async () => {
  databases = await createAppDatabases({ migrations: true });
  gozlemci = new pg.Client({ connectionString: databases.asil.url });
  try {
    await gozlemci.connect();
    const modul = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    gozlemciPid = (
      await tekSatir<{ pid: number }>('select pg_backend_pid() as pid')
    ).pid;
    expect(await uygulama().get(TohumKosucusu).kos()).toContain(
      KIMLIK_KURULUM_GOCU,
    );
    await yasakKisitiniDusur(databases.asil);
    kokGrup = (
      await tekSatir<{ id: string }>(
        'select id from grup where ust_grup_id is null',
      )
    ).id;
    kokYoneticiRol = (
      await tekSatir<{ id: string }>(
        "select id from rol where kod = 'superadmin'",
      )
    ).id;
    await gozlemci.query(
      "insert into rol (id, ad) values ($1, 'Müdür'), ($2, 'Stajyer')",
      [MUDUR, STAJYER],
    );
    for (const kayit of ESLIK.kayitlar) {
      await gozlemci.query(
        `insert into kullanici (id, kullanici_adi, gorunen_ad, telefon, yetki_surumu, pasif_zamani)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          kayit['id'],
          kayit['kullaniciAdi'],
          kayit['gorunenAd'],
          kayit['telefon'],
          kayit['yetkiSurumu'],
          kayit['pasifZamani'],
        ],
      );
    }
    kapi = new EskiOkumaKapisi(uygulama().get<KaynakKatalogu>(KAYNAK_KATALOGU));
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databases.asil.url }),
    });
  } catch (error) {
    await app?.close();
    await gozlemci.end();
    await databases.drop();
    throw error;
  }
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
  await app?.close();
  const acikKalan = await kalanBaglantiSayisi(gozlemci, databases.asil.name, [
    gozlemciPid,
  ]);
  await gozlemci.end();
  await databases.drop();
  expect(acikKalan).toBe(0);
});

describe('a) yetkilerim cevabı', () => {
  it('yasağı olmayan kişide cevap derlenmiş izin kurallarıdır: sıra değişmez, alan eklenmez', async () => {
    const kisi = await kisiKur(1);
    await yetenekEkle({
      id: kimlik('97', 101),
      grup: kisi.grup,
      rol: MUDUR,
      kolonlar: ['gorunenAd'],
    });
    await yetenekEkle({
      id: kimlik('97', 102),
      grup: kisi.grup,
      rol: STAJYER,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'X' }],
    });

    expect(await yetkilerim(kisi)).toEqual(
      (await derlenmisYetki(kisi.id)).kurallar,
    );
    expect(await yetkilerim(kisi)).toEqual([
      {
        yetenekId: kimlik('97', 101),
        action: 'oku',
        subject: 'Kullanici',
        fields: ['gorunenAd'],
      },
      {
        yetenekId: kimlik('97', 102),
        action: 'oku',
        subject: 'Kullanici',
        conditions: { AND: [{ gorunenAd: { equals: 'X' } }] },
      },
    ]);
  });

  it('yasağı olan kişide: artan öncelik, eşitlikte izin önce, muaf izinler en sonda; yasak ters kuraldır; iç alan sızmaz; bozuk yasak koşulsuz ve bütün kolonlu gider', async () => {
    const kisi = await kisiKur(2);
    // Muaf izinler: kök yöneticinin sistem satırları (tohum).
    await kokYoneticiUyeligi(kisi, 29);
    const y = (no: number) => kimlik('97', 200 + no);
    // Derlenme sırası (kimlik sırası) beklenen sıradan farklıdır.
    await yetenekEkle({
      id: y(1),
      grup: kisi.grup,
      rol: MUDUR,
      oncelik: 20,
      kolonlar: ['gorunenAd'],
    });
    await yetenekEkle({
      id: y(2),
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      oncelik: 10,
      kolonlar: ['telefon'],
    });
    await yetenekEkle({
      id: y(3),
      grup: kisi.grup,
      rol: MUDUR,
      oncelik: 10,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'X' }],
    });
    await yetenekEkle({
      id: y(4),
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Y' }],
    });
    await yetenekEkle({ id: y(5), grup: kisi.grup, rol: MUDUR });
    // Bozuk yasak: ikinci kolonun adı şemada yoktur; derlenince öncelik 100 olur.
    await yetenekEkle({
      id: y(6),
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      kolonlar: ['gorunenAd', 'eskiKolon'],
    });
    await yetenekEkle({ id: y(7), grup: kisi.grup, rol: MUDUR, oncelik: 100 });
    const muaflar = (
      await gozlemci.query<{ id: string }>(
        `select id from yetenek
          where grup_id = $1 and rol_id = $2 and sistem_satiri and silinme_zamani is null
          order by id`,
        [kokGrup, kokYoneticiRol],
      )
    ).rows.map((satir) => satir.id);
    expect(muaflar.length).toBeGreaterThan(0);

    const kurallar = await yetkilerim(kisi);

    const temel = { action: 'oku', subject: 'Kullanici' } as const;
    expect(kurallar.slice(0, 7)).toEqual([
      { yetenekId: y(5), ...temel },
      {
        yetenekId: y(4),
        ...temel,
        conditions: { AND: [{ gorunenAd: { equals: 'Y' } }] },
        inverted: true,
      },
      {
        yetenekId: y(3),
        ...temel,
        conditions: { AND: [{ gorunenAd: { equals: 'X' } }] },
      },
      { yetenekId: y(2), ...temel, fields: ['telefon'], inverted: true },
      { yetenekId: y(1), ...temel, fields: ['gorunenAd'] },
      { yetenekId: y(7), ...temel },
      { yetenekId: y(6), ...temel, inverted: true },
    ]);
    // Muaf izinler en sonda, derlendikleri sırayla; hiçbiri ters kural değildir.
    expect(kurallar.slice(7).map((k) => k.yetenekId)).toEqual(muaflar);
    expect(kurallar.slice(7).filter((k) => k.inverted !== undefined)).toEqual(
      [],
    );
    // Cevabın alan adları dökümü: öncelik, etki, muafiyet ve "kesin tutmuyor" koşulu cevaba girmez.
    expect(
      [...new Set(kurallar.flatMap((k) => Object.keys(k)))].sort(),
    ).toEqual([
      'action',
      'conditions',
      'fields',
      'inverted',
      'subject',
      'yetenekId',
    ]);
  });
});

it('b) Senaryo 1 uçtan uca: şartsız kolon yasağında telefon listede ve kayıt sayfasında 0 kayıtta gelir; yetkilerim o kolon için şartsız ters kural verir', async () => {
  const kisi = await kisiKur(3);
  const izin = kimlik('97', 301);
  const yasak = kimlik('97', 302);
  await yetenekEkle({ id: izin, grup: kisi.grup, rol: MUDUR });
  await yetenekEkle({
    id: yasak,
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    oncelik: 10,
    kolonlar: ['telefon'],
  });
  const telefonlu = ESLIK.kayitlar.filter((k) => k['telefon'] !== null);
  expect(telefonlu.length).toBeGreaterThan(0);

  const liste = await listele(kisi, '/kimlik/kullanici');
  expect(liste.map((k) => k['id'])).toEqual(
    expect.arrayContaining([kisi.id, ...telefonlu.map((k) => k['id'])]),
  );
  expect(liste.filter((k) => 'telefon' in k)).toEqual([]);
  for (const kayit of telefonlu) {
    const sayfa = await getir(kisi, `/kimlik/kullanici/${String(kayit['id'])}`);
    expect(sayfa.status).toBe(200);
    expect(sayfa.body).toMatchObject({ gorunenAd: kayit['gorunenAd'] });
    expect(sayfa.body).not.toHaveProperty('telefon');
  }

  expect(await yetkilerim(kisi)).toEqual([
    { yetenekId: izin, action: 'oku', subject: 'Kullanici' },
    {
      yetenekId: yasak,
      action: 'oku',
      subject: 'Kullanici',
      fields: ['telefon'],
      inverted: true,
    },
  ]);
});

describe('c) eşlik verisi (test/veri/yetki-eslik.json): sunucu her durumda dosyadaki kuralları ve kararları verir', () => {
  it('veri 14 durum ve 210 kayıt-kolon kararı taşır', () => {
    expect(ESLIK.durumlar).toHaveLength(14);
    expect(
      ESLIK.durumlar.flatMap((d) =>
        Object.values(d.beklenen).flatMap((k) => Object.keys(k)),
      ),
    ).toHaveLength(210);
  });

  it.each(
    ESLIK.durumlar.map((durum, sira) => [durum.ad, durum, sira] as const),
  )('%s', async (_ad, durum, sira) => {
    const no = 100 + sira;
    const kisi = await kisiKur(no);
    if (durum.yetenekler.some((y) => y.muaf === true)) {
      // Muaf izin kök yöneticinin sistem satırıdır; cevapta yalnız dosyanın kuralları olsun diye
      // tohumun kök yönetici satırları bu veritabanında silinir.
      await gozlemci.query(
        `update yetenek set silinme_zamani = clock_timestamp()
            where grup_id = $1 and rol_id = $2 and silinme_zamani is null`,
        [kokGrup, kokYoneticiRol],
      );
      await kokYoneticiUyeligi(kisi, no * 10 + 9);
    }
    for (const { muaf, ...yetenek } of durum.yetenekler) {
      await yetenekEkle(
        muaf === true
          ? {
              ...yetenek,
              grup: kokGrup,
              rol: kokYoneticiRol,
              sistemSatiri: true,
            }
          : { ...yetenek, grup: kisi.grup, rol: MUDUR },
      );
    }

    expect(await yetkilerim(kisi)).toEqual(durum.kurallar);

    const okunan = new Map(
      (await eslikKayitlari(kisi.id)).map((k) => [String(k['id']), k]),
    );
    const kararlar = Object.fromEntries(
      ESLIK.kayitlar.map((kayit) => [
        String(kayit['id']),
        Object.fromEntries(
          ESLIK.kolonlar.map((kolon) => [
            kolon,
            kolon in (okunan.get(String(kayit['id'])) ?? {}),
          ]),
        ),
      ]),
    );
    expect(kararlar).toEqual(durum.beklenen);
  });
});
