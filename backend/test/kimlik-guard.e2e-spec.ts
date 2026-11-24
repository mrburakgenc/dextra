// Uç işaretleri, oturum denetimi (GV-029) ve kimlik guard'ı (GV-043); TS-002 AK-6, AK-8, AK-9, AK-12,
// AK-13, AK-14; KR-009 Kural 8; KR-010 Seçim 49. Koşturma:
//   pnpm -C backend test:e2e test/kimlik-guard.e2e-spec.ts --reporter=verbose
// İlk bölümler (GV-029) işaretlerin üst verisini doğrudan okur ve OturumDenetimi sözleşmesini AppModule
// ile açılan uygulamadan alıp doğrudan çağırır. "guard" bölümleri aynı uygulamaya eklenen sınama
// uçlarına HTTP isteği atar; belirteci ve adres imzasını test, e2e-setup'ın ortama koyduğu anahtar ve
// sırla kendisi üretir. Uygulama göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır;
// kullanıcı ve oturum satırları her testten önce SQL ile yeniden yazılır ve ayrı bir bağlantıdan
// (gözlemci) okunur.
import { AsyncLocalStorage } from 'node:async_hooks';
import { createPrivateKey } from 'node:crypto';
import {
  Controller,
  Get,
  type INestApplication,
  Logger,
  type Type,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import {
  ACIK_ANAHTAR_DEGISKENI,
  BelirtecServisi,
  OZEL_ANAHTAR_DEGISKENI,
} from '../src/shared/guvenlik/belirtec.js';
import {
  HerkeseAcik,
  ISARET_ANAHTARI,
  Izin,
  isaretleriOku,
  YalnizKendisi,
} from '../src/shared/guvenlik/isaretler.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/istemci-adresi-imzasi.js';
import { HealthController } from '../src/shared/health/health.controller.js';
import {
  type IstekOturumu,
  istekBaglami,
} from '../src/shared/http/istek-baglami.js';
import {
  OTURUM_DENETIMI,
  type OturumDenetimi,
  type OturumDenetimiSonucu,
} from '../src/shared/kimlik/oturum-denetimi.contract.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const AYSE = '40000000-0000-4000-8000-000000000001';
const PASIF = '40000000-0000-4000-8000-000000000002';
// Kimliğin sistem aktörü (AK-2): adres kapatmasının notunda yazan odur.
const SISTEM_AKTORU = '40000000-0000-4000-8000-000000000003';

const OTURUM = '41000000-0000-4000-8000-000000000001';
const OBUR_OTURUM = '41000000-0000-4000-8000-000000000002';
const OLMAYAN_OTURUM = '41000000-0000-4000-8000-0000000000ff';

const IP = '203.0.113.7';
const TARAYICI = 'Mozilla/5.0 deneme';
const KISI_SURUMU = 3;
const GENEL_SURUM = 7;

const BASLANGIC = `
  truncate outbox_iz, outbox_olay, oturum_sirri, oturum, uyelik, yetenek, parola_baglantisi,
           kullanici_sirri, kullanici, grup, rol, izin, yetki_surumu;
  insert into yetki_surumu (id, sayac) values (1, ${String(GENEL_SURUM)});
  insert into kullanici (id, kullanici_adi, gorunen_ad, sistem_aktoru, yetki_surumu, pasif_zamani)
  values ('${AYSE}', 'ayse', 'Ayşe', false, ${String(KISI_SURUMU)}, null),
         ('${PASIF}', 'pasif', 'Pasif', false, 0, clock_timestamp()),
         ('${SISTEM_AKTORU}', null, 'kimlik', true, 0, null);
`;

interface OturumSecenekleri {
  readonly kullaniciId?: string;
  // Şimdiye eklenecek PostgreSQL aralıkları.
  readonly mutlakBitis?: string;
  readonly sonDondurme?: string;
  readonly kapatilmaNedeni?: string;
}

interface OturumSatiri {
  id: string;
  kapatilma_zamani: Date | null;
  kapatilma_nedeni: string | null;
}

interface Not {
  kullanici_id: string;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  veri_sahibi_kullanici_id: string;
  degisen: Record<string, { eski: unknown; yeni: unknown }>;
}

// Guard'ın sınama uçları: her işaretten bir uç. Yalnız kendisi ucu oturumu istek bağlamından okur.
@Controller('guard-sinama')
class GuardSinamaUclari {
  @Get('acik')
  @HerkeseAcik()
  acik(): { durum: string } {
    return { durum: 'acik' };
  }

  @Get('kendisi')
  @YalnizKendisi()
  kendisi(): IstekOturumu | undefined {
    return istekBaglami().oturum;
  }

  @Get('izinli')
  @Izin('Kullanici', 'oku')
  izinli(): { durum: string } {
    return { durum: 'izinli' };
  }
}

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;

function denetim(): OturumDenetimi {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app.get<OturumDenetimi>(OTURUM_DENETIMI);
}

function denetle(
  oturumId = OTURUM,
  ipAdresi = IP,
  tarayiciBilgisi = TARAYICI,
): Promise<OturumDenetimiSonucu> {
  return denetim().denetle({ oturumId, ipAdresi, tarayiciBilgisi });
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await gozlemci.query<T>(sql, degerler)).rows;
}

async function oturumEkle(
  id: string,
  {
    kullaniciId = AYSE,
    mutlakBitis = '7 days',
    sonDondurme = '0 seconds',
    kapatilmaNedeni,
  }: OturumSecenekleri = {},
): Promise<void> {
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi, kapatilma_zamani, kapatilma_nedeni)
     values ($1, $2, 'parola', clock_timestamp() + $3::interval, clock_timestamp() + $4::interval,
             $5, $6, case when $7::text is null then null else clock_timestamp() end, $7)`,
    [
      id,
      kullaniciId,
      mutlakBitis,
      sonDondurme,
      IP,
      TARAYICI,
      kapatilmaNedeni ?? null,
    ],
  );
}

function oturumlar(): Promise<OturumSatiri[]> {
  return satirlar<OturumSatiri>(
    'select id, kapatilma_zamani, kapatilma_nedeni from oturum order by id',
  );
}

async function notlar(): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      'select govde from outbox_iz order by olusturma_zamani',
    )
  ).map((s) => s.govde);
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
  databases = await createAppDatabases({ migrations: true });
  try {
    const modul = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GuardSinamaUclari],
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    gozlemci = new pg.Client({ connectionString: databases.asil.url });
    await gozlemci.connect();
    const [satir] = await satirlar<{ pid: number }>(
      'select pg_backend_pid() as pid',
    );
    gozlemciPid = satir?.pid ?? -1;
  } catch (error) {
    await app?.close();
    await databases.drop();
    throw error;
  }
});

afterAll(async () => {
  await app?.close();
  // Uygulama kapanınca asıl veritabanında gözlemciden başka bağlantı kalmaz.
  const acikKalan = await kalanBaglantiSayisi(gozlemci, databases.asil.name, [
    gozlemciPid,
  ]);
  await gozlemci.end();
  await databases.drop();
  expect(acikKalan).toBe(0);
  expect(
    await kalanVeritabanlari([databases.asil.name, databases.iz.name]),
  ).toEqual([]);
});

beforeEach(async () => {
  await gozlemci.query(BASLANGIC);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('işaretler', () => {
  class SinamaUclari {
    @HerkeseAcik()
    acik(): void {
      return undefined;
    }

    @YalnizKendisi()
    kendisi(): void {
      return undefined;
    }

    @Izin('Kullanici', 'oku')
    izinli(): void {
      return undefined;
    }

    isaretsiz(): void {
      return undefined;
    }

    @HerkeseAcik()
    @Izin('Grup', 'sil')
    iki(): void {
      return undefined;
    }
  }
  // Ucun metodu; guard'ın çalışma anında aldığı işleyici de bu fonksiyondur.
  function metot(sinif: abstract new () => unknown, ad: string): object {
    return Reflect.get(sinif.prototype as object, ad) as object;
  }

  it('üç işaretin üst verisi ucun metodundan okunur; okunan ile anahtardaki değer aynıdır', () => {
    expect(isaretleriOku(metot(SinamaUclari, 'acik'))).toEqual([
      { tur: 'herkese_acik' },
    ]);
    expect(isaretleriOku(metot(SinamaUclari, 'kendisi'))).toEqual([
      { tur: 'yalniz_kendisi' },
    ]);
    expect(isaretleriOku(metot(SinamaUclari, 'izinli'))).toEqual([
      { tur: 'izin', kaynak: 'Kullanici', eylem: 'oku' },
    ]);
    expect(
      Reflect.getOwnMetadata(ISARET_ANAHTARI, metot(SinamaUclari, 'izinli')),
    ).toEqual(isaretleriOku(metot(SinamaUclari, 'izinli')));
  });

  it('işaretsiz uç boş, iki işaretli uç iki öğe okunur (yazıldıkları sırayla)', () => {
    expect(isaretleriOku(metot(SinamaUclari, 'isaretsiz'))).toEqual([]);
    expect(isaretleriOku(metot(SinamaUclari, 'iki'))).toEqual([
      { tur: 'herkese_acik' },
      { tur: 'izin', kaynak: 'Grup', eylem: 'sil' },
    ]);
  });

  it('sağlık ucu herkese açık işaretini taşır', () => {
    expect(isaretleriOku(metot(HealthController, 'check'))).toEqual([
      { tur: 'herkese_acik' },
    ]);
  });
});

describe('c) açık oturum', () => {
  it('denetim geçerli döner; kullanıcı kimliğini ve iki sayacı verir; satıra dokunmaz', async () => {
    await oturumEkle(OTURUM);
    const once = await oturumlar();

    expect(await denetle()).toEqual({
      gecerli: true,
      kullaniciId: AYSE,
      kisiSurumu: KISI_SURUMU,
      genelSurum: GENEL_SURUM,
    });
    expect(await oturumlar()).toEqual(once);
    expect(await notlar()).toEqual([]);
  });

  it('son döndürmesi 29 dakika önce olan oturum açıktır (hareketsizlik sınırı 30 dakika)', async () => {
    await oturumEkle(OTURUM, { sonDondurme: '-29 minutes' });

    expect(await denetle()).toMatchObject({ gecerli: true });
  });
});

describe('d) geçersiz oturum: sözleşmedeki nedenle döner ve satırlara dokunmaz', () => {
  const durumlar: readonly {
    ad: string;
    hazirla: () => Promise<void>;
    neden: string;
    oturumId?: string;
  }[] = [
    {
      ad: 'kapatılmış oturum',
      hazirla: () => oturumEkle(OTURUM, { kapatilmaNedeni: 'cikis' }),
      neden: 'kapali',
    },
    {
      ad: 'mutlak bitişi geçmiş oturum',
      hazirla: () => oturumEkle(OTURUM, { mutlakBitis: '-1 second' }),
      neden: 'suresi_doldu',
    },
    {
      ad: 'hareketsizlik sınırı dolmuş oturum (son döndürme 31 dakika önce)',
      hazirla: () => oturumEkle(OTURUM, { sonDondurme: '-31 minutes' }),
      neden: 'suresi_doldu',
    },
    {
      ad: 'pasif kullanıcının oturumu',
      hazirla: () => oturumEkle(OTURUM, { kullaniciId: PASIF }),
      neden: 'kullanici_pasif',
    },
    {
      ad: 'sistem aktörünün oturumu',
      hazirla: () => oturumEkle(OTURUM, { kullaniciId: SISTEM_AKTORU }),
      neden: 'kullanici_pasif',
    },
    {
      ad: 'genel sayaç satırı yokken açık oturum',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        await gozlemci.query('delete from yetki_surumu');
      },
      neden: 'yok',
    },
    {
      ad: 'olmayan oturum',
      hazirla: () => oturumEkle(OTURUM),
      neden: 'yok',
      oturumId: OLMAYAN_OTURUM,
    },
  ];

  it.each(durumlar)('$ad → $neden', async ({ hazirla, neden, oturumId }) => {
    await hazirla();
    const once = await oturumlar();

    expect(await denetle(oturumId)).toEqual({ gecerli: false, neden });
    expect(await oturumlar()).toEqual(once);
    expect(await notlar()).toEqual([]);
  });
});

describe('e) adres uymazlığı', () => {
  const durumlar = [
    { ad: "IP'si farklı", ip: '198.51.100.9', tarayici: TARAYICI },
    { ad: 'tarayıcı bilgisi farklı', ip: IP, tarayici: 'curl/8.0' },
  ];

  it.each(durumlar)(
    '$ad çağrı adres_degisti döner; yalnız o oturum kapanır, öbür oturum açık kalır; olay günlüğe değersiz yazılır',
    async ({ ip, tarayici }) => {
      await oturumEkle(OTURUM);
      await oturumEkle(OBUR_OTURUM);
      const uyarilar = vi.spyOn(Logger.prototype, 'warn');

      expect(await denetle(OTURUM, ip, tarayici)).toEqual({
        gecerli: false,
        neden: 'adres_degisti',
      });

      const [kapanan, obur] = await oturumlar();
      expect(kapanan).toMatchObject({
        id: OTURUM,
        kapatilma_nedeni: 'adres_degisti',
      });
      expect(kapanan?.kapatilma_zamani).toBeInstanceOf(Date);
      expect(obur).toEqual({
        id: OBUR_OTURUM,
        kapatilma_zamani: null,
        kapatilma_nedeni: null,
      });

      // Çekirdek yolun değişiklik kaydı: yazan sistem aktörü, kaynak Oturum.
      const [not, ...fazla] = await notlar();
      expect(fazla).toEqual([]);
      expect(not).toMatchObject({
        kullanici_id: SISTEM_AKTORU,
        is_adi: 'kimlik:oturum-denetimi',
        kaynak: 'Oturum',
        kayit_id: OTURUM,
        eylem: 'guncelleme',
        veri_sahibi_kullanici_id: AYSE,
        degisen: {
          kapatilma_zamani: {
            eski: null,
            yeni: kapanan?.kapatilma_zamani?.toISOString(),
          },
          kapatilma_nedeni: { eski: null, yeni: 'adres_degisti' },
        },
      });

      // Günlük oturum kimliğini ve nedeni taşır; adres ve tarayıcı değerlerini taşımaz (AK-13).
      const iletiler = uyarilar.mock.calls.map(([ileti]) => String(ileti));
      expect(iletiler).toEqual([
        `Oturum kapatıldı: oturum=${OTURUM} neden=adres_degisti`,
      ]);
      for (const deger of [IP, TARAYICI, ip, tarayici]) {
        expect(iletiler[0]).not.toContain(deger);
      }
    },
  );

  it('kapatılmış oturuma farklı adresle gelen çağrı kapali döner; satıra ve günlüğe dokunulmaz', async () => {
    await oturumEkle(OTURUM, { kapatilmaNedeni: 'cikis' });
    const once = await oturumlar();
    const uyarilar = vi.spyOn(Logger.prototype, 'warn');

    expect(await denetle(OTURUM, '198.51.100.9')).toEqual({
      gecerli: false,
      neden: 'kapali',
    });
    expect(await oturumlar()).toEqual(once);
    expect(uyarilar).not.toHaveBeenCalled();
  });
});

describe('g) tek deyim', () => {
  // Ölçüm yolu: node-postgres istemcisinin query metodu sarılır; yalnız ölçülen çağrının zaman uyumsuz
  // bağlamında (AsyncLocalStorage) gönderilen deyimler sayılır. Uygulamanın arka plan döngüleri aynı
  // havuzu kullandığı için bağlamsız deyimler sayılmaz. Havuz deyimi de istemcinin query metodundan
  // geçer; işlem dışındaki ve içindeki her deyim burada görünür.
  async function deyimleriSay(is: () => Promise<unknown>): Promise<string[]> {
    const olcum = new AsyncLocalStorage<string[]>();
    const asil = Reflect.get(pg.Client.prototype, 'query') as (
      ...args: unknown[]
    ) => unknown;
    vi.spyOn(pg.Client.prototype, 'query').mockImplementation(function (
      this: pg.Client,
      ...args: unknown[]
    ) {
      const [deyim] = args;
      olcum
        .getStore()
        ?.push(
          typeof deyim === 'string'
            ? deyim
            : String((deyim as { text?: unknown }).text),
        );
      return asil.apply(this, args);
    });
    const deyimler: string[] = [];
    await olcum.run(deyimler, is);
    return deyimler;
  }

  it('açık oturumun denetimi veritabanına tek deyim gönderir: oturum, kişi ve genel sayacı birlikte okuyan SELECT', async ({
    annotate,
  }) => {
    await oturumEkle(OTURUM);

    let sonuc: OturumDenetimiSonucu | undefined;
    const deyimler = await deyimleriSay(async () => {
      sonuc = await denetle();
    });

    await annotate(`gönderilen deyimler: ${JSON.stringify(deyimler)}`);
    expect(sonuc).toMatchObject({ gecerli: true });
    expect(deyimler).toHaveLength(1);
    expect(deyimler[0]).toMatch(/^\s*select\b/i);
    for (const tablo of ['oturum', 'kullanici', 'yetki_surumu']) {
      expect(deyimler[0]).toMatch(new RegExp(`\\b${tablo}\\b`));
    }
  });

  it('ölçüm yolu çalışır: adres uymazlığında okuma ve kapatma işlemi deyimleri sayılır', async () => {
    await oturumEkle(OTURUM);

    const deyimler = await deyimleriSay(() => denetle(OTURUM, '198.51.100.9'));

    expect(deyimler.length).toBeGreaterThan(1);
    expect(deyimler).toContain('BEGIN');
    expect(deyimler).toContain('COMMIT');
  });
});

// --- Kimlik guard'ı (GV-043) ---

const YABANCI_IP = '198.51.100.9';

// Bütün ret nedenlerinde aynı gövde döner (TS-002 AK-12: neden cevaba yazılmaz).
const KIMLIK_GEREKLI = {
  kod: 'kimlik_gerekli',
  ileti: 'Kimlik doğrulanamadı',
  ayrinti: null,
};

function ortamDegeri(ad: string): string {
  const deger = process.env[ad];
  if (deger === undefined) {
    throw new Error(`${ad} ortamda yok (test/e2e-setup.ts koyar)`);
  }
  return deger;
}

function sunucu(): App {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app.getHttpServer();
}

// Test belirteci uygulamanınkiyle aynı ortamdaki anahtarlarla kendisi üretir.
function belirtecler(): BelirtecServisi {
  return new BelirtecServisi(process.env);
}

interface BaslikSecenekleri {
  readonly kullaniciId?: string;
  readonly oturumId?: string;
  // Verilirse erişim belirteci yerine bu kullanılır.
  readonly belirtec?: string;
  readonly ip?: string;
  readonly tarayici?: string;
  readonly zaman?: number;
}

// Geçerli bir isteğin başlıkları: erişim belirteci ve aracı katmanın imzaladığı istemci adresi.
async function basliklar({
  kullaniciId = AYSE,
  oturumId = OTURUM,
  belirtec,
  ip = IP,
  tarayici = TARAYICI,
  zaman = Date.now(),
}: BaslikSecenekleri = {}): Promise<Record<string, string>> {
  const imza = istemciImzasiUret(ortamDegeri(ARACI_KATMAN_SIRRI_DEGISKENI), {
    adres: ip,
    tarayici,
    zaman,
  });
  return {
    authorization: `Bearer ${belirtec ?? (await belirtecler().erisimBelirteciUret({ kullaniciId, oturumId }))}`,
    [ISTEMCI_BASLIKLARI.adres]: ip,
    [ISTEMCI_BASLIKLARI.tarayici]: tarayici,
    [ISTEMCI_BASLIKLARI.zaman]: String(zaman),
    [ISTEMCI_BASLIKLARI.imza]: imza,
  };
}

function getir(yol: string, baslik: Record<string, string> = {}) {
  return request(sunucu()).get(`/guard-sinama/${yol}`).set(baslik);
}

// Bir dakika önce süresi dolmuş erişim belirteci; içeriği geçerli olanla aynıdır.
async function suresiGecmisBelirtec(): Promise<string> {
  const simdi = Math.floor(Date.now() / 1000);
  return new SignJWT({ oturum: OTURUM, tur: 'erisim' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(AYSE)
    .setIssuedAt(simdi - 16 * 60)
    .setExpirationTime(simdi - 60)
    .sign(createPrivateKey(ortamDegeri(OZEL_ANAHTAR_DEGISKENI)));
}

describe('guard: a) açılış denetimi', () => {
  @Controller('isaretsiz')
  class IsaretsizUclar {
    @Get()
    isaretsizUc(): void {
      return undefined;
    }
  }

  @Controller('iki-isaretli')
  class IkiIsaretliUclar {
    @Get()
    @HerkeseAcik()
    @YalnizKendisi()
    ikiIsaretliUc(): void {
      return undefined;
    }
  }

  it.each([
    ['işaretsiz uç', IsaretsizUclar, /IsaretsizUclar\.isaretsizUc .*0 işaret/],
    [
      'iki işaretli uç',
      IkiIsaretliUclar,
      /IkiIsaretliUclar\.ikiIsaretliUc .*2 işaret/,
    ],
  ] as [string, Type, RegExp][])(
    '%s içeren modülle uygulama açılmaz; hata ucun sınıfını ve yöntemini söyler',
    async (_ad, uclar, hata) => {
      const modul = await Test.createTestingModule({
        imports: [AppModule],
        controllers: [uclar],
      }).compile();
      const deneme = modul.createNestApplication();
      try {
        await expect(deneme.init()).rejects.toThrow(hata);
      } finally {
        await deneme.close();
      }
    },
  );
});

describe('guard: b) herkese açık uç', () => {
  it('belirteçsiz ve imzasız 200 döner', async () => {
    const cevap = await getir('acik');

    expect(cevap.status).toBe(200);
    expect(cevap.body).toEqual({ durum: 'acik' });
  });
});

describe('guard: c) yalnız kendisi ucu', () => {
  it('belirteçsiz 401 kimlik_gerekli döner', async () => {
    await oturumEkle(OTURUM);

    const cevap = await getir('kendisi');

    expect(cevap.status).toBe(401);
    expect(cevap.body).toEqual(KIMLIK_GEREKLI);
  });

  it('geçerli belirteç, geçerli imza ve açık oturumla 200 döner; uç kullanıcı ve oturum kimliğini istek bağlamından okur', async () => {
    await oturumEkle(OTURUM);
    const once = await oturumlar();

    const cevap = await getir('kendisi', await basliklar());

    expect(cevap.status).toBe(200);
    expect(cevap.body).toEqual({
      kullaniciId: AYSE,
      oturumId: OTURUM,
      kisiSurumu: KISI_SURUMU,
      genelSurum: GENEL_SURUM,
    });
    expect(await oturumlar()).toEqual(once);
  });
});

describe('guard: d) ret nedenleri; gövde nedeni ayırt ettirmez', () => {
  const durumlar: readonly {
    ad: string;
    hazirla: () => Promise<Record<string, string>>;
  }[] = [
    {
      ad: 'kapatılmış oturum',
      hazirla: async () => {
        await oturumEkle(OTURUM, { kapatilmaNedeni: 'cikis' });
        return basliklar();
      },
    },
    {
      ad: 'mutlak bitişi geçmiş oturum',
      hazirla: async () => {
        await oturumEkle(OTURUM, { mutlakBitis: '-1 second' });
        return basliklar();
      },
    },
    {
      ad: 'hareketsizlik sınırı dolmuş oturum',
      hazirla: async () => {
        await oturumEkle(OTURUM, { sonDondurme: '-31 minutes' });
        return basliklar();
      },
    },
    {
      ad: 'pasif kullanıcı',
      hazirla: async () => {
        await oturumEkle(OTURUM, { kullaniciId: PASIF });
        return basliklar({ kullaniciId: PASIF });
      },
    },
    {
      ad: 'sistem aktörü',
      hazirla: async () => {
        await oturumEkle(OTURUM, { kullaniciId: SISTEM_AKTORU });
        return basliklar({ kullaniciId: SISTEM_AKTORU });
      },
    },
    {
      ad: 'yenileme belirteci',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        return basliklar({
          belirtec: await belirtecler().yenilemeBelirteciUret({
            kullaniciId: AYSE,
            oturumId: OTURUM,
            nesil: 1,
          }),
        });
      },
    },
    {
      ad: 'süresi geçmiş belirteç',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        return basliklar({ belirtec: await suresiGecmisBelirtec() });
      },
    },
    {
      ad: 'geçersiz adres imzası',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        return {
          ...(await basliklar()),
          [ISTEMCI_BASLIKLARI.imza]: '0'.repeat(64),
        };
      },
    },
    {
      ad: 'eksik adres imzası',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        const baslik = await basliklar();
        Reflect.deleteProperty(baslik, ISTEMCI_BASLIKLARI.imza);
        return baslik;
      },
    },
    {
      ad: '60 saniyeden eski zaman damgası (61 saniye)',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        return basliklar({ zaman: Date.now() - 61_000 });
      },
    },
    {
      ad: 'genel sayaç satırı yokken geçerli istek',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        await gozlemci.query('delete from yetki_surumu');
        return basliklar();
      },
    },
    {
      ad: 'belirteç oturumun sahibinden başka kullanıcıyı taşıyor',
      hazirla: async () => {
        await oturumEkle(OTURUM);
        return basliklar({ kullaniciId: PASIF });
      },
    },
  ];

  it.each(durumlar)(
    '$ad → 401; gövde belirteçsiz istekteki gövdeyle birebir aynıdır',
    async ({ hazirla }) => {
      const baslik = await hazirla();
      const belirtecsiz = await getir('kendisi');

      const cevap = await getir('kendisi', baslik);

      expect(cevap.status).toBe(401);
      expect(cevap.body).toEqual(KIMLIK_GEREKLI);
      expect(cevap.text).toBe(belirtecsiz.text);
    },
  );
});

describe('guard: e) adres', () => {
  it("IP'si farklı gelen istek 401 döner; o oturum adres_degisti nedeniyle kapanır, kişinin öbür oturumu açık kalır", async () => {
    await oturumEkle(OTURUM);
    await oturumEkle(OBUR_OTURUM);

    const cevap = await getir('kendisi', await basliklar({ ip: YABANCI_IP }));

    expect(cevap.status).toBe(401);
    expect(cevap.body).toEqual(KIMLIK_GEREKLI);
    const [kapanan, obur] = await oturumlar();
    expect(kapanan).toMatchObject({
      id: OTURUM,
      kapatilma_nedeni: 'adres_degisti',
    });
    expect(kapanan?.kapatilma_zamani).toBeInstanceOf(Date);
    expect(obur).toEqual({
      id: OBUR_OTURUM,
      kapatilma_zamani: null,
      kapatilma_nedeni: null,
    });
  });

  it('adres imzası geçersizken farklı IP ile gelen istek 401 döner ve oturuma dokunulmaz', async () => {
    await oturumEkle(OTURUM);
    const once = await oturumlar();

    const cevap = await getir('kendisi', {
      ...(await basliklar({ ip: YABANCI_IP })),
      [ISTEMCI_BASLIKLARI.imza]: '0'.repeat(64),
    });

    expect(cevap.status).toBe(401);
    expect(cevap.body).toEqual(KIMLIK_GEREKLI);
    expect(await oturumlar()).toEqual(once);
    expect(await notlar()).toEqual([]);
  });
});

describe('guard: f) izin işaretli uç', () => {
  it('geçerli oturumla 403 yetki_yok döner (yetki denetimi bağlanana kadar kapalı düşer)', async () => {
    await oturumEkle(OTURUM);

    const cevap = await getir('izinli', await basliklar());

    expect(cevap.status).toBe(403);
    expect(cevap.body).toMatchObject({ kod: 'yetki_yok', ayrinti: null });
  });

  it('belirteçsiz 401 kimlik_gerekli döner', async () => {
    const cevap = await getir('izinli');

    expect(cevap.status).toBe(401);
    expect(cevap.body).toEqual(KIMLIK_GEREKLI);
  });
});

describe('guard: g) anahtar ve sır olmadan uygulama açılmaz', () => {
  it.each([
    ['belirteç özel anahtarı yok', OZEL_ANAHTAR_DEGISKENI, undefined],
    ['belirteç açık anahtarı yok', ACIK_ANAHTAR_DEGISKENI, undefined],
    ['aracı katman sırrı yok', ARACI_KATMAN_SIRRI_DEGISKENI, undefined],
    [
      'aracı katman sırrı 31 karakter',
      ARACI_KATMAN_SIRRI_DEGISKENI,
      'a'.repeat(31),
    ],
  ])(
    '%s: uygulama kurulamaz; hata değişkenin adını söyler',
    async (_ad, degisken, deger) => {
      const onceki = ortamDegeri(degisken);
      if (deger === undefined) {
        Reflect.deleteProperty(process.env, degisken);
      } else {
        process.env[degisken] = deger;
      }
      try {
        await expect(
          Test.createTestingModule({ imports: [AppModule] }).compile(),
        ).rejects.toThrow(degisken);
      } finally {
        process.env[degisken] = onceki;
      }
    },
  );
});
