// Erişim kaydı: tablolar ve salt okuma isteklerinin sonunda iz veritabanına yazım (GV-035; KR-013
// Seçim 2 ve 6; KR-011 Seçim 9; TS-002 AK-10; TS-003 Seçenek 1). Koşturma:
//   pnpm -C backend test:e2e test/erisim-kaydi.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ve sınama uçlarıyla, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır.
// Başlangıcı tohum koşucusu kurar (izin kataloğu); grup, rol, kullanıcı, üyelik, yetenek ve oturum
// satırları SQL ile yazılır. Sınama uçları okumayı yetki kapısından yapar; repository'leri testte
// kaydedilir. İz veritabanı ayrı bir bağlantıdan (iz gözlemcisi) okunur. Yazma yapan istekte kaydın
// yazılmaması GV-061'de eklendi (TS-002 AK-40).
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { setTimeout as uyu } from 'node:timers/promises';
import {
  Controller,
  Get,
  Inject,
  type INestApplication,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { DatabaseModule } from '../src/shared/database/database.module.js';
import { Registrar, RepoBelirteci } from '../src/shared/database/registrar.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { BelirtecServisi } from '../src/shared/guvenlik/application/belirtec.js';
import {
  HerkeseAcik,
  Izin,
} from '../src/shared/guvenlik/application/isaretler.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/application/istemci-adresi-imzasi.js';
import { ISTEK_KIMLIGI_BASLIGI } from '../src/shared/http/istek-baglami.js';
import { TohumKosucusu } from '../src/shared/tohum/tohum-kosucusu.js';
import type { Kayit } from '../src/shared/yetki/domain/okuma-tipleri.js';
import { OkumaKapisi } from '../src/shared/yetki/infrastructure/okuma-kapisi.js';
import { prismaKaynakKatalogu } from '../src/shared/yetki/infrastructure/prisma-kaynak-katalogu.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const IZ_GOCLERI = `${BACKEND}prisma/iz/migrations`;
// Var olan iz göçünün bu görevden önceki özeti (sha256); dosya değişirse test kırılır.
const ESKI_GOC = '20261124165338_degisiklik_kaydi';
const ESKI_GOC_OZETI =
  '68da0f26d9d6a3465627a00b89bc7b83c89df4c4861f42fec08d3b85be402683';
const YENI_GOC = '20261125120000_erisim_kaydi';

const IP = '203.0.113.35';
const TARAYICI = 'Mozilla/5.0 erisim deneme';

// Kimlikler: kişiler 8…, gruplar 81…, roller 82…, üyelikler 83…, yetenekler 84…, oturumlar 85….
const ALI = '80000000-0000-4000-8000-000000000001';
const VELI = '80000000-0000-4000-8000-000000000002';
const CEMIL = '80000000-0000-4000-8000-000000000003';
const DENIZ = '80000000-0000-4000-8000-000000000004';
const GRUP_A = '81000000-0000-4000-8000-00000000000a';
const GRUP_B = '81000000-0000-4000-8000-00000000000b';
const ROL_1 = '82000000-0000-4000-8000-000000000001';
const ROL_2 = '82000000-0000-4000-8000-000000000002';
const U_ALI_A = '83000000-0000-4000-8000-000000000001';
const U_ALI_B = '83000000-0000-4000-8000-000000000002';
// (A, Rol 1) bütün kişileri bütün kolonlarıyla, (B, Rol 2) yalnız görünen adla okur; ikisi de okumaya
// katılır.
const Y_A = '84000000-0000-4000-8000-000000000001';
const Y_B = '84000000-0000-4000-8000-000000000002';
const OT_ALI = '85000000-0000-4000-8000-000000000001';

// Listede dönen kişiler; isteyen (Ali) bunların arasında değildir.
const LISTEDEKILER = [VELI, CEMIL, DENIZ];
// Okuyup yazan ucun Deniz'in görünen adına yazdığı değer.
const YAZILAN_AD = 'deniz yazildi';

const BEKLENMEYEN_HATA = {
  kod: 'beklenmeyen_hata',
  ileti: 'Beklenmeyen bir hata oluştu',
  ayrinti: null,
};

interface SinamaOkuma {
  liste(): Promise<Kayit[]>;
  tek(id: string): Promise<Kayit>;
}

interface SinamaTam extends SinamaOkuma {
  adYaz(id: string, ad: string): Promise<void>;
}

const SINAMA_REPO = new RepoBelirteci<SinamaOkuma, SinamaTam>(
  'ErisimSinamaRepo',
);
const kapi = new OkumaKapisi(prismaKaynakKatalogu(['Kullanici']));

// Son okuma ucunun okuduğu kayıt sayısı: hata dönen istekte verinin okunduğunu gösterir.
let sonOkunan = -1;

@Controller('erisim-sinama')
class ErisimSinamaUclari {
  constructor(@Inject(UnitOfWork) private readonly uow: UnitOfWork) {}

  @Get('kullanicilar')
  @Izin('Kullanici', 'oku')
  async liste(): Promise<Kayit[]> {
    const kayitlar = await this.uow.read(SINAMA_REPO).liste();
    sonOkunan = kayitlar.length;
    return kayitlar;
  }

  @Get('kullanicilar/:id')
  @Izin('Kullanici', 'oku')
  tek(@Param('id') id: string): Promise<Kayit> {
    return this.uow.read(SINAMA_REPO).tek(id);
  }

  // Ölçütü HTTP yönteminden ayırmak için: yalnız okuyan POST.
  @Post('kullanicilar/ara')
  @Izin('Kullanici', 'oku')
  ara(): Promise<Kayit[]> {
    return this.uow.read(SINAMA_REPO).liste();
  }

  // Aynı istekte yetki kapısından okur, sonra run ile yazar.
  @Post('kullanicilar/oku-yaz')
  @Izin('Kullanici', 'oku')
  async okuYaz(): Promise<Kayit[]> {
    const kayitlar = await this.uow.read(SINAMA_REPO).liste();
    await this.uow.run((islem) =>
      islem.repo(SINAMA_REPO).adYaz(DENIZ, YAZILAN_AD),
    );
    return kayitlar;
  }

  // Oturum ister ama yetki kapısından okumaz.
  @Get('oturumlu')
  @Izin('Kullanici', 'oku')
  oturumlu(): { durum: string } {
    return { durum: 'oturumlu' };
  }

  @Get('acik')
  @HerkeseAcik()
  acik(): { durum: string } {
    return { durum: 'acik' };
  }
}

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let izGozlemci: pg.Client;
let gozlemciPidleri: number[];

function uygulama(): INestApplication<App> {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app;
}

async function pid(istemci: pg.Client): Promise<number> {
  return (
    (await istemci.query<{ pid: number }>('select pg_backend_pid() as pid'))
      .rows[0]?.pid ?? -1
  );
}

async function tekDeger<T>(
  istemci: pg.Client,
  sql: string,
  degerler: unknown[] = [],
): Promise<T> {
  const [satir] = (
    await istemci.query<{ deger: T }>(sql, degerler)
  ).rows;
  if (satir === undefined) {
    throw new Error(`satır yok: ${sql}`);
  }
  return satir.deger;
}

// Geçerli bir isteğin başlıkları: erişim belirteci ve aracı katmanın imzaladığı istemci adresi.
async function basliklar(
  kullaniciId: string,
  oturumId: string,
): Promise<Record<string, string>> {
  const zaman = Date.now();
  const belirtec = await new BelirtecServisi(process.env).erisimBelirteciUret({
    kullaniciId,
    oturumId,
  });
  return {
    authorization: `Bearer ${belirtec}`,
    [ISTEMCI_BASLIKLARI.adres]: IP,
    [ISTEMCI_BASLIKLARI.tarayici]: TARAYICI,
    [ISTEMCI_BASLIKLARI.zaman]: String(zaman),
    [ISTEMCI_BASLIKLARI.imza]: istemciImzasiUret(
      process.env[ARACI_KATMAN_SIRRI_DEGISKENI] ?? '',
      { adres: IP, tarayici: TARAYICI, zaman },
    ),
  };
}

async function aliIle(
  yontem: 'get' | 'post',
  yol: string,
): Promise<request.Response> {
  const sunucu = request(uygulama().getHttpServer());
  const istek = yontem === 'get' ? sunucu.get(yol) : sunucu.post(yol);
  return istek.set(await basliklar(ALI, OT_ALI));
}

function istekKimligi(cevap: request.Response): string {
  return String(cevap.headers[ISTEK_KIMLIGI_BASLIGI]);
}

interface ErisimKaydiSatiri {
  id: string;
  istek_id: string;
  kullanici_id: string;
  is_adi: string;
  erisilen_yer: string;
  kayit_sayisi: number;
}

async function erisimKayitlari(istekId: string): Promise<ErisimKaydiSatiri[]> {
  return (
    await izGozlemci.query<ErisimKaydiSatiri>(
      `select id, istek_id, kullanici_id, is_adi, erisilen_yer, kayit_sayisi
         from erisim_kaydi where istek_id = $1`,
      [istekId],
    )
  ).rows;
}

async function baglantiKimlikleri(
  tablo: 'erisim_kaydi_yetenek' | 'erisim_kaydi_uyelik',
  kolon: 'yetenek_id' | 'uyelik_id',
  erisimKaydiId: string,
): Promise<string[]> {
  return (
    await izGozlemci.query<{ id: string }>(
      `select ${kolon} as id from ${tablo} where erisim_kaydi_id = $1 order by 1`,
      [erisimKaydiId],
    )
  ).rows.map((satir) => satir.id);
}

// Bir isteğin erişim kaydının ve bağlantı satırlarının bütün değerleri, metin olarak.
async function kaydinMetni(istekId: string): Promise<string> {
  return tekDeger<string>(
    izGozlemci,
    `select coalesce(json_agg(json_build_array(
              e, (select json_agg(y) from erisim_kaydi_yetenek y where y.erisim_kaydi_id = e.id),
              (select json_agg(u) from erisim_kaydi_uyelik u where u.erisim_kaydi_id = e.id)
            ))::text, '') as deger
       from erisim_kaydi e where e.istek_id = $1`,
    [istekId],
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

// Tohum göçü gerçek yoldan (izin kataloğu); kalan satırlar SQL ile.
async function baslangicKur(): Promise<void> {
  await uygulama().get(TohumKosucusu).kos();
  const kokGrup = await tekDeger<string>(
    gozlemci,
    'select id as deger from grup where ust_grup_id is null',
  );
  for (const grup of [GRUP_A, GRUP_B]) {
    await gozlemci.query(
      'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
      [grup, kokGrup, `Grup ${grup}`],
    );
  }
  await gozlemci.query(
    "insert into rol (id, ad) values ($1, 'Rol 1'), ($2, 'Rol 2')",
    [ROL_1, ROL_2],
  );
  for (const [id, ad] of [
    [ALI, 'ali'],
    [VELI, 'veli'],
    [CEMIL, 'cemil'],
    [DENIZ, 'deniz'],
  ] as const) {
    await gozlemci.query(
      'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
      [id, ad],
    );
  }
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(), $3, $4)`,
    [OT_ALI, ALI, IP, TARAYICI],
  );
  for (const [id, grup, rol] of [
    [U_ALI_A, GRUP_A, ROL_1],
    [U_ALI_B, GRUP_B, ROL_2],
  ] as const) {
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [id, ALI, grup, rol],
    );
  }
  const okumaIzni = await tekDeger<string>(
    gozlemci,
    "select id as deger from izin where kaynak = 'Kullanici' and eylem = 'oku'",
  );
  for (const [id, grup, rol, kolonlar] of [
    [Y_A, GRUP_A, ROL_1, null],
    [Y_B, GRUP_B, ROL_2, ['gorunenAd']],
  ] as const) {
    await gozlemci.query(
      `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                            butun_kolonlar, koken)
       values ($1, $2, $3, $4, null, true, $5, $5::text[] is null, 'yonetici')`,
      [id, grup, rol, okumaIzni, kolonlar],
    );
  }
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
      imports: [AppModule, DatabaseModule],
      controllers: [ErisimSinamaUclari],
    }).compile();
    modul.get(Registrar).register(SINAMA_REPO, (istemci) => ({
      liste: () =>
        kapi.liste(istemci, 'Kullanici', {
          kosul: [{ alan: 'id', islec: 'listede', deger: LISTEDEKILER }],
        }),
      tek: (id) => kapi.tek(istemci, 'Kullanici', id),
      adYaz: async (id, ad) => {
        await istemci.$executeRaw`update kullanici set gorunen_ad = ${ad} where id = ${id}::uuid`;
      },
    }));
    app = modul.createNestApplication();
    await app.init();
    await baslangicKur();
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
  // Uygulama kapanınca iki veritabanında da gözlemcilerden başka bağlantı kalmaz.
  const acikKalan = [
    await kalanBaglantiSayisi(gozlemci, databases.asil.name, gozlemciPidleri),
    await kalanBaglantiSayisi(gozlemci, databases.iz.name, gozlemciPidleri),
  ];
  await gozlemci.end();
  await izGozlemci.end();
  await databases.drop();
  expect(acikKalan).toEqual([0, 0]);
  expect(
    await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
  ).toEqual([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a) göç', () => {
  it('üç tablo kolonlarıyla hedefteki gibidir', async () => {
    const { rows } = await izGozlemci.query<{
      tablo: string;
      kolon: string;
      tur: string;
      bos: string;
      varsayilan: string | null;
    }>(
      `select table_name as tablo, column_name as kolon, data_type as tur, is_nullable as bos,
              column_default as varsayilan
         from information_schema.columns
        where table_schema = 'public'
          and table_name in ('erisim_kaydi', 'erisim_kaydi_yetenek', 'erisim_kaydi_uyelik')
        order by table_name, ordinal_position`,
    );
    const tz = 'timestamp with time zone';
    expect(rows.map((s) => [s.tablo, s.kolon, s.tur, s.bos, s.varsayilan])).toEqual([
      ['erisim_kaydi', 'id', 'uuid', 'NO', null],
      ['erisim_kaydi', 'istek_id', 'uuid', 'YES', null],
      ['erisim_kaydi', 'kullanici_id', 'uuid', 'NO', null],
      ['erisim_kaydi', 'is_adi', 'text', 'NO', null],
      ['erisim_kaydi', 'erisilen_yer', 'text', 'NO', null],
      ['erisim_kaydi', 'kayit_sayisi', 'integer', 'NO', null],
      ['erisim_kaydi', 'olusma_zamani', tz, 'NO', null],
      ['erisim_kaydi', 'yazilma_zamani', tz, 'NO', 'clock_timestamp()'],
      ['erisim_kaydi_uyelik', 'erisim_kaydi_id', 'uuid', 'NO', null],
      ['erisim_kaydi_uyelik', 'uyelik_id', 'uuid', 'NO', null],
      ['erisim_kaydi_yetenek', 'erisim_kaydi_id', 'uuid', 'NO', null],
      ['erisim_kaydi_yetenek', 'yetenek_id', 'uuid', 'NO', null],
    ]);
  });

  it('kısıtlar adları ve tanımlarıyla hedefteki gibidir; yabancı anahtar yalnız erisim_kaydi tablosunadır', async () => {
    const { rows } = await izGozlemci.query<{ ad: string; tanim: string }>(
      `select conname as ad, pg_get_constraintdef(oid) as tanim
         from pg_constraint
        where conrelid in ('erisim_kaydi'::regclass, 'erisim_kaydi_yetenek'::regclass,
                           'erisim_kaydi_uyelik'::regclass)
          and contype <> 'n'
        order by conname`,
    );
    const ya =
      'FOREIGN KEY (erisim_kaydi_id) REFERENCES erisim_kaydi(id) ON UPDATE CASCADE ON DELETE RESTRICT';
    expect(rows.map((s) => [s.ad, s.tanim])).toEqual([
      ['erisim_kaydi_ba', 'PRIMARY KEY (id)'],
      ['erisim_kaydi_uyelik_ba', 'PRIMARY KEY (erisim_kaydi_id, uyelik_id)'],
      ['erisim_kaydi_uyelik_erisim_kaydi_id_ya', ya],
      ['erisim_kaydi_yetenek_ba', 'PRIMARY KEY (erisim_kaydi_id, yetenek_id)'],
      ['erisim_kaydi_yetenek_erisim_kaydi_id_ya', ya],
    ]);
  });

  it('yeni göç kendi klasöründedir; var olan iz göçü değişmemiştir', async () => {
    const eski = await readFile(`${IZ_GOCLERI}/${ESKI_GOC}/migration.sql`);
    expect(createHash('sha256').update(eski).digest('hex')).toBe(
      ESKI_GOC_OZETI,
    );
    expect(
      await readFile(`${IZ_GOCLERI}/${YENI_GOC}/migration.sql`, 'utf8'),
    ).toContain('CREATE TABLE "erisim_kaydi"');
  });

  it('göçleri uygulanmış iz veritabanı ile iz şeması arasında Prisma fark görmez', async ({
    annotate,
  }) => {
    // --exit-code: fark yoksa 0, fark varsa 2 ile biter; 2 execFile'ı reddettirir.
    const { stdout } = await promisify(execFile)(
      `${BACKEND}node_modules/.bin/prisma`,
      [
        'migrate',
        'diff',
        '--config',
        'prisma.iz.config.ts',
        '--from-config-datasource',
        '--to-schema',
        'prisma/iz/schema.prisma',
        '--exit-code',
      ],
      {
        cwd: BACKEND,
        env: { ...process.env, IZ_DATABASE_URL: databases.iz.url },
      },
    );
    await annotate(`prisma migrate diff çıktısı: ${stdout.trim()}`);
  });
});

describe('b) oturumlu salt okuma isteği', () => {
  it('liste okumasından sonra kullanıcı, istek kimliği, işin adı, rota deseni ve kayıt sayısı doğru bir kayıt vardır; yetenek ve üyelikler bağlantı tablolarındadır', async () => {
    const cevap = await aliIle('get', '/erisim-sinama/kullanicilar?ara=gizli');

    expect(cevap.status).toBe(200);
    expect(cevap.body).toHaveLength(LISTEDEKILER.length);
    const [kayit, ...fazla] = await erisimKayitlari(istekKimligi(cevap));
    expect(fazla).toEqual([]);
    expect(kayit).toMatchObject({
      istek_id: istekKimligi(cevap),
      kullanici_id: ALI,
      is_adi: 'ErisimSinamaUclari.liste',
      erisilen_yer: '/erisim-sinama/kullanicilar',
      kayit_sayisi: LISTEDEKILER.length,
    });
    const id = kayit?.id ?? '';
    expect(
      await baglantiKimlikleri('erisim_kaydi_yetenek', 'yetenek_id', id),
    ).toEqual([Y_A, Y_B]);
    expect(
      await baglantiKimlikleri('erisim_kaydi_uyelik', 'uyelik_id', id),
    ).toEqual([U_ALI_A, U_ALI_B]);
  });

  it('tek kayıt okumasında erişilen yer rota desenidir: adresteki kimlik ve sorgu dizgesi yazılmaz', async () => {
    const cevap = await aliIle(
      'get',
      `/erisim-sinama/kullanicilar/${CEMIL}?iz=deneme`,
    );

    expect(cevap.status).toBe(200);
    expect(cevap.body).toMatchObject({ id: CEMIL });
    expect(await erisimKayitlari(istekKimligi(cevap))).toEqual([
      expect.objectContaining({
        is_adi: 'ErisimSinamaUclari.tek',
        erisilen_yer: '/erisim-sinama/kullanicilar/:id',
        kayit_sayisi: 1,
      }),
    ]);
    const metin = await kaydinMetni(istekKimligi(cevap));
    expect(metin).not.toContain(CEMIL);
    expect(metin).not.toContain('deneme');
  });

  it('yalnız okuyan POST isteği de kayıt yazar: ölçüt HTTP yöntemi değil yetki kapısından okumadır', async () => {
    const cevap = await aliIle('post', '/erisim-sinama/kullanicilar/ara');

    expect(cevap.status).toBe(201);
    expect(cevap.body).toHaveLength(LISTEDEKILER.length);
    expect(await erisimKayitlari(istekKimligi(cevap))).toEqual([
      expect.objectContaining({
        kullanici_id: ALI,
        is_adi: 'ErisimSinamaUclari.ara',
        erisilen_yer: '/erisim-sinama/kullanicilar/ara',
        kayit_sayisi: LISTEDEKILER.length,
      }),
    ]);
  });

  it('kayıt cevap dönmeden önce yazılır: erisim_kaydi kilitliyken cevap gelmez, kilit kalkınca kayıtla birlikte gelir', async () => {
    // İz gözlemcisi tabloyu kendi işleminde kilitler; yazıcının eklemesi kilidi bekler. Bekleme iz
    // istemcisinin kilit süresi sınırından (1 saniye) kısa tutulur.
    await izGozlemci.query('begin');
    let cevapGeldi = false;
    let bekleyen: Promise<request.Response> | undefined;
    try {
      await izGozlemci.query(
        'lock table erisim_kaydi in access exclusive mode',
      );
      bekleyen = aliIle('get', '/erisim-sinama/kullanicilar').then(
        (cevap) => {
          cevapGeldi = true;
          return cevap;
        },
      );
      // Yazıcının bağlantısı kilidi beklemeye başlayana dek yoklanır.
      const son = Date.now() + 5_000;
      while (
        (await tekDeger<number>(
          izGozlemci,
          `select count(*)::int as deger from pg_locks
            where relation = 'erisim_kaydi'::regclass and not granted`,
        )) === 0
      ) {
        if (Date.now() > son) {
          throw new Error('yazıcı kilidi beklemeye başlamadı');
        }
        await uyu(10);
      }
      expect(cevapGeldi).toBe(false);
    } finally {
      await izGozlemci.query('commit');
    }

    const cevap = await bekleyen;
    expect(cevap.status).toBe(200);
    expect(await erisimKayitlari(istekKimligi(cevap))).toHaveLength(1);
  });
});

describe('c) erişim kaydı yazılmayan istekler', () => {
  it('oturumlu ama yetki kapısından okuma yapmayan istekte erişim kaydı yoktur', async () => {
    const cevap = await aliIle('get', '/erisim-sinama/oturumlu');

    expect(cevap.status).toBe(200);
    expect(await erisimKayitlari(istekKimligi(cevap))).toEqual([]);
  });

  it('oturumsuz istekte erişim kaydı yoktur: herkese açık uç ve oturum isteyen uca oturumsuz istek', async () => {
    const acik = await request(uygulama().getHttpServer()).get(
      '/erisim-sinama/acik',
    );
    const reddedilen = await request(uygulama().getHttpServer()).get(
      '/erisim-sinama/kullanicilar',
    );

    expect(acik.status).toBe(200);
    expect(reddedilen.status).toBe(401);
    expect(await erisimKayitlari(istekKimligi(acik))).toEqual([]);
    expect(await erisimKayitlari(istekKimligi(reddedilen))).toEqual([]);
  });

  it('aynı istekte hem yetki kapısından okuma hem run ile yazma yapılınca erişim kaydı yoktur (TS-002 AK-40)', async () => {
    const cevap = await aliIle('post', '/erisim-sinama/kullanicilar/oku-yaz');

    expect(cevap.status).toBe(201);
    expect(cevap.body).toHaveLength(LISTEDEKILER.length);
    // Yazma gerçekten onaylanmıştır.
    expect(
      await tekDeger<string>(
        gozlemci,
        'select gorunen_ad as deger from kullanici where id = $1',
        [DENIZ],
      ),
    ).toBe(YAZILAN_AD);
    expect(await erisimKayitlari(istekKimligi(cevap))).toEqual([]);
  });
});

describe('d) iz veritabanına yazılamazken', () => {
  it('erisim_kaydi tablosunun adı değiştirilmişken okuma isteği 500 döner, okunan veri cevaba çıkmaz ve kayıt yazılmaz', async () => {
    const hatalar = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    sonOkunan = -1;
    await izGozlemci.query(
      'alter table erisim_kaydi rename to erisim_kaydi_kapali',
    );
    let cevap: request.Response;
    try {
      cevap = await aliIle('get', '/erisim-sinama/kullanicilar');
    } finally {
      await izGozlemci.query(
        'alter table erisim_kaydi_kapali rename to erisim_kaydi',
      );
    }

    // Uç veriyi okudu; cevap yalnız hata gövdesini taşır.
    expect(sonOkunan).toBe(LISTEDEKILER.length);
    expect(cevap.status).toBe(500);
    expect(cevap.body).toEqual(BEKLENMEYEN_HATA);
    for (const id of LISTEDEKILER) {
      expect(cevap.text).not.toContain(id);
    }
    expect(cevap.text).not.toContain('veli');
    expect(await erisimKayitlari(istekKimligi(cevap))).toEqual([]);
    // Hata süzgeci 5xx'i istek kimliğiyle günlüğe yazar.
    expect(
      hatalar.mock.calls.some(([ileti]) =>
        String(ileti).startsWith(`istek ${istekKimligi(cevap)}:`),
      ),
    ).toBe(true);
  });
});

describe('e) kayıt dönen kayıtların kimliklerini taşımaz', () => {
  it('liste okumasının kaydında ve bağlantı satırlarında dönen kişilerin kimlikleri yoktur', async () => {
    const cevap = await aliIle('get', '/erisim-sinama/kullanicilar');

    expect(cevap.status).toBe(200);
    expect((cevap.body as Kayit[]).map((k) => k['id'])).toEqual(LISTEDEKILER);
    const metin = await kaydinMetni(istekKimligi(cevap));
    expect(metin).toContain(ALI);
    for (const id of LISTEDEKILER) {
      expect(metin).not.toContain(id);
    }
  });
});
