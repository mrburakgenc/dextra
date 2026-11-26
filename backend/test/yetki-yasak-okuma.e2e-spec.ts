// Okuma motoru: yasaklı satır koşulu, kolonların çıkarılması ve okumaya katılma (GV-150; TS-008 "Yapı"
// altında "Tanım", "Muafiyetler" ve "Okuma", "Kapasite"deki sorgu sayısı; KU-017, KU-018). Koşturma:
//   pnpm -C backend test:e2e test/yetki-yasak-okuma.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; başlangıcı tohum
// koşucusu kurar. Yasak satırları veritabanına doğrudan yazılır; yasak yazımını kapatan geçici kısıt
// test yardımcısıyla düşürülür. Senaryolar uçtan (HTTP) sınanır; satır koşulu, sorgu sayısı ve sorgu
// dökümü için kişinin uygulamadaki derlenmiş yetkisiyle, sorgu olaylarını sayan ayrı bir Prisma
// istemcisi üzerinden okunur. Her test kendi kişisiyle çalışır, çünkü yetki belleği süreç boyunca
// yaşar.
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
import type { DerlemeSonucu } from '../src/shared/yetki/application/yetenek-derleyici.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../src/shared/yetki/domain/kaynak-katalogu.js';
import type { Kayit } from '../src/shared/yetki/domain/okuma-tipleri.js';
import { OkumaKapisi } from '../src/shared/yetki/infrastructure/okuma-kapisi.js';
import { YetkiBellegi } from '../src/shared/yetki/infrastructure/yetki-bellegi.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';
import { EskiOkumaKapisi, type ListeIstegi } from './yardimci/eski-yuz.js';
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const IP = '203.0.113.32';
const TARAYICI = 'Mozilla/5.0 yasak okuma deneme';

// Kimlikler: kişiler 90…, gruplar 91…, roller 92…, üyelikler 93…, yetenekler 94…, oturumlar 95…, okunan
// hedef kullanıcılar 96….
const MUDUR = '92000000-0000-4000-8000-000000000001';
const STAJYER = '92000000-0000-4000-8000-000000000002';

const H1 = '96000000-0000-4000-8000-000000000001';
const H2 = '96000000-0000-4000-8000-000000000002';
const H3 = '96000000-0000-4000-8000-000000000003';
const HEDEFLER = [
  [H1, 'Hedef Bir', '5550001'],
  [H2, 'Hedef İki', '5550002'],
  [H3, 'Hedef Üç', null],
] as const;

// Yasağı olmayan kişinin listesinde bu karttan önceki motorun attığı sorgu sayıları (ölçüldü: bu dosya
// motor değişmeden önce koşturuldu). Tek kural: sayfa sorgusu; kolon kümeleri farklı iki kural: sayfa
// sorgusu ve kural başına birer kolon sorgusu.
const ONCEKI_SORGU = { tekKural: 1, ikiKural: 3 } as const;

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;
let prisma: PrismaClient<'query'>;
let katalog: KaynakKatalogu;
let kapi: EskiOkumaKapisi;
const sorgular: string[] = [];
let kokGrup: string;
let yetenekNo = 0;

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

async function oturumAc(kisi: string, no: number): Promise<string> {
  const oturum = kimlik('95', no);
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
  const id = kimlik('90', no);
  const grup = kimlik('91', no);
  await gozlemci.query(
    'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
    [grup, kokGrup, `Grup ${String(no)}`],
  );
  await gozlemci.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
    [id, `kisi${String(no)}`],
  );
  for (const [sira, rol] of [MUDUR, STAJYER].entries()) {
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [kimlik('93', no * 10 + sira), id, grup, rol],
    );
  }
  return { id, grup, oturum: await oturumAc(id, no) };
}

interface YetenekSecenekleri {
  readonly grup: string;
  readonly rol: string;
  readonly kaynak?: string;
  readonly giremez?: boolean;
  readonly oncelik?: number;
  // Saklanan şart olduğu gibi yazılır; verilmezse bütün kayıtlar.
  readonly sart?: unknown;
  // Verilmezse bütün kolonlar.
  readonly kolonlar?: readonly string[];
}

// Okuma yeteneği; kaynak verilmezse Kullanici.
async function yetenekEkle({
  grup,
  rol,
  kaynak = 'Kullanici',
  giremez = false,
  oncelik = 0,
  sart,
  kolonlar,
}: YetenekSecenekleri): Promise<string> {
  yetenekNo += 1;
  const id = kimlik('94', yetenekNo);
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, giremez, oncelik, koken)
     values ($1, $2, $3, (select id from izin where kaynak = $4 and eylem = 'oku'), $5::jsonb,
             $5::jsonb is null, $6, $6::text[] is null, $7, $8, 'yonetici')`,
    [
      id,
      grup,
      rol,
      kaynak,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
      giremez,
      oncelik,
    ],
  );
  return id;
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

// Kişinin, guard'ın kullandığı yetki belleğindeki derlenmiş yetkisi.
async function derlenmisYetki(kisi: string): Promise<DerlemeSonucu> {
  const surumler = await uygulama()
    .get<YetkiVerisi>(YETKI_VERISI)
    .surumler(kisi);
  return uygulama().get(YetkiBellegi).al(kisi, surumler);
}

// İşi, kişinin derlenmiş yetkisi yazılmış bir istek bağlamının içinde koşturur.
async function istekte<T>(kisi: string, is: () => Promise<T>): Promise<T> {
  const yetki = await derlenmisYetki(kisi);
  return new Promise<T>((coz, reddet) => {
    // Ara katman istekten bir şey okumaz, cevaba yalnız başlık yazar.
    const cevap = { setHeader: () => undefined };
    istekBaglamiAraKatmani(
      {} as unknown as IncomingMessage,
      cevap as unknown as ServerResponse,
      () => {
        istekYetkisiniYaz(yetki);
        is().then(coz, reddet);
      },
    );
  });
}

// Hedef kullanıcıların kişinin gözünden listesi (kimliğe göre sıralı); sayılan sorgular yalnız bu
// okumanınkilerdir.
function oku(kisi: string, istek: ListeIstegi = {}): Promise<Kayit[]> {
  return istekte(kisi, () => {
    sorgular.length = 0;
    return kapi.liste(prisma, 'Kullanici', {
      ...istek,
      kosul: [
        { alan: 'id', islec: 'listede', deger: [H1, H2, H3] },
        ...(istek.kosul ?? []),
      ],
    });
  });
}

// Kişinin bu kaynaktaki satır süzgeci.
function satirSuzgeci(
  kisi: string,
  bakilan: readonly string[] = [],
): Promise<unknown> {
  return istekte(kisi, () =>
    Promise.resolve(
      new OkumaKapisi(katalog).yetki('Kullanici', { bakilan }).satirlar,
    ),
  );
}

// Uç listesinin kayıtları; liste bütün kullanıcıları tek sayfada verir.
async function listele(kisi: Kisi, yol: string): Promise<Kayit[]> {
  const cevap = await getir(kisi, `${yol}?boyut=100`);
  expect(cevap.status).toBe(200);
  return (cevap.body as { kayitlar: Kayit[] }).kayitlar;
}

const TAM = {
  [H1]: { gorunenAd: 'Hedef Bir', telefon: '5550001' },
  [H2]: { gorunenAd: 'Hedef İki', telefon: '5550002' },
  [H3]: { gorunenAd: 'Hedef Üç', telefon: null },
} as const;

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
    await gozlemci.query(
      "insert into rol (id, ad) values ($1, 'Müdür'), ($2, 'Stajyer')",
      [MUDUR, STAJYER],
    );
    for (const [id, ad, telefon] of HEDEFLER) {
      await gozlemci.query(
        'insert into kullanici (id, gorunen_ad, telefon) values ($1, $2, $3)',
        [id, ad, telefon],
      );
    }
    katalog = uygulama().get<KaynakKatalogu>(KAYNAK_KATALOGU);
    kapi = new EskiOkumaKapisi(katalog);
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databases.asil.url }),
      log: [{ emit: 'event', level: 'query' }],
    });
    prisma.$on('query', (olay) => {
      sorgular.push(olay.query);
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

describe('a) senaryolar', () => {
  it('Senaryo 1: şartsız kolon yasağı: telefon listede ve kayıt sayfasında 0 kayıtta gelir', async () => {
    const kisi = await kisiKur(1);
    await gozlemci.query('update kullanici set telefon = $1 where id = $2', [
      '5559001',
      kisi.id,
    ]);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      oncelik: 10,
      kolonlar: ['telefon'],
    });

    const liste = await listele(kisi, '/kimlik/kullanici');
    expect(liste.map((k) => k['id'])).toEqual(
      expect.arrayContaining([kisi.id, H1, H2, H3]),
    );
    expect(liste.filter((k) => 'telefon' in k)).toEqual([]);
    expect(liste.find((k) => k['id'] === H1)).toMatchObject({
      gorunenAd: 'Hedef Bir',
    });

    for (const id of [kisi.id, H1]) {
      const sayfa = await getir(kisi, `/kimlik/kullanici/${id}`);
      expect(sayfa.status).toBe(200);
      expect(sayfa.body).toHaveProperty('gorunenAd');
      expect(sayfa.body).not.toHaveProperty('telefon');
    }
  });

  it('Senaryo 3: yasak 10 ve izin 20 ise izin geçerlidir; ikisi 10 ise yasak kazanır', async () => {
    const yuksek = await kisiKur(2);
    await yetenekEkle({ grup: yuksek.grup, rol: MUDUR, oncelik: 20 });
    await yetenekEkle({
      grup: yuksek.grup,
      rol: STAJYER,
      giremez: true,
      oncelik: 10,
    });
    const esit = await kisiKur(3);
    await yetenekEkle({ grup: esit.grup, rol: MUDUR, oncelik: 10 });
    await yetenekEkle({
      grup: esit.grup,
      rol: STAJYER,
      giremez: true,
      oncelik: 10,
    });

    expect(await oku(yuksek.id)).toEqual(
      ([H1, H2, H3] as const).map(
        (id) => expect.objectContaining({ id, ...TAM[id] }) as unknown,
      ),
    );
    expect(await oku(esit.id)).toEqual([]);
    expect(await listele(esit, '/kimlik/kullanici')).toEqual([]);
  });

  it('Senaryo 4 (okuma): bozuk yasak o izni o kişide kapatır: liste 0 kayıt döner', async () => {
    const kisi = await kisiKur(4);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    // İki kolonlu yasak; ikinci kolonun adı şemada kalmamıştır.
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      kolonlar: ['gorunenAd', 'eskiKolon'],
    });

    expect(await listele(kisi, '/kimlik/kullanici')).toEqual([]);
    expect((await getir(kisi, `/kimlik/kullanici/${H1}`)).status).toBe(404);
    expect(await satirSuzgeci(kisi.id)).toEqual({ id: { in: [] } });
  });

  it('Senaryo 6: boş değer: üst grubu boş kök grup yasaklı sayılmaz ve listede kalır', async () => {
    const kisi = await kisiKur(6);
    const torun = kimlik('91', 61);
    await gozlemci.query(
      "insert into grup (id, ust_grup_id, ad) values ($1, $2, 'Torun')",
      [torun, kisi.grup],
    );
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR, kaynak: 'Grup' });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      kaynak: 'Grup',
      giremez: true,
      sart: [{ alan: 'ustGrupId', islec: 'esit', deger: kokGrup }],
    });

    const kimlikler = (await listele(kisi, '/kimlik/grup')).map((k) => k['id']);
    expect(kimlikler).toContain(kokGrup);
    expect(kimlikler).toContain(torun);
    expect(kimlikler).not.toContain(kisi.grup);
  });

  // Testin sonunda (Kök, Temel) kümesinde Oturum:oku yasağı kalır; bu dosyada sonra Oturum okunmaz.
  it('Senaryo 5: kök yöneticinin sistem izinleri yasakla kapanmaz (0 fark); aynı yasak başka rolün sistem satırını kapatır', async () => {
    const temelRol = (
      await tekSatir<{ id: string }>("select id from rol where kod = 'temel'")
    ).id;
    const kokYoneticiId = (
      await tekSatir<{ id: string }>(
        "select id from kullanici where kullanici_adi = 'superadmin'",
      )
    ).id;
    const kokYonetici: Kisi = {
      id: kokYoneticiId,
      grup: kokGrup,
      oturum: await oturumAc(kokYoneticiId, 50),
    };
    // Yalnız (Kök, Temel) üyeliği olan kişi: kendi oturumlarını temel rolün sistem satırıyla okur.
    const temel: Kisi = {
      id: kimlik('90', 5),
      grup: kokGrup,
      oturum: kimlik('95', 5),
    };
    await gozlemci.query(
      "insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, 'kisi5', 'kisi5')",
      [temel.id],
    );
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [kimlik('93', 50), temel.id, kokGrup, temelRol],
    );
    await oturumAc(temel.id, 5);
    const gorunum = (kayitlar: readonly Kayit[]) =>
      kayitlar.map((k) => [k['id'], Object.keys(k).sort()]);

    const oncekiKok = gorunum(await listele(kokYonetici, '/kimlik/oturum'));
    expect(
      (await listele(temel, '/kimlik/oturum')).map((k) => k['id']),
    ).toEqual([temel.oturum]);
    const oncekiKullanicilar = gorunum(
      await listele(kokYonetici, '/kimlik/kullanici'),
    );

    // Kök yöneticinin üyesi olduğu iki kümeye yasak: (Kök, Temel) Oturum:oku ve (Kök, SuperAdmin)
    // Kullanici:oku; ikisi de koşulsuz, bütün kolonlu, öncelik 100.
    const kokYoneticiRol = (
      await tekSatir<{ id: string }>(
        "select id from rol where kod = 'superadmin'",
      )
    ).id;
    await yetenekEkle({
      grup: kokGrup,
      rol: temelRol,
      kaynak: 'Oturum',
      giremez: true,
      oncelik: 100,
    });
    await yetenekEkle({
      grup: kokGrup,
      rol: kokYoneticiRol,
      giremez: true,
      oncelik: 100,
    });
    await gozlemci.query(
      'update kullanici set yetki_surumu = yetki_surumu + 1 where id in ($1, $2)',
      [kokYonetici.id, temel.id],
    );

    expect(gorunum(await listele(kokYonetici, '/kimlik/oturum'))).toEqual(
      oncekiKok,
    );
    expect(gorunum(await listele(kokYonetici, '/kimlik/kullanici'))).toEqual(
      oncekiKullanicilar,
    );
    expect(await listele(temel, '/kimlik/oturum')).toEqual([]);
  });
});

describe('b) koşulsuz ve şartlı yasaklar', () => {
  it('koşulsuz yasak ve koşulsuz izin: hiçbir kayıt gelmez', async () => {
    const kisi = await kisiKur(7);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    await yetenekEkle({ grup: kisi.grup, rol: STAJYER, giremez: true });

    expect(await oku(kisi.id)).toEqual([]);
    expect(await satirSuzgeci(kisi.id)).toEqual({ id: { in: [] } });
  });

  it('uygulanacak yasağı kalmayan koşulsuz izin dalı süzgeci koşulsuz yapar; yasağın kapattığı izin kolon da vermez', async () => {
    const kisi = await kisiKur(8);
    // Öncelik 20: yasağın üstünde, koşulsuz, yalnız ad.
    await yetenekEkle({
      grup: kisi.grup,
      rol: MUDUR,
      oncelik: 20,
      kolonlar: ['gorunenAd'],
    });
    // Öncelik 0: yasağın altında, şartlı, bütün kolonlar.
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
    });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      oncelik: 10,
    });

    expect(await satirSuzgeci(kisi.id)).toEqual({});
    expect(await oku(kisi.id)).toEqual(
      ([H1, H2, H3] as const).map((id) => ({
        id,
        gorunenAd: TAM[id].gorunenAd,
      })),
    );
  });

  it('yer tutuculu şart taşıyan yasak: isteyenin kendi kaydı gelmez, öbürleri gelir', async () => {
    const kisi = await kisiKur(9);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'id', islec: 'esit', deger: { yerTutucu: 'isteyen' } }],
    });

    const kayitlar = await istekte(kisi.id, () =>
      kapi.liste(prisma, 'Kullanici', {
        kosul: [{ alan: 'id', islec: 'listede', deger: [H1, kisi.id] }],
      }),
    );
    expect(kayitlar.map((k) => k['id'])).toEqual([H1]);
  });

  it('şartlı kayıt yasağı: tuttuğu kayıt gelmez, tutmadığı gelir', async () => {
    const kisi = await kisiKur(10);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef İki' }],
    });

    expect(await oku(kisi.id)).toEqual(
      ([H1, H3] as const).map(
        (id) => expect.objectContaining({ id, ...TAM[id] }) as unknown,
      ),
    );
  });
});

describe('c) yasaklı kolona göre süzme ve sıralama kolonu ele vermez', () => {
  it('şartsız yasakla kolonu kaybeden kural okumaya katılmaz', async () => {
    const kisi = await kisiKur(11);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      kolonlar: ['telefon'],
    });

    expect(
      await oku(kisi.id, { siralama: [{ alan: 'telefon', yon: 'artan' }] }),
    ).toEqual([]);
    expect(
      await oku(kisi.id, { kosul: [{ alan: 'telefon', islec: 'dolu' }] }),
    ).toEqual([]);
    expect(await satirSuzgeci(kisi.id, ['telefon'])).toEqual({
      id: { in: [] },
    });
    // Süzmeden ve sıralamadan bağımsız okumada kural katılır, telefon gelmez.
    expect((await oku(kisi.id)).map((k) => [k['id'], 'telefon' in k])).toEqual([
      [H1, false],
      [H2, false],
      [H3, false],
    ]);
  });

  it('şartlı yasakla kolonu kaybeden kayıtlar satır koşulundan çıkarılır', async () => {
    const kisi = await kisiKur(12);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
      kolonlar: ['telefon'],
    });

    expect(
      (
        await oku(kisi.id, { siralama: [{ alan: 'telefon', yon: 'artan' }] })
      ).map((k) => [k['id'], k['telefon']]),
    ).toEqual([
      [H2, '5550002'],
      [H3, null],
    ]);
    expect(
      (await oku(kisi.id, { kosul: [{ alan: 'telefon', islec: 'dolu' }] })).map(
        (k) => k['id'],
      ),
    ).toEqual([H2]);
    // Süzmeden bağımsız okumada kayıt gelir, kolonu gelmez.
    expect((await oku(kisi.id)).map((k) => [k['id'], 'telefon' in k])).toEqual([
      [H1, false],
      [H2, true],
      [H3, true],
    ]);
  });
});

it('d) şartlı kolon yasağı: kolonun değeri yasağın "kesin tutmuyor" koşuluyla aynı deyimde okunur; yasağın tuttuğu kayıtta kolon yoktur, tutmadığında vardır', async () => {
  const kisi = await kisiKur(13);
  await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
  await yetenekEkle({
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
    sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
    kolonlar: ['telefon'],
  });

  const kayitlar = await oku(kisi.id);

  expect(kayitlar.map((k) => [k['id'], k['telefon']])).toEqual([
    [H1, undefined],
    [H2, '5550002'],
    [H3, null],
  ]);
  expect(kayitlar[0]).toMatchObject({ gorunenAd: 'Hedef Bir' });
  expect(kayitlar[0]).not.toHaveProperty('telefon');
  // Telefonu seçen tek deyim vardır ve koşulunda yasağın "kesin tutmuyor" koşulu (ad eşit değil) durur.
  const telefonuSecen = sorgular.filter((sorgu) =>
    (sorgu.split(' FROM ')[0] ?? '').includes('"telefon"'),
  );
  expect(telefonuSecen).toHaveLength(1);
  expect(telefonuSecen[0]).toMatch(/"gorunen_ad" <> \$\d+/);
});

// Örtüşen şartlı kolon yasakları (TS-008 AU-33, kullanıcının kararı: tek sorguda oku): kolon, onu
// kapatabilen bütün yasakların "kesin tutmuyor" koşullarıyla tek deyimde okunur.
describe('d) örtüşen şartlı kolon yasakları', () => {
  // Kayıt başına, verilen kolonların kayıtta bulunup bulunmadığı.
  function kolonlarVarMi(
    kayitlar: readonly Kayit[],
    kolonlar: readonly string[],
  ): Record<string, boolean[]> {
    return Object.fromEntries(
      kayitlar.map((k) => [
        String(k['id']),
        kolonlar.map((kolon) => kolon in k),
      ]),
    );
  }

  it('aynı kolonu kapatan iki yasak: kolon yalnız ikisi de tutmuyorsa gelir; değer ile iki karar aynı deyimden gelir', async () => {
    const kisi = await kisiKur(18);
    await gozlemci.query('update kullanici set telefon = $1 where id = $2', [
      '5559018',
      kisi.id,
    ]);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    // A: adı Hedef Bir ya da kisi18 olan kayıtta telefon kapalı.
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [
        { alan: 'gorunenAd', islec: 'listede', deger: ['Hedef Bir', 'kisi18'] },
      ],
      kolonlar: ['telefon'],
    });
    // B: telefonu 5550002 ya da 5559018 olan kayıtta telefon kapalı.
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [
        { alan: 'telefon', islec: 'listede', deger: ['5550002', '5559018'] },
      ],
      kolonlar: ['telefon'],
    });
    const k = 1;
    const c = 2;

    const kayitlar = await istekte(kisi.id, () => {
      sorgular.length = 0;
      return kapi.liste(prisma, 'Kullanici', {
        kosul: [{ alan: 'id', islec: 'listede', deger: [H1, H2, H3, kisi.id] }],
      });
    });

    // H1 yalnız A, H2 yalnız B, H3 hiçbiri, kişinin kendisi ikisi de.
    expect(kolonlarVarMi(kayitlar, ['gorunenAd', 'telefon'])).toEqual({
      [H1]: [true, false],
      [H2]: [true, false],
      [H3]: [true, true],
      [kisi.id]: [true, false],
    });
    expect(kayitlar.find((kayit) => kayit['id'] === H3)).toMatchObject({
      telefon: null,
    });
    // Telefonu seçen tek deyim vardır; koşulunda iki yasağın da "kesin tutmuyor" koşulu durur.
    const telefonuSecen = sorgular.filter((sorgu) =>
      (sorgu.split(' FROM ')[0] ?? '').includes('"telefon"'),
    );
    expect(telefonuSecen).toHaveLength(1);
    const kosul = telefonuSecen[0]?.split(' WHERE ')[1] ?? '';
    expect(kosul).toContain('"gorunen_ad"');
    expect(kosul).toContain('"telefon"');
    // Sayfa, serbest kolonlar ve tek grup: 3 sorgu.
    expect(sorgular.length).toBeLessThanOrEqual(1 + k + k * c);
    expect(sorgular).toHaveLength(3);
  });

  it('listeleri kısmen örtüşen iki yasak: yalnız birinin kapattığı kolon öbürünün kararından etkilenmez', async () => {
    const kisi = await kisiKur(19);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    // A: Hedef Bir'de kullanıcı adı ve telefon kapalı.
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
      kolonlar: ['kullaniciAdi', 'telefon'],
    });
    // B: Hedef İki'de telefon ve sistem aktörü kapalı.
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef İki' }],
      kolonlar: ['telefon', 'sistemAktoru'],
    });

    const kayitlar = await oku(kisi.id);

    expect(
      kolonlarVarMi(kayitlar, ['kullaniciAdi', 'telefon', 'sistemAktoru']),
    ).toEqual({
      [H1]: [false, false, true],
      [H2]: [true, false, false],
      [H3]: [true, true, true],
    });
    // Örtüşmede deyim, kolonları kapatan yasak kümesi başınadır: sayfa, serbest kolonlar ve üç grup
    // ({A}: kullanıcı adı, {A, B}: telefon, {B}: sistem aktörü) 5 sorgu; 1 + k + k × c = 4 aşılır.
    expect(sorgular).toHaveLength(5);
  });
});

describe('e) kimlikten başka kolonu kalmayan kayıt verilmez', () => {
  it('şartsız kolon yasağı izin kuralının bütün kolonlarını kapatırsa kural kayıt vermez', async () => {
    const kisi = await kisiKur(14);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR, kolonlar: ['telefon'] });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
      kolonlar: ['gorunenAd'],
    });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      kolonlar: ['telefon'],
    });

    expect(await oku(kisi.id)).toEqual([{ id: H1, gorunenAd: 'Hedef Bir' }]);
  });

  it('şartlı kolon yasağı izin kuralının bütün kolonlarını kapattığı kayıtta kural o kaydı vermez', async () => {
    const kisi = await kisiKur(15);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR, kolonlar: ['telefon'] });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
      kolonlar: ['telefon'],
    });

    expect(await oku(kisi.id)).toEqual([
      { id: H2, telefon: '5550002' },
      { id: H3, telefon: null },
    ]);
  });
});

describe('f) sorgu sayısı', () => {
  it('yasağı olmayan kişinin listesinde sorgu sayısı bu karttan öncekiyle aynıdır', async () => {
    const kisi = await kisiKur(16);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });

    expect(await oku(kisi.id)).toHaveLength(3);
    expect(sorgular).toHaveLength(ONCEKI_SORGU.tekKural);

    // Kolon kümesi farklı ikinci kural (yetki sürümü artınca yeniden derlenir).
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef Bir' }],
      kolonlar: ['gorunenAd'],
    });
    await gozlemci.query(
      'update kullanici set yetki_surumu = yetki_surumu + 1 where id = $1',
      [kisi.id],
    );
    expect(await oku(kisi.id)).toHaveLength(3);
    expect(sorgular).toHaveLength(ONCEKI_SORGU.ikiKural);
  });

  it('yasağı olan kişide sorgu sayısı en çok 1 + k + k × c olur (k izin kuralı, c şartlı kolon yasağı)', async () => {
    const kisi = await kisiKur(17);
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      sart: [
        {
          alan: 'gorunenAd',
          islec: 'listede',
          deger: ['Hedef Bir', 'Hedef İki'],
        },
      ],
      kolonlar: ['gorunenAd', 'telefon'],
    });
    await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      giremez: true,
      sart: [{ alan: 'gorunenAd', islec: 'esit', deger: 'Hedef İki' }],
      kolonlar: ['telefon'],
    });
    const k = 2;
    const c = 1;

    const kayitlar = await oku(kisi.id);

    expect(kayitlar.map((kayit) => [kayit['id'], kayit['telefon']])).toEqual([
      [H1, '5550001'],
      [H2, undefined],
      [H3, null],
    ]);
    expect(sorgular.length).toBeLessThanOrEqual(1 + k + k * c);
    expect(sorgular).toHaveLength(5);
  });
});
