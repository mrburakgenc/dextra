// Yazma motoru (2/2): yasak ve öncelik taşıyan yetenekte ikinci izin (GV-154; TS-008 "Yapı" › "Yönetim,
// izinler ve teşhis", AK-4; kapanan AU-8 ve AU-18; KU-012). Koşturma:
//   pnpm -C backend test:e2e test/yetki-yasak-ikinci-izin.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; başlangıcı tohum
// koşucusu kurar. Kişilerin yetenekleri ve yazılan hedef yetenek satırları veritabanına doğrudan yazılır;
// yasak yazımını kapatan geçici kısıt test yardımcısıyla düşürülür. Hedef satırlar üyesi olmayan bir
// (grup, rol) kümesine bağlıdır: kimsenin yetkisini değiştirmez. Silme uçtan (HTTP) sınanır. Yasak ve
// sıfırdan farklı öncelik yazımı yedinci aşamaya kadar kapalıdır ve ret yetenek yazımında (işleyicinin
// satırı kurduğu yerde) durur; bu yüzden oluşturma ve yenileme ucun altından, yetenek yazma
// repository'sinden (PrismaYetenekYazmaRepo) sınanır: kapalılığı aşmadan kurulabilen en üst nokta odur.
// Repository, kişinin uygulamadaki derlenmiş yetkisiyle, sorgu olaylarını sayan ayrı bir Prisma istemcisi
// ve Unit of Work üzerinden çağrılır; yenileme işleyicinin sırasıyla (eski satırın kapatılması, sonra yeni
// satırın yazılması) tek run'da koşar. Her test kendi kişisiyle çalışır, çünkü yetki belleği süreç boyunca
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
import type {
  YeniYetenek,
  YetenekEtkisi,
} from '../src/features/kimlik/yetenek/domain/entities/yetenek.entity.js';
import { PrismaYetenekYazmaRepo } from '../src/features/kimlik/yetenek/infrastructure/repositories/yetenek-yazma.prisma-repository.js';
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
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const IP = '203.0.113.34';
const TARAYICI = 'Mozilla/5.0 ikinci izin deneme';

// Kimlikler: kişiler 90…, gruplar 91…, roller 92…, üyelikler 93…, yetenekler 94…, oturumlar 95….
const YONETICI = '92000000-0000-4000-8000-000000000001';
const STAJYER = '92000000-0000-4000-8000-000000000002';
// Hedef satırların bağlandığı rol; kimse bu rolü taşımaz.
const HEDEF_ROL = '92000000-0000-4000-8000-000000000003';

const OLUSTURMA_ISI = 'kimlik:yetenek-olustur';
const YENILEME_ISI = 'kimlik:yetenek-yenile';
const SILME_ISI = 'kimlik:yetenek-sil';

// Yasakla izni olmayan kişinin düz (yasak değil, öncelik 0) yetenek yazmasında bu karttan önceki motorun
// attığı sorgu sayıları (ölçüldü: bu dosya motor değişmeden önce koşturuldu).
const ONCEKI_SORGU = {
  olustur: 4,
  yenile: 8,
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
let repo: PrismaYetenekYazmaRepo;
const sorgular: string[] = [];
let kokGrup: string;
let hedefGrup: string;
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

async function izinId(kaynak: string, eylem: string): Promise<string> {
  return (
    await tekSatir<{ id: string }>(
      'select id from izin where kaynak = $1 and eylem = $2',
      [kaynak, eylem],
    )
  ).id;
}

interface Kisi {
  readonly id: string;
  readonly grup: string;
  readonly oturum: string;
}

// Kişi: kendi grubu (kökün altında), oturumu ve grubunda Yönetici ile Stajyer üyelikleri.
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
    [id, `kisi${String(no)}`],
  );
  for (const [sira, rol] of [YONETICI, STAJYER].entries()) {
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

interface YetenekSecenekleri {
  readonly grup: string;
  readonly rol: string;
  readonly kaynak: string;
  readonly eylem: string;
  readonly giremez?: boolean;
  readonly oncelik?: number;
}

// Bütün kayıtlar ve bütün kolonlar için yetenek.
async function yetenekEkle({
  grup,
  rol,
  kaynak,
  eylem,
  giremez = false,
  oncelik = 0,
}: YetenekSecenekleri): Promise<string> {
  yetenekNo += 1;
  const id = kimlik('94', yetenekNo);
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, butun_kayitlar, butun_kolonlar, giremez,
                          oncelik, koken)
     values ($1, $2, $3, $4, true, true, $5, $6, 'yonetici')`,
    [id, grup, rol, await izinId(kaynak, eylem), giremez, oncelik],
  );
  return id;
}

// Yönetici'ye Yetenek kaynağında verilen izinler.
async function izinVer(kisi: Kisi, eylemler: readonly string[]): Promise<void> {
  for (const eylem of eylemler) {
    await yetenekEkle({
      grup: kisi.grup,
      rol: YONETICI,
      kaynak: 'Yetenek',
      eylem,
    });
  }
}

// Yazılan hedef: üyesi olmayan kümede Kullanici:oku yeteneği.
function hedefEkle(etki: Partial<YetenekEtkisi> = {}): Promise<string> {
  return yetenekEkle({
    grup: hedefGrup,
    rol: HEDEF_ROL,
    kaynak: 'Kullanici',
    eylem: 'oku',
    ...etki,
  });
}

async function hedefSatiri(): Promise<YeniYetenek> {
  return {
    grupId: hedefGrup,
    rolId: HEDEF_ROL,
    izinId: await izinId('Kullanici', 'oku'),
    sart: null,
    butunKayitlar: true,
    butunBirimler: false,
    kolonlar: null,
    butunKolonlar: true,
  };
}

interface SaklananYetenek {
  silinmis: boolean;
  giremez: boolean;
  oncelik: number;
}

async function saklanan(id: string): Promise<SaklananYetenek | undefined> {
  return (
    await gozlemci.query<SaklananYetenek>(
      `select silinme_zamani is not null as silinmis, giremez, oncelik from yetenek where id = $1`,
      [id],
    )
  ).rows[0];
}

// Hedef kümedeki satır sayısı.
async function hedefSayisi(): Promise<number> {
  return (
    await tekSatir<{ sayi: number }>(
      'select count(*)::int as sayi from yetenek where grup_id = $1',
      [hedefGrup],
    )
  ).sayi;
}

async function sil(kisi: Kisi, id: string): Promise<request.Response> {
  const zaman = Date.now();
  const belirtec = await new BelirtecServisi(process.env).erisimBelirteciUret({
    kullaniciId: kisi.id,
    oturumId: kisi.oturum,
  });
  return request(uygulama().getHttpServer())
    .delete(`/kimlik/yetenek/${id}`)
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

async function olustur(kisi: Kisi, etki: YetenekEtkisi): Promise<string> {
  const satir = await hedefSatiri();
  return yaz(kisi, (islem) =>
    repo.olustur(islem, OLUSTURMA_ISI, { ...satir, ...etki }),
  );
}

// Yenileme işleyicisinin sırası: eski satır kapatılır, yeni satır etkisi eski satırdan, önceliği verilenden
// yazılır.
async function yenile(
  kisi: Kisi,
  id: string,
  oncelik: number,
): Promise<string> {
  const satir = await hedefSatiri();
  const eski = await saklanan(id);
  if (eski === undefined) {
    throw new Error(`yetenek yok: ${id}`);
  }
  return yaz(kisi, async (islem) => {
    await repo.kapat(islem, YENILEME_ISI, id);
    return repo.olustur(islem, YENILEME_ISI, {
      ...satir,
      giremez: eski.giremez,
      oncelik,
      yerineGectigiId: id,
    });
  });
}

async function yerineGecen(id: string): Promise<number> {
  return (
    await tekSatir<{ sayi: number }>(
      'select count(*)::int as sayi from yetenek where yerine_gectigi_id = $1',
      [id],
    )
  ).sayi;
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
    hedefGrup = kimlik('91', 999);
    await gozlemci.query(
      "insert into grup (id, ust_grup_id, ad) values ($1, $2, 'Hedef')",
      [hedefGrup, kokGrup],
    );
    await gozlemci.query(
      "insert into rol (id, ad) values ($1, 'Yönetici'), ($2, 'Stajyer'), ($3, 'Hedef')",
      [YONETICI, STAJYER, HEDEF_ROL],
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
    repo = new PrismaYetenekYazmaRepo(
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

describe('a) yasak satırının silinmesi (uçtan)', () => {
  it('yasakla izni olmayan, silme izni olan kişi yetki yok alır ve satır durur; izni olan siler', async () => {
    const izinsiz = await kisiKur(1);
    await izinVer(izinsiz, ['oku', 'sil']);
    const izinli = await kisiKur(2);
    await izinVer(izinli, ['oku', 'sil', 'yasakla']);
    const hedef = await hedefEkle({ giremez: true });

    const ret = await sil(izinsiz, hedef);
    expect(ret.status).toBe(403);
    expect(ret.body).toEqual(RET_GOVDESI);
    expect(await saklanan(hedef)).toMatchObject({ silinmis: false });

    expect((await sil(izinli, hedef)).status).toBe(204);
    expect(await saklanan(hedef)).toMatchObject({ silinmis: true });
  });
});

describe('b) önceliği sıfırdan farklı izin satırının silinmesi (uçtan)', () => {
  it('yasakla izni olmayan, silme izni olan kişi yetki yok alır ve satır durur; izni olan siler', async () => {
    const izinsiz = await kisiKur(3);
    await izinVer(izinsiz, ['oku', 'sil']);
    const izinli = await kisiKur(4);
    await izinVer(izinli, ['oku', 'sil', 'yasakla']);
    const hedef = await hedefEkle({ oncelik: 5 });

    const ret = await sil(izinsiz, hedef);
    expect(ret.status).toBe(403);
    expect(ret.body).toEqual(RET_GOVDESI);
    expect(await saklanan(hedef)).toMatchObject({ silinmis: false });

    expect((await sil(izinli, hedef)).status).toBe(204);
    expect(await saklanan(hedef)).toMatchObject({ silinmis: true });
  });
});

describe("c) oluşturma ve yenileme (ucun altından: yetenek yazma repository'si)", () => {
  it('oluşturma: yasak ya da öncelikli satırı izni olmayan yetki yok alır ve satır yazılmaz; izni olan yazar', async () => {
    const izinsiz = await kisiKur(5);
    await izinVer(izinsiz, ['olustur']);
    const izinli = await kisiKur(6);
    await izinVer(izinli, ['olustur', 'yasakla']);

    for (const etki of [
      { giremez: true, oncelik: 0 },
      { giremez: false, oncelik: 5 },
    ]) {
      const once = await hedefSayisi();
      await expect(olustur(izinsiz, etki)).rejects.toMatchObject({
        kod: 'yetki_yok',
      });
      expect(await hedefSayisi()).toBe(once);

      const id = await olustur(izinli, etki);
      expect(await saklanan(id)).toEqual({ silinmis: false, ...etki });
    }
  });

  it('yenileme: eski satırı yasak olanı yeni önceliği 0 olsa da izni olmayan yenileyemez (eski satır açık kalır, yeni satır yazılmaz); izni olan yeniler', async () => {
    const izinsiz = await kisiKur(7);
    await izinVer(izinsiz, ['yenile', 'olustur']);
    const izinli = await kisiKur(8);
    await izinVer(izinli, ['yenile', 'olustur', 'yasakla']);
    const eski = await hedefEkle({ giremez: true, oncelik: 10 });

    await expect(yenile(izinsiz, eski, 0)).rejects.toMatchObject({
      kod: 'yetki_yok',
    });
    expect(await saklanan(eski)).toMatchObject({ silinmis: false });
    expect(await yerineGecen(eski)).toBe(0);

    const yeni = await yenile(izinli, eski, 0);
    expect(await saklanan(eski)).toMatchObject({ silinmis: true });
    expect(await saklanan(yeni)).toEqual({
      silinmis: false,
      giremez: true,
      oncelik: 0,
    });
  });

  it('yenileme: izin aranır eski satırın önceliği sıfırdan farklıysa (yeni satır düz olsa da) ve yeni öncelik sıfırdan farklıysa', async () => {
    const izinsiz = await kisiKur(9);
    await izinVer(izinsiz, ['yenile', 'olustur']);
    const izinli = await kisiKur(10);
    await izinVer(izinli, ['yenile', 'olustur', 'yasakla']);
    const oncelikli = await hedefEkle({ oncelik: 5 });
    const duz = await hedefEkle();

    for (const [eski, oncelik] of [
      [oncelikli, 0],
      [duz, 7],
    ] as const) {
      await expect(yenile(izinsiz, eski, oncelik)).rejects.toMatchObject({
        kod: 'yetki_yok',
      });
      expect(await saklanan(eski)).toMatchObject({ silinmis: false });
      expect(await yerineGecen(eski)).toBe(0);

      const yeni = await yenile(izinli, eski, oncelik);
      expect(await saklanan(eski)).toMatchObject({ silinmis: true });
      expect(await saklanan(yeni)).toEqual({
        silinmis: false,
        giremez: false,
        oncelik,
      });
    }
  });

  it('ikinci izne kendi yasakları uygulanır: Yetenek:yasakla yasağı (korunan kaynağın yazma eylemi olduğu için bozuk derlenir) izni kapatır; ret karar veren yasağı taşır', async () => {
    const kisi = await kisiKur(11);
    await izinVer(kisi, ['sil', 'yasakla']);
    const yasak = await yetenekEkle({
      grup: kisi.grup,
      rol: STAJYER,
      kaynak: 'Yetenek',
      eylem: 'yasakla',
      giremez: true,
    });
    const hedef = await hedefEkle({ giremez: true });

    const hata = await yaz(kisi, (islem) =>
      repo.sil(islem, SILME_ISI, hedef),
    ).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(hata).toBeInstanceOf(YasakReddi);
    expect(hata).toMatchObject({ kod: 'yetki_yok', kararVerenYasakId: yasak });
    expect(await saklanan(hedef)).toMatchObject({ silinmis: false });
  });
});

describe('d) öncelik 0 ve yasak olmayan yetenekte izin aranmaz', () => {
  it('yasakla izni olmayan kişi düz satırı uçtan siler', async () => {
    const kisi = await kisiKur(12);
    await izinVer(kisi, ['oku', 'sil']);
    const hedef = await hedefEkle();

    expect((await sil(kisi, hedef)).status).toBe(204);
    expect(await saklanan(hedef)).toMatchObject({ silinmis: true });
  });

  it('yasakla izni olmayan kişinin düz yetenek yazmasında sorgu sayısı bu karttan öncekiyle aynıdır', async () => {
    const kisi = await kisiKur(13);
    await izinVer(kisi, ['olustur', 'yenile', 'sil']);
    const sayilar: Record<string, number> = {};

    const yeni = await olustur(kisi, { giremez: false, oncelik: 0 });
    sayilar['olustur'] = sorgular.length;
    const yenilenen = await yenile(kisi, yeni, 0);
    sayilar['yenile'] = sorgular.length;
    await yaz(kisi, (islem) => repo.sil(islem, SILME_ISI, yenilenen));
    sayilar['sil'] = sorgular.length;

    expect(sayilar).toEqual(ONCEKI_SORGU);
    expect(await saklanan(yenilenen)).toMatchObject({ silinmis: true });
  });
});
