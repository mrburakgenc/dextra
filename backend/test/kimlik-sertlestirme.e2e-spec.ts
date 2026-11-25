// Kimlik sertleştirmesi (GV-052; TS-002 AK-27, AK-35, AK-36, AK-37; KR-008 Seçim 41; KR-010
// yükümlülük 4). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-sertlestirme.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ve izin işaretli bir sınama ucuyla, göçleri uygulanmış asıl ve iz geçici
// veritabanlarıyla açılır. Başlangıcı tohum koşucusu kurar; ek kişi, grup, rol, üyelik, yetenek ve
// oturum satırları SQL ile yazılır (bu satırları yazan yönetim komutları henüz yoktur). Belirteci ve
// adres imzasını test, e2e-setup'ın ortama koyduğu anahtar ve sırla üretir; satırlar ve notlar ayrı
// bir bağlantıdan (gözlemci) okunur.
import { randomUUIDv7 } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Controller,
  Get,
  type INestApplication,
  type InjectionToken,
  Logger,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ParolaBaglantisi } from '../src/features/kimlik/_shared/application/parola-baglantisi.js';
import { kimlikSistemAktoru } from '../src/features/kimlik/_shared/infrastructure/repositories/sistem-aktoru-cekirdek.prisma-repository.js';
import { GenelSayac } from '../src/features/kimlik/_shared/application/genel-sayac.js';
import type { IzBilgisi } from '../src/features/kimlik/_shared/application/iz.js';
import { KisiKilidi } from '../src/features/kimlik/_shared/application/kisi-kilidi.js';
import { KisininSayisi } from '../src/features/kimlik/_shared/application/kisinin-sayisi.js';
import { KokUyelik } from '../src/features/kimlik/_shared/application/kok-uyelik.js';
import { TohumYardimcisi } from '../src/features/kimlik/_shared/application/tohum-yardimcisi.js';
import { KIMLIK_KURULUM_GOCU } from '../src/features/kimlik/_shared/infrastructure/tohum/kimlik-kurulum.goc.js';
import { KimlikYetkiVerisi } from '../src/features/kimlik/_shared/application/yetki-verisi.js';
import { KimlikModule } from '../src/features/kimlik/kimlik.module.js';
import { OturumDenetimiHandler } from '../src/features/kimlik/oturum/application/commands/oturum-denetimi/oturum-denetimi.handler.js';
import { KurulumBaglantisiHandler } from '../src/features/kimlik/parola/application/commands/kurulum-baglantisi/kurulum-baglantisi.handler.js';
import type { PrismaClient } from '../src/shared/database/generated/client.js';
import { PRISMA_CLIENT } from '../src/shared/database/istemci-belirtecleri.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { BelirtecServisi } from '../src/shared/guvenlik/application/belirtec.js';
import { Izin } from '../src/shared/guvenlik/application/isaretler.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/application/istemci-adresi-imzasi.js';
import { ISTEK_KIMLIGI_BASLIGI } from '../src/shared/http/istek-baglami.js';
import { TohumKosucusu } from '../src/shared/tohum/tohum-kosucusu.js';
import type { YetenekKurali } from '../src/shared/yetki/application/yetenek-derleyici.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const IP = '203.0.113.52';
const BASKA_IP = '198.51.100.52';
const TARAYICI = 'Mozilla/5.0 sertlestirme deneme';
const PAROLA = 'dogru at pil zımba cümlesi';
const GIRIS = '/kimlik/oturum/giris';
const BELIRLE = '/kimlik/parola/belirle';
const YETKILERIM = '/kimlik/oturum/yetkilerim';
const SINAMA = '/sertlestirme-sinama/kullanici-oku';

// Kimlikler: kişiler 7…, grup 71…, rol 72…, üyelik 73…, yetenekler 74…, oturumlar 75….
const AYSE = '70000000-0000-4000-8000-000000000001';
const CEM = '70000000-0000-4000-8000-000000000002';
const BORA = '70000000-0000-4000-8000-000000000003';
const GRUP = '71000000-0000-4000-8000-000000000001';
const ROL = '72000000-0000-4000-8000-000000000001';
const U_BORA = '73000000-0000-4000-8000-000000000001';
const Y_SAGLAM = '74000000-0000-4000-8000-000000000001';
const Y_DIZI_DEGIL = '74000000-0000-4000-8000-000000000002';
const Y_NESNE_DEGIL = '74000000-0000-4000-8000-000000000003';
const OT_SUPERADMIN = '75000000-0000-4000-8000-000000000001';
const OT_AYSE = '75000000-0000-4000-8000-000000000002';
const OT_BORA = '75000000-0000-4000-8000-000000000003';

const backendDir = fileURLToPath(new URL('..', import.meta.url));

@Controller('sertlestirme-sinama')
class SertlestirmeSinamaUclari {
  @Get('kullanici-oku')
  @Izin('Kullanici', 'oku')
  kullaniciOku(): { durum: string } {
    return { durum: 'acik' };
  }
}

interface Not {
  istek_id: string | null;
  kullanici_id: string;
  is_adi: string;
  kaynak: string;
  kayit_id: string;
  eylem: string;
  veri_sahibi_kullanici_id: string | null;
}

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;
let superadmin: string;
let sistemAktoru: string;
let kokGrup: string;

function uygulama(): INestApplication<App> {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app;
}

function al<T>(tur: abstract new (...args: never[]) => T): T {
  return uygulama().get(tur);
}

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T[]> {
  return (await gozlemci.query<T>(sql, degerler)).rows;
}

async function tekSatir<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
): Promise<T> {
  const [satir] = await satirlar<T>(sql, degerler);
  if (satir === undefined) {
    throw new Error(`satır yok: ${sql}`);
  }
  return satir;
}

// Verilen işin notları, yazılma sırasıyla.
async function notlar(isAdi: string): Promise<Not[]> {
  return (
    await satirlar<{ govde: Not }>(
      `select govde from outbox_iz where govde->>'is_adi' = $1
        order by olusturma_zamani, id`,
      [isAdi],
    )
  ).map((s) => s.govde);
}

async function kisiEkle(id: string, ad: string): Promise<void> {
  await gozlemci.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
    [id, ad],
  );
}

async function oturumAc(id: string, kullaniciId: string): Promise<void> {
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(), $3, $4)`,
    [id, kullaniciId, IP, TARAYICI],
  );
}

// Şartsız yetenek bütün kayıtları açar; şart verilirse olduğu gibi (JSON) saklanır.
async function yetenekEkle(
  id: string,
  [kaynak, eylem]: readonly [string, string],
  sart?: unknown,
): Promise<void> {
  const izin = await tekSatir<{ id: string }>(
    'select id from izin where kaynak = $1 and eylem = $2',
    [kaynak, eylem],
  );
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, butun_kolonlar, koken)
     values ($1, $2, $3, $4, $5::jsonb, $5::jsonb is null, true, 'yonetici')`,
    [id, GRUP, ROL, izin.id, sart === undefined ? null : JSON.stringify(sart)],
  );
}

// Aracı katmanın imzaladığı istemci adresi; oturum verilirse erişim belirteci de.
async function basliklar(
  ip: string,
  kisi?: { kullaniciId: string; oturumId: string },
): Promise<Record<string, string>> {
  const zaman = Date.now();
  const adres = {
    [ISTEMCI_BASLIKLARI.adres]: ip,
    [ISTEMCI_BASLIKLARI.tarayici]: TARAYICI,
    [ISTEMCI_BASLIKLARI.zaman]: String(zaman),
    [ISTEMCI_BASLIKLARI.imza]: istemciImzasiUret(
      process.env[ARACI_KATMAN_SIRRI_DEGISKENI] ?? '',
      { adres: ip, tarayici: TARAYICI, zaman },
    ),
  };
  if (kisi === undefined) {
    return adres;
  }
  const belirtec = await new BelirtecServisi(process.env).erisimBelirteciUret(
    kisi,
  );
  return { ...adres, authorization: `Bearer ${belirtec}` };
}

async function getir(
  yol: string,
  kisi: { kullaniciId: string; oturumId: string },
  ip = IP,
): Promise<request.Response> {
  return request(uygulama().getHttpServer())
    .get(yol)
    .set(await basliklar(ip, kisi));
}

function istekKimligi(cevap: request.Response): string {
  const deger: unknown = cevap.headers[ISTEK_KIMLIGI_BASLIGI];
  expect(deger).toEqual(expect.any(String));
  return String(deger);
}

// Yönetimin bağlantı üretme ucu yok; parça, kişi kilidi alınmış işlemde doğrudan çağrılır.
function baglantiUret(kullaniciId: string): Promise<string> {
  const iz: IzBilgisi = { yazanId: sistemAktoru, isAdi: 'test:sertlestirme' };
  return al(UnitOfWork).run(async (islem) => {
    await al(KisiKilidi).kilitle(islem, kullaniciId);
    return al(ParolaBaglantisi).uret(
      islem,
      { kullaniciId, olusturanId: null },
      iz,
    );
  });
}

function belirle(kod: string): request.Test {
  return request(uygulama().getHttpServer())
    .post(BELIRLE)
    .send({ kod, parola: PAROLA });
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

// Tohum göçleri gerçek yoldan; kalan satırlar SQL ile.
async function baslangicKur(): Promise<void> {
  expect(await al(TohumKosucusu).kos()).toContain(KIMLIK_KURULUM_GOCU);
  superadmin = (
    await tekSatir<{ id: string }>(
      "select id from kullanici where kullanici_adi = 'superadmin'",
    )
  ).id;
  sistemAktoru = (
    await tekSatir<{ id: string }>(
      "select id from kullanici where sistem_aktoru and gorunen_ad = 'kimlik'",
    )
  ).id;
  kokGrup = (
    await tekSatir<{ id: string }>(
      'select id from grup where ust_grup_id is null',
    )
  ).id;
  await kisiEkle(AYSE, 'ayse');
  await kisiEkle(CEM, 'cem');
  await kisiEkle(BORA, 'bora');
}

beforeAll(async () => {
  databases = await createAppDatabases({ migrations: true });
  gozlemci = new pg.Client({ connectionString: databases.asil.url });
  try {
    await gozlemci.connect();
    const modul = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SertlestirmeSinamaUclari],
    }).compile();
    app = modul.createNestApplication();
    await app.init();
    gozlemciPid = (
      await tekSatir<{ pid: number }>('select pg_backend_pid() as pid')
    ).pid;
    await baslangicKur();
  } catch (error) {
    await app?.close();
    await gozlemci.end();
    await databases.drop();
    throw error;
  }
}, 60_000);

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a) notlarda istek kimliği (AK-27)', () => {
  it('tohum göçünün notlarında istek kimliği boştur', async () => {
    const tohum = await notlar(`tohum:${KIMLIK_KURULUM_GOCU}`);

    expect(tohum.length).toBeGreaterThan(10);
    expect(new Set(tohum.map((n) => n.istek_id))).toEqual(new Set([null]));
  });

  it('bağlantıyla parola belirlemenin notları (kişi kilidinin kapattığı oturumunki dahil) cevap başlığındaki istek kimliğini taşır; bağlantıyı üreten kurulum komutunun notlarında alan boştur', async () => {
    await oturumAc(OT_SUPERADMIN, superadmin);
    const kod = await al(KurulumBaglantisiHandler).calistir();

    const cevap = await belirle(kod);

    expect(cevap.status).toBe(204);
    const kimlik = istekKimligi(cevap);
    const belirleme = await notlar('kimlik:parola-belirle');
    expect(new Set(belirleme.map((n) => n.kaynak))).toEqual(
      new Set(['ParolaBaglantisi', 'KullaniciSirri', 'Oturum']),
    );
    expect(new Set(belirleme.map((n) => n.istek_id))).toEqual(
      new Set([kimlik]),
    );
    const kurulum = await notlar('kimlik:kurulum');
    expect(kurulum.length).toBeGreaterThan(0);
    expect(new Set(kurulum.map((n) => n.istek_id))).toEqual(new Set([null]));
  });

  it('girişin notları cevap başlığındaki istek kimliğini taşır', async () => {
    expect((await belirle(await baglantiUret(AYSE))).status).toBe(204);

    const cevap = await request(uygulama().getHttpServer())
      .post(GIRIS)
      .set(await basliklar(IP))
      .send({ kullaniciAdi: 'ayse', parola: PAROLA });

    expect(cevap.status).toBe(200);
    const kimlik = istekKimligi(cevap);
    const giris = await notlar('kimlik:giris');
    expect(new Set(giris.map((n) => n.kaynak))).toEqual(
      new Set(['Oturum', 'OturumSirri']),
    );
    expect(new Set(giris.map((n) => n.istek_id))).toEqual(new Set([kimlik]));
  });
});

describe('b) notlarda yazan (AK-35)', () => {
  it('bağlantıyla parola belirlemenin notlarında yazan, parolasını belirleyen kişidir', async () => {
    const cevap = await belirle(await baglantiUret(CEM));

    expect(cevap.status).toBe(204);
    const cemin = (await notlar('kimlik:parola-belirle')).filter(
      (n) => n.veri_sahibi_kullanici_id === CEM,
    );
    expect(new Set(cemin.map((n) => n.kaynak))).toEqual(
      new Set(['ParolaBaglantisi', 'KullaniciSirri']),
    );
    expect(new Set(cemin.map((n) => n.kullanici_id))).toEqual(new Set([CEM]));
  });

  it('adres uymazlığında oturum kapatmanın notunda yazan sistem aktörüdür ve not isteğin kimliğini taşır', async () => {
    await oturumAc(OT_AYSE, AYSE);

    const cevap = await getir(
      YETKILERIM,
      { kullaniciId: AYSE, oturumId: OT_AYSE },
      BASKA_IP,
    );

    expect(cevap.status).toBe(401);
    const [not, ...fazla] = (await notlar('kimlik:oturum-denetimi')).filter(
      (n) => n.kayit_id === OT_AYSE,
    );
    expect(fazla).toEqual([]);
    expect(not).toMatchObject({
      kaynak: 'Oturum',
      eylem: 'guncelleme',
      kullanici_id: sistemAktoru,
      istek_id: istekKimligi(cevap),
    });
  });
});

describe('c) sistem aktörü işlevi', () => {
  // Uygulamanın kendi istemcisi; işlemdeki değişiklik testin sonunda geri alınır.
  function istemci(): PrismaClient {
    return uygulama().get<PrismaClient>(PRISMA_CLIENT);
  }

  const GERI_AL = new Error('geri al');

  it('tek aktör varken onu döner', async () => {
    await expect(kimlikSistemAktoru(istemci())).resolves.toBe(sistemAktoru);
  });

  it('tohum yardımcısı aynı görünen adla ikinci sistem aktörü yazmayı reddeder ve hiçbir şey yazılmaz', async () => {
    const id = randomUUIDv7();

    await expect(
      al(UnitOfWork).run((islem) =>
        al(TohumYardimcisi).yaz(
          islem,
          {
            id,
            kullaniciAdi: null,
            telefon: null,
            gorunenAd: 'kimlik',
            sistemAktoru: true,
            uyelikler: [],
          },
          { yazanId: sistemAktoru, isAdi: 'test:sertlestirme' },
        ),
      ),
    ).rejects.toThrow('Görünen adı "kimlik" olan bir sistem aktörü zaten var');
    expect(
      await satirlar(
        "select id from kullanici where sistem_aktoru and gorunen_ad = 'kimlik'",
      ),
    ).toEqual([{ id: sistemAktoru }]);
    await expect(kimlikSistemAktoru(istemci())).resolves.toBe(sistemAktoru);
  });

  it('aynı adla birden çok aktör varken açık hata verir', async () => {
    await expect(
      istemci().$transaction(async (tx) => {
        await tx.kullanici.create({
          data: { id: randomUUIDv7(), gorunenAd: 'kimlik', sistemAktoru: true },
          select: { id: true },
        });
        await expect(kimlikSistemAktoru(tx)).rejects.toThrow(
          'Kimlik sistem aktörü tekil değil',
        );
        throw GERI_AL;
      }),
    ).rejects.toBe(GERI_AL);
  });

  it('aktör yokken açık hata verir', async () => {
    await expect(
      istemci().$transaction(async (tx) => {
        await tx.kullanici.delete({
          where: { id: sistemAktoru },
          select: { id: true },
        });
        await expect(kimlikSistemAktoru(tx)).rejects.toThrow(
          'Kimlik sistem aktörü yok',
        );
        throw GERI_AL;
      }),
    ).rejects.toBe(GERI_AL);
    await expect(kimlikSistemAktoru(istemci())).resolves.toBe(sistemAktoru);
  });
});

describe('d) katman yönü (AK-36)', () => {
  it('kimlik içinde uygulama, alan ve altyapı katmanından sunum katmanına giden içe aktarma yoktur', () => {
    const kok = join(backendDir, 'src/features/kimlik');
    const katmanDosyalari = readdirSync(kok, { recursive: true })
      .map(String)
      .filter((yol) =>
        /(^|\/)(application|domain|infrastructure)\/.*\.ts$/.test(yol),
      );
    const ihlaller: string[] = [];
    for (const yol of katmanDosyalari) {
      const tam = join(kok, yol);
      const metin = readFileSync(tam, 'utf8');
      for (const [, hedef] of metin.matchAll(
        /(?:from|import\()\s*'(\.[^']*)'/g,
      )) {
        if (resolve(dirname(tam), hedef ?? '').includes('/presentation/')) {
          ihlaller.push(`${yol} -> ${hedef ?? ''}`);
        }
      }
    }

    expect(katmanDosyalari.length).toBeGreaterThan(10);
    expect(ihlaller).toEqual([]);
  });
});

describe('f) şartının biçimi bozuk yetenek (AK-37)', () => {
  it('şartı dizi olmayan ve dizisinde nesne olmayan öğe bulunan satırlar kural üretmez ve günlüğe yazılır; aynı kümedeki kişinin isteği 500 dönmez, öbür yeteneği çalışır', async () => {
    await gozlemci.query(
      'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
      [GRUP, kokGrup, 'Sertleştirme'],
    );
    await gozlemci.query("insert into rol (id, ad) values ($1, 'Sınama')", [
      ROL,
    ]);
    await gozlemci.query(
      'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
      [U_BORA, BORA, GRUP, ROL],
    );
    await yetenekEkle(Y_SAGLAM, ['Kullanici', 'oku']);
    await yetenekEkle(Y_DIZI_DEGIL, ['Grup', 'oku'], {
      alan: 'id',
      islec: 'esit',
      deger: 'x',
    });
    await yetenekEkle(
      Y_NESNE_DEGIL,
      ['Rol', 'oku'],
      [{ alan: 'id', islec: 'esit', deger: 'x' }, null],
    );
    await oturumAc(OT_BORA, BORA);
    const uyarilar = vi.spyOn(Logger.prototype, 'warn');
    const bora = { kullaniciId: BORA, oturumId: OT_BORA };

    const yetkilerim = await getir(YETKILERIM, bora);
    const sinama = await getir(SINAMA, bora);

    expect(yetkilerim.status).toBe(200);
    expect((yetkilerim.body as { kurallar: YetenekKurali[] }).kurallar).toEqual(
      [{ yetenekId: Y_SAGLAM, action: 'oku', subject: 'Kullanici' }],
    );
    expect(sinama.status).toBe(200);
    expect(sinama.body).toEqual({ durum: 'acik' });
    const iletiler = uyarilar.mock.calls.map(([ileti]) => String(ileti));
    for (const yetenek of [Y_DIZI_DEGIL, Y_NESNE_DEGIL]) {
      expect(iletiler).toContain(
        `Yetenek derlenmedi: yetenek=${yetenek} neden=şartın biçimi bozuk`,
      );
    }
  });
});

describe('h) KimlikModule yalnız kök modülün kullandığı sağlayıcıları dışa verir', () => {
  // Kök modül (AppModule) dışa bir şey vermez; sınama modülü onu içe aktarır ve KimlikModule'ü kök
  // modülün içe aktardığı gibi içe aktarır, sonra verilen parçayı kendi sağlayıcısına ister.
  function sinamaModulu(parca: InjectionToken) {
    return Test.createTestingModule({
      imports: [AppModule, KimlikModule],
      providers: [
        { provide: 'ISTEYEN', useFactory: (p: unknown) => p, inject: [parca] },
      ],
    }).compile();
  }

  it.each(
    [
      GenelSayac,
      KisiKilidi,
      KisininSayisi,
      KokUyelik,
      ParolaBaglantisi,
      TohumYardimcisi,
    ].map((parca) => ({ ad: parca.name, parca })),
  )('çekirdek parça $ad istenince uygulama açılmaz', async ({ ad, parca }) => {
    await expect(sinamaModulu(parca)).rejects.toThrow(ad);
  });

  it.each(
    [OturumDenetimiHandler, KimlikYetkiVerisi].map((parca) => ({
      ad: parca.name,
      parca,
    })),
  )(
    'kök modülün kullandığı $ad istenince uygulama açılır',
    async ({ parca }) => {
      const modul = await sinamaModulu(parca);
      try {
        expect(modul.get('ISTEYEN')).toBeInstanceOf(parca);
      } finally {
        await modul.close();
      }
    },
  );
});
