// Yazma motoru (1/2): yasağın kilit altında sınanması, yeni hâl, oluşturma, silme ve niyet (GV-153; TS-008
// "Yapı" altında "Tanım", "Muafiyetler" ve "Yazma"; KU-017, KU-018). Koşturma:
//   pnpm -C backend test:e2e test/yetki-yasak-yazma.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; başlangıcı tohum
// koşucusu kurar. Yasak satırları veritabanına doğrudan yazılır; yasak yazımını kapatan geçici kısıt
// test yardımcısıyla düşürülür. Kimlik'te silme izni olan kaynakların hepsi korunan kaynak olduğu için
// (yasakları bozuk derlenir) bu veritabanına Kullanici:sil izni eklenir. Senaryo 2, karar veren yasağın
// cevaba sızmaması ve muafiyet uçtan (HTTP) sınanır; öbür durumlar yetki kapısının yazma yüzünde, kişinin
// uygulamadaki derlenmiş yetkisiyle, sorgu olaylarını sayan ayrı bir Prisma istemcisi ve Unit of Work
// üzerinden yazılır. Her test kendi kişisiyle çalışır, çünkü yetki belleği süreç boyunca yaşar.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { KIMLIK_KURULUM_GOCU } from '../src/features/kimlik/_shared/infrastructure/tohum/kimlik-kurulum.goc.js';
import type { Islem } from '../src/shared/database/domain/islem.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { RepoKayitlari } from '../src/shared/database/infrastructure/registrar.js';
import { UnitOfWork } from '../src/shared/database/infrastructure/unit-of-work.js';
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
  OUTBOX_REPO,
  outboxRepo,
} from '../src/shared/messaging/infrastructure/outbox/outbox-repo.js';
import { OutboxYazici } from '../src/shared/messaging/infrastructure/outbox/outbox-yazici.js';
import {
  istekBaglamiAraKatmani,
  istekOturumunuYaz,
  istekYetkisiniYaz,
} from '../src/shared/observability/istek-baglami/istek-baglami.js';
import { TohumKosucusu } from '../src/shared/tohum/infrastructure/tohum-kosucusu.js';
import {
  KAYNAK_KATALOGU,
  type YazmaKatalogu,
} from '../src/shared/yetki/domain/kaynak-katalogu.js';
import {
  YasakReddi,
  YazmaKapisi,
} from '../src/shared/yetki/infrastructure/yazma-kapisi.js';
import { YetkiBellegi } from '../src/shared/yetki/infrastructure/yetki-bellegi.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';
import { EskiYazmaKapisi } from './yardimci/eski-yuz.js';
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const IP = '203.0.113.33';
const TARAYICI = 'Mozilla/5.0 yasak yazma deneme';

// Kimlikler: kişiler 90…, gruplar 91…, roller 92…, üyelikler 93…, yetenekler 94…, oturumlar 95…, yazılan
// hedef kullanıcılar 96….
const MUDUR = '92000000-0000-4000-8000-000000000001';
const STAJYER = '92000000-0000-4000-8000-000000000002';

const SERBEST = 'Serbest Ad';
const YASAKLI = 'Yasaklı Ad';
// Yasağın şartı: adı YASAKLI olan kayıt.
const YASAKLI_AD = [{ alan: 'gorunenAd', islec: 'esit', deger: YASAKLI }];

// Yasağı olmayan kişinin yazmasında bu karttan önceki motorun attığı sorgu sayıları (ölçüldü: bu dosya
// motor değişmeden önce koşturuldu).
const ONCEKI_SORGU = {
  guncelle: 6,
  niyet: 5,
  olustur: 4,
  sil: 5,
} as const;

const RET_GOVDESI = {
  kod: 'yetki_yok',
  ileti: 'Bu işlem için yetki yok',
  ayrinti: null,
};

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;
let prisma: PrismaClient<'query'>;
let uow: UnitOfWork;
let kapi: EskiYazmaKapisi;
const sorgular: string[] = [];
let kokGrup: string;
let yetenekNo = 0;
let hedefNo = 0;

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

// Yazılacak hedef kullanıcı.
async function hedefKur(ad: string): Promise<string> {
  hedefNo += 1;
  const id = kimlik('96', hedefNo);
  await gozlemci.query(
    'insert into kullanici (id, gorunen_ad) values ($1, $2)',
    [id, ad],
  );
  return id;
}

interface YetenekSecenekleri {
  readonly grup: string;
  readonly rol: string;
  readonly kaynak?: string;
  readonly eylem: string;
  readonly giremez?: boolean;
  readonly oncelik?: number;
  // Saklanan şart olduğu gibi yazılır; verilmezse bütün kayıtlar.
  readonly sart?: unknown;
  // Verilmezse bütün kolonlar.
  readonly kolonlar?: readonly string[];
}

// Yetenek; kaynak verilmezse Kullanici.
async function yetenekEkle({
  grup,
  rol,
  kaynak = 'Kullanici',
  eylem,
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
  return id;
}

// Müdür'e verilen izinler: her eylemde bütün kayıtlar ve bütün kolonlar.
async function izinVer(
  kisi: Kisi,
  eylemler: readonly string[],
  { kaynak = 'Kullanici', oncelik = 0 } = {},
): Promise<void> {
  for (const eylem of eylemler) {
    await yetenekEkle({ grup: kisi.grup, rol: MUDUR, kaynak, eylem, oncelik });
  }
}

// Stajyer'e yazılan yasak.
function yasakla(
  kisi: Kisi,
  secenekler: Omit<YetenekSecenekleri, 'grup' | 'rol' | 'giremez'>,
): Promise<string> {
  return yetenekEkle({
    ...secenekler,
    grup: kisi.grup,
    rol: STAJYER,
    giremez: true,
  });
}

function surumuArtir(...kisiler: readonly string[]): Promise<unknown> {
  return gozlemci.query(
    'update kullanici set yetki_surumu = yetki_surumu + 1 where id = any($1::uuid[])',
    [kisiler],
  );
}

function post(kisi: Kisi, yol: string): Promise<request.Response> {
  return istek(kisi, (sunucu) => sunucu.post(yol));
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

// İşi, kişinin oturumu ve uygulamadaki derlenmiş yetkisi yazılmış bir istek bağlamında, kendi run'ında
// koşturur. Sayılan sorgular yalnız bu işinkilerdir.
async function yaz<T>(
  kisi: Kisi,
  is: (islem: Islem) => Promise<T>,
): Promise<T> {
  const surumler = await uygulama()
    .get<YetkiVerisi>(YETKI_VERISI)
    .surumler(kisi.id);
  const yetki = await uygulama().get(YetkiBellegi).al(kisi.id, surumler);
  return new Promise<T>((coz, reddet) => {
    // Ara katman istekten bir şey okumaz, cevaba yalnız başlık yazar.
    const cevap = { setHeader: () => undefined };
    istekBaglamiAraKatmani(
      {} as unknown as IncomingMessage,
      cevap as unknown as ServerResponse,
      () => {
        istekOturumunuYaz({
          kullaniciId: kisi.id,
          oturumId: kisi.oturum,
          ...surumler,
        });
        istekYetkisiniYaz(yetki);
        sorgular.length = 0;
        uow.run(is).then(coz, reddet);
      },
    );
  });
}

function guncelle(
  kisi: Kisi,
  id: string,
  veri: Record<string, unknown>,
): Promise<void> {
  return yaz(kisi, (islem) =>
    kapi.guncelle(islem, 'kullanici.guncelle', 'Kullanici', id, veri),
  );
}

function pasifeAl(
  kisi: Kisi,
  id: string,
  veri: Record<string, unknown> = {},
): Promise<void> {
  return yaz(kisi, (islem) =>
    kapi.niyet(islem, 'kullanici.pasife_al', 'Kullanici', 'pasife_al', id, {
      pasifZamani: new Date(),
      ...veri,
    }),
  );
}

function olustur(kisi: Kisi, ad: string): Promise<string> {
  return yaz(kisi, (islem) =>
    kapi.olustur(islem, 'kullanici.olustur', 'Kullanici', { gorunenAd: ad }),
  );
}

function sil(kisi: Kisi, id: string): Promise<void> {
  return yaz(kisi, (islem) =>
    kapi.sil(islem, 'kullanici.sil', 'Kullanici', id),
  );
}

interface HedefSatiri {
  gorunen_ad: string;
  telefon: string | null;
  pasif_zamani: Date | null;
}

async function hedefSatiri(id: string): Promise<HedefSatiri | undefined> {
  return (
    await gozlemci.query<HedefSatiri>(
      'select gorunen_ad, telefon, pasif_zamani from kullanici where id = $1',
      [id],
    )
  ).rows[0];
}

// Kaydın değişiklik kaydı notlarının sayısı.
async function notSayisi(kayitId: string): Promise<number> {
  return (
    await tekSatir<{ sayi: number }>(
      "select count(*)::int as sayi from outbox_iz where govde->>'kayit_id' = $1",
      [kayitId],
    )
  ).sayi;
}

// Veritabanında bir bağlantı satır kilidi bekleyene dek yoklar.
async function kilitBekleyeniBekle(): Promise<void> {
  const son = Date.now() + 3_000;
  for (;;) {
    const { rows } = await gozlemci.query<{ sayi: number }>(
      `select count(*)::int as sayi from pg_stat_activity
        where datname = $1 and wait_event_type = 'Lock'`,
      [databases.asil.name],
    );
    if ((rows[0]?.sayi ?? 0) > 0) {
      return;
    }
    if (Date.now() > son) {
      throw new Error('Kilit bekleyen bağlantı görülmedi');
    }
    await new Promise((coz) => setTimeout(coz, 20));
  }
}

// Ayrı bir bağlantıda satırı değiştirip işlemi açık tutar (satır kilitli kalır); bitir işlemi kapatır.
async function kilitliDegisiklik(
  sql: string,
  degerler: unknown[],
): Promise<{ bitir: () => Promise<void> }> {
  const istemci = new pg.Client({ connectionString: databases.asil.url });
  await istemci.connect();
  await istemci.query('begin');
  await istemci.query(sql, degerler);
  return {
    bitir: async () => {
      try {
        await istemci.query('commit');
      } finally {
        await istemci.end();
      }
    },
  };
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
    await gozlemci.query(
      "insert into rol (id, ad) values ($1, 'Müdür'), ($2, 'Stajyer')",
      [MUDUR, STAJYER],
    );
    await gozlemci.query(
      "insert into izin (id, kaynak, eylem) values ($1, 'Kullanici', 'sil')",
      [kimlik('97', 1)],
    );
    const katalog = uygulama().get<YazmaKatalogu>(KAYNAK_KATALOGU);
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databases.asil.url }),
      log: [{ emit: 'event', level: 'query' }],
    });
    prisma.$on('query', (olay) => {
      sorgular.push(olay.query);
    });
    const kayitlar = new RepoKayitlari();
    kayitlar.register(OUTBOX_REPO, outboxRepo);
    uow = new UnitOfWork(prisma, kayitlar);
    kapi = new EskiYazmaKapisi(
      new YazmaKapisi(katalog, new OutboxYazici(), kayitlar),
    );
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

describe('a) yarış ölçümü (iki işlem)', () => {
  it('satır kilidini bekleyen şartlı güncelleme, öbür işlem bitince koşulunu yeni hâlde yeniden değerlendirir: koşul artık tutmuyorsa 0 satır', async () => {
    const hedef = await hedefKur(SERBEST);
    const birinci = await kilitliDegisiklik(
      'update kullanici set gorunen_ad = $2 where id = $1',
      [hedef, YASAKLI],
    );
    const ikinci = new pg.Client({ connectionString: databases.asil.url });
    await ikinci.connect();
    try {
      // Motorun kilidiyle aynı biçim: kimliği kendi değerine yazan şartlı güncelleme.
      const bekleyen = ikinci.query(
        'update kullanici set id = id where id = $1 and gorunen_ad = $2',
        [hedef, SERBEST],
      );
      await kilitBekleyeniBekle();
      await birinci.bitir();
      expect((await bekleyen).rowCount).toBe(0);
    } finally {
      await ikinci.end();
    }
    expect((await hedefSatiri(hedef))?.gorunen_ad).toBe(YASAKLI);
  });

  it('yasak kilit altında sınanır: kilit beklerken kaydı yasağın içine sokan işlem bitince yazma yetki_yok alır, satır değişmez, not yazılmaz', async () => {
    const kisi = await kisiKur(1);
    await izinVer(kisi, ['guncelle']);
    const yasak = await yasakla(kisi, { eylem: 'guncelle', sart: YASAKLI_AD });
    const hedef = await hedefKur(SERBEST);

    // Yarışsız: kayıt yasağın dışında, yazma geçer.
    await guncelle(kisi, hedef, { telefon: '5550001' });
    expect((await hedefSatiri(hedef))?.telefon).toBe('5550001');

    const birinci = await kilitliDegisiklik(
      'update kullanici set gorunen_ad = $2 where id = $1',
      [hedef, YASAKLI],
    );
    const yazma = guncelle(kisi, hedef, { telefon: '5550002' });
    // Yazma reddedilirse işlenmemiş ret olarak kalmasın.
    yazma.catch(() => undefined);
    await kilitBekleyeniBekle();
    await birinci.bitir();

    await expect(yazma).rejects.toMatchObject({
      kod: 'yetki_yok',
      kararVerenYasakId: yasak,
    });
    expect(await hedefSatiri(hedef)).toMatchObject({
      gorunen_ad: YASAKLI,
      telefon: '5550001',
    });
    expect(await notSayisi(hedef)).toBe(1);
  });
});

it('b) Senaryo 2: şartlı niyet yasağında başkasının oturumunu kapatma yetki yok alır, 0 satır değişir, not yazılmaz; kişi kendi oturumunu kapatır', async () => {
  const kisi = await kisiKur(2);
  await izinVer(kisi, ['kapat', 'oku'], { kaynak: 'Oturum' });
  await yasakla(kisi, {
    kaynak: 'Oturum',
    eylem: 'kapat',
    oncelik: 10,
    sart: [
      {
        alan: 'kullaniciId',
        islec: 'esit_degil',
        deger: { yerTutucu: 'isteyen' },
      },
    ],
  });
  const baskasi = await kisiKur(3);
  const kendi = await oturumAc(kisi.id, 21);
  const oturumSatiri = async (id: string): Promise<unknown> =>
    (await gozlemci.query('select * from oturum where id = $1', [id])).rows[0];
  const onceki = await oturumSatiri(baskasi.oturum);

  const ret = await post(kisi, `/kimlik/oturum/${baskasi.oturum}/kapat`);
  expect(ret.status).toBe(403);
  expect(ret.body).toEqual(RET_GOVDESI);
  expect(await oturumSatiri(baskasi.oturum)).toEqual(onceki);
  expect(await notSayisi(baskasi.oturum)).toBe(0);

  expect((await post(kisi, `/kimlik/oturum/${kendi}/kapat`)).status).toBe(204);
  expect(
    await tekSatir<{ kapali: boolean }>(
      'select kapatilma_zamani is not null as kapali from oturum where id = $1',
      [kendi],
    ),
  ).toEqual({ kapali: true });
});

it('c) öncelik: yasak 10 ve izin 20 ise yazma geçer; ikisi 10 ise yetki yok', async () => {
  const yuksek = await kisiKur(4);
  await izinVer(yuksek, ['guncelle'], { oncelik: 20 });
  await yasakla(yuksek, { eylem: 'guncelle', oncelik: 10 });
  const esit = await kisiKur(5);
  await izinVer(esit, ['guncelle'], { oncelik: 10 });
  await yasakla(esit, { eylem: 'guncelle', oncelik: 10 });
  const hedef = await hedefKur(SERBEST);

  await guncelle(yuksek, hedef, { gorunenAd: 'Yeni Ad' });
  expect((await hedefSatiri(hedef))?.gorunen_ad).toBe('Yeni Ad');

  await expect(
    guncelle(esit, hedef, { gorunenAd: 'Başka Ad' }),
  ).rejects.toMatchObject({ kod: 'yetki_yok' });
  expect((await hedefSatiri(hedef))?.gorunen_ad).toBe('Yeni Ad');
  expect(await notSayisi(hedef)).toBe(1);
});

describe('d) düz güncelleme', () => {
  it('yazılan alanlardan birini kapatan kolon yasağı adayı eler; kapatmadığı alanın yazması geçer', async () => {
    const kisi = await kisiKur(6);
    await izinVer(kisi, ['guncelle']);
    await yasakla(kisi, { eylem: 'guncelle', kolonlar: ['telefon'] });
    const hedef = await hedefKur(SERBEST);

    await expect(
      guncelle(kisi, hedef, { gorunenAd: 'Yeni Ad', telefon: '5550003' }),
    ).rejects.toMatchObject({ kod: 'yetki_yok' });
    expect(await hedefSatiri(hedef)).toMatchObject({
      gorunen_ad: SERBEST,
      telefon: null,
    });
    expect(await notSayisi(hedef)).toBe(0);

    await guncelle(kisi, hedef, { gorunenAd: 'Yeni Ad' });
    expect((await hedefSatiri(hedef))?.gorunen_ad).toBe('Yeni Ad');
  });

  it('yeni hâli yasağın içine sokan güncelleme geri alınır: satır eski hâlinde, not yok', async () => {
    const kisi = await kisiKur(7);
    await izinVer(kisi, ['guncelle']);
    const yasak = await yasakla(kisi, { eylem: 'guncelle', sart: YASAKLI_AD });
    const hedef = await hedefKur(SERBEST);

    await expect(
      guncelle(kisi, hedef, { gorunenAd: YASAKLI }),
    ).rejects.toMatchObject({ kod: 'yetki_yok', kararVerenYasakId: yasak });
    expect((await hedefSatiri(hedef))?.gorunen_ad).toBe(SERBEST);
    expect(await notSayisi(hedef)).toBe(0);
    // Yazma deyimi gitmiş, yeni hâl aynı işlemde sınanmıştır.
    expect(
      sorgular.filter((s) =>
        s.startsWith('UPDATE "public"."kullanici" SET "gorunen_ad"'),
      ),
    ).toHaveLength(1);
  });

  it('niyet eyleminde yeni hâl sınanmaz: kaydı yasağın içine sokan niyet geçer; önceki hâli yasağın içinde olan niyet yetki yok alır', async () => {
    const kisi = await kisiKur(8);
    await izinVer(kisi, ['pasife_al']);
    await yasakla(kisi, { eylem: 'pasife_al', sart: YASAKLI_AD });
    const hedef = await hedefKur(SERBEST);

    await pasifeAl(kisi, hedef, { gorunenAd: YASAKLI });
    expect(await hedefSatiri(hedef)).toMatchObject({
      gorunen_ad: YASAKLI,
      pasif_zamani: expect.any(Date) as unknown,
    });

    await expect(
      pasifeAl(kisi, hedef, { gorunenAd: SERBEST }),
    ).rejects.toMatchObject({ kod: 'yetki_yok' });
    expect((await hedefSatiri(hedef))?.gorunen_ad).toBe(YASAKLI);
    expect(await notSayisi(hedef)).toBe(1);
  });

  it('silmede yeni hâl sınanmaz: silme deyiminden sonra kayıt yeniden okunmaz', async () => {
    const kisi = await kisiKur(9);
    await izinVer(kisi, ['sil']);
    await yasakla(kisi, { eylem: 'sil', sart: YASAKLI_AD });
    const hedef = await hedefKur(SERBEST);

    await sil(kisi, hedef);

    expect(await hedefSatiri(hedef)).toBeUndefined();
    const silme = sorgular.findIndex((s) =>
      s.startsWith('DELETE FROM "public"."kullanici"'),
    );
    expect(silme).toBeGreaterThan(0);
    expect(
      sorgular.slice(silme + 1).filter((s) => s.includes('"kullanici"')),
    ).toEqual([]);
  });
});

it('e) oluşturma: şartı yazılan satırı tutan yasak yetki yok verir ve satır kalmaz; tutmayan satır yazılır', async () => {
  const kisi = await kisiKur(10);
  await izinVer(kisi, ['olustur']);
  const yasak = await yasakla(kisi, { eylem: 'olustur', sart: YASAKLI_AD });
  const sayi = async (ad: string): Promise<number> =>
    (
      await tekSatir<{ sayi: number }>(
        'select count(*)::int as sayi from kullanici where gorunen_ad = $1',
        [ad],
      )
    ).sayi;
  const oncekiYasakli = await sayi(YASAKLI);

  await expect(olustur(kisi, YASAKLI)).rejects.toMatchObject({
    kod: 'yetki_yok',
    kararVerenYasakId: yasak,
  });
  expect(await sayi(YASAKLI)).toBe(oncekiYasakli);
  expect(
    sorgular.filter((s) => s.startsWith('INSERT INTO "public"."outbox_iz"')),
  ).toEqual([]);

  const id = await olustur(kisi, 'Yeni Kişi');
  expect((await hedefSatiri(id))?.gorunen_ad).toBe('Yeni Kişi');
  expect(await notSayisi(id)).toBe(1);
});

it('f) silme yasağı: yasağın tuttuğu kaydın silinmesi yetki yok alır ve kayıt kalır; tutmadığı kayıt silinir', async () => {
  const kisi = await kisiKur(11);
  await izinVer(kisi, ['sil']);
  const yasak = await yasakla(kisi, { eylem: 'sil', sart: YASAKLI_AD });
  const yasakli = await hedefKur(YASAKLI);
  const serbest = await hedefKur(SERBEST);

  await expect(sil(kisi, yasakli)).rejects.toMatchObject({
    kod: 'yetki_yok',
    kararVerenYasakId: yasak,
  });
  expect((await hedefSatiri(yasakli))?.gorunen_ad).toBe(YASAKLI);
  expect(await notSayisi(yasakli)).toBe(0);

  await sil(kisi, serbest);
  expect(await hedefSatiri(serbest)).toBeUndefined();
});

it('g) bozuk yasak: kolonlarından biri şemada olmayan yasak izni tümden kapatır; yazma yetki yok alır', async () => {
  const kisi = await kisiKur(12);
  await izinVer(kisi, ['guncelle']);
  const yasak = await yasakla(kisi, {
    eylem: 'guncelle',
    kolonlar: ['gorunenAd', 'eskiKolon'],
  });
  const hedef = await hedefKur(SERBEST);

  // Yazılan alan yasağın listesinde değildir; bozuk yasak bütün kolonları kapatır.
  await expect(
    guncelle(kisi, hedef, { telefon: '5550004' }),
  ).rejects.toMatchObject({ kod: 'yetki_yok', kararVerenYasakId: yasak });
  expect((await hedefSatiri(hedef))?.telefon).toBeNull();
  expect(await notSayisi(hedef)).toBe(0);
});

describe('i) karar veren yasak', () => {
  it('reddin iç bilgisinde karar veren yasağın kimliği vardır: yüksek öncelikli olan, eşitlikte eski olan', async () => {
    const yuksek = await kisiKur(13);
    await izinVer(yuksek, ['guncelle']);
    await yasakla(yuksek, { eylem: 'guncelle', oncelik: 10 });
    const yuksekYasak = await yasakla(yuksek, {
      eylem: 'guncelle',
      oncelik: 20,
    });
    const esit = await kisiKur(14);
    await izinVer(esit, ['guncelle']);
    const eskiYasak = await yasakla(esit, { eylem: 'guncelle', oncelik: 10 });
    await yasakla(esit, { eylem: 'guncelle', oncelik: 10 });
    const hedef = await hedefKur(SERBEST);

    const ret = (kisi: Kisi): Promise<unknown> =>
      guncelle(kisi, hedef, { gorunenAd: 'Yeni Ad' }).then(
        () => undefined,
        (hata: unknown) => hata,
      );
    const birinci = await ret(yuksek);
    expect(birinci).toBeInstanceOf(YasakReddi);
    expect(birinci).toMatchObject({
      kod: 'yetki_yok',
      kararVerenYasakId: yuksekYasak,
    });
    expect(await ret(esit)).toMatchObject({
      kod: 'yetki_yok',
      kararVerenYasakId: eskiYasak,
    });
  });

  it('karar veren yasak cevap gövdesinde yoktur', async () => {
    const kisi = await kisiKur(15);
    await izinVer(kisi, ['kapat', 'oku'], { kaynak: 'Oturum' });
    const yasaklar = [
      await yasakla(kisi, { kaynak: 'Oturum', eylem: 'kapat', oncelik: 10 }),
      await yasakla(kisi, { kaynak: 'Oturum', eylem: 'kapat', oncelik: 20 }),
    ];
    const oturum = await oturumAc(kisi.id, 151);

    const cevap = await post(kisi, `/kimlik/oturum/${oturum}/kapat`);

    expect(cevap.status).toBe(403);
    expect(cevap.body).toEqual(RET_GOVDESI);
    for (const yasak of yasaklar) {
      expect(cevap.text).not.toContain(yasak);
    }
  });
});

it('j) yasağı olmayan kişinin yazmasında sorgu sayısı bu karttan öncekiyle aynıdır', async () => {
  const kisi = await kisiKur(16);
  await izinVer(kisi, ['guncelle', 'pasife_al', 'olustur', 'sil']);
  const hedef = await hedefKur(SERBEST);
  const sayilar: Record<string, number> = {};

  await guncelle(kisi, hedef, { gorunenAd: 'Yeni Ad' });
  sayilar['guncelle'] = sorgular.length;
  await pasifeAl(kisi, hedef);
  sayilar['niyet'] = sorgular.length;
  const yeni = await olustur(kisi, 'Yeni Kişi');
  sayilar['olustur'] = sorgular.length;
  await sil(kisi, yeni);
  sayilar['sil'] = sorgular.length;

  expect(sayilar).toEqual(ONCEKI_SORGU);
});

// Testin sonunda (Kök, Temel) ve (Kök, SuperAdmin) kümelerinde Oturum:kapat yasağı kalır; bu dosyada
// sonra oturum kapatılmaz.
it('h) muafiyet: kök yöneticinin yazması aynı yasaklarla geçer; başka rolün sistem satırı kapanır', async () => {
  const rolu = async (kod: string): Promise<string> =>
    (await tekSatir<{ id: string }>('select id from rol where kod = $1', [kod]))
      .id;
  const kokYoneticiId = (
    await tekSatir<{ id: string }>(
      "select id from kullanici where kullanici_adi = 'superadmin'",
    )
  ).id;
  const kokYonetici: Kisi = {
    id: kokYoneticiId,
    grup: kokGrup,
    oturum: await oturumAc(kokYoneticiId, 170),
  };
  // Yalnız (Kök, Temel) üyeliği olan kişi: kendi oturumlarını temel rolün sistem satırıyla kapatır.
  const temelId = kimlik('90', 17);
  await gozlemci.query(
    "insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, 'kisi17', 'kisi17')",
    [temelId],
  );
  await gozlemci.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
    [kimlik('93', 170), temelId, kokGrup, await rolu('temel')],
  );
  const temel: Kisi = {
    id: temelId,
    grup: kokGrup,
    oturum: await oturumAc(temelId, 171),
  };
  const [birinci, ikinci, ucuncu] = [
    await oturumAc(temelId, 172),
    await oturumAc(temelId, 173),
    await oturumAc(temelId, 174),
  ];
  const kapali = async (id: string): Promise<boolean> =>
    (
      await tekSatir<{ kapali: boolean }>(
        'select kapatilma_zamani is not null as kapali from oturum where id = $1',
        [id],
      )
    ).kapali;

  // Yasaktan önce: kişi kendi oturumunu kapatır.
  expect((await post(temel, `/kimlik/oturum/${birinci}/kapat`)).status).toBe(
    204,
  );

  // Kök yöneticinin üyesi olduğu iki kümeye koşulsuz, öncelik 100 Oturum:kapat yasağı.
  for (const rol of [await rolu('temel'), await rolu('superadmin')]) {
    await yetenekEkle({
      grup: kokGrup,
      rol,
      kaynak: 'Oturum',
      eylem: 'kapat',
      giremez: true,
      oncelik: 100,
    });
  }
  await surumuArtir(kokYonetici.id, temel.id);

  expect(
    (await post(kokYonetici, `/kimlik/oturum/${ikinci}/kapat`)).status,
  ).toBe(204);
  expect(await kapali(ikinci)).toBe(true);
  const ret = await post(temel, `/kimlik/oturum/${ucuncu}/kapat`);
  expect(ret.status).toBe(403);
  expect(ret.body).toEqual(RET_GOVDESI);
  expect(await kapali(ucuncu)).toBe(false);
});
