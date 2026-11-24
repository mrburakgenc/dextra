// Yetki verisi, yetki belleği, yetki guard'ı ve "yetkilerim" ucu (GV-032; TS-002 AK-16, AK-17, AK-18;
// KR-010 Seçim 24, 32 ve "Derleme eşlemesi"; KR-008 Seçim 44 ve 46). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-yetki.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ve izin işaretli sınama uçlarıyla, göçleri uygulanmış asıl ve iz geçici
// veritabanlarıyla açılır. Başlangıcı tohum koşucusu kurar (kök grup, temel ve SuperAdmin rolleri,
// izin kataloğu, ilk SuperAdmin). Ek grup, rol, kullanıcı, üyelik, yetenek ve oturum satırları SQL
// ile yazılır: bu satırları yazan yönetim komutları henüz yoktur. Her test kendi kişisiyle çalışır,
// çünkü yetki belleği süreç boyunca yaşar. Belirteci ve adres imzasını test, e2e-setup'ın ortama
// koyduğu anahtar ve sırla kendisi üretir; satırlar ayrı bir bağlantıdan (gözlemci) yazılır ve okunur.
import { Controller, Get, type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { KIMLIK_KURULUM_GOCU } from '../src/features/kimlik/_shared/tohum/kimlik-kurulum.goc.js';
import { BelirtecServisi } from '../src/shared/guvenlik/belirtec.js';
import { Izin } from '../src/shared/guvenlik/isaretler.js';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  ISTEMCI_BASLIKLARI,
  istemciImzasiUret,
} from '../src/shared/guvenlik/istemci-adresi-imzasi.js';
import {
  YETKI_VERISI,
  type YetkiVerisi,
} from '../src/shared/kimlik/yetki-verisi.contract.js';
import { TohumKosucusu } from '../src/shared/tohum/tohum-kosucusu.js';
import type { YetenekKurali } from '../src/shared/yetki/yetenek-derleyici.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';

const IP = '203.0.113.21';
const TARAYICI = 'Mozilla/5.0 yetki deneme';
const YETKILERIM = '/kimlik/oturum/yetkilerim';

// Kimlikler: kişiler 6…, gruplar 61…, roller 62…, üyelikler 63…, yetenekler 64…, oturumlar 65….
const ALI = '60000000-0000-4000-8000-000000000001';
const VELI = '60000000-0000-4000-8000-000000000002';
const CEMIL = '60000000-0000-4000-8000-000000000003';
const DENIZ = '60000000-0000-4000-8000-000000000004';
const EMRE = '60000000-0000-4000-8000-000000000005';
const FUNDA = '60000000-0000-4000-8000-000000000006';

// A ağacı: A → A1 → A1a; B, A'nın kardeşidir. C, D, E, F kendi testlerinin gruplarıdır.
const GRUP_A = '61000000-0000-4000-8000-00000000000a';
const GRUP_A1 = '61000000-0000-4000-8000-0000000000a1';
const GRUP_A1A = '61000000-0000-4000-8000-000000000a1a';
const GRUP_B = '61000000-0000-4000-8000-00000000000b';
const GRUP_C = '61000000-0000-4000-8000-00000000000c';
const GRUP_D = '61000000-0000-4000-8000-00000000000d';
const GRUP_E = '61000000-0000-4000-8000-00000000000e';
const GRUP_F = '61000000-0000-4000-8000-00000000000f';

const ROL_1 = '62000000-0000-4000-8000-000000000001';
const ROL_2 = '62000000-0000-4000-8000-000000000002';

const U_ALI_A = '63000000-0000-4000-8000-000000000001';
const U_ALI_B = '63000000-0000-4000-8000-000000000002';
const U_ALI_SILINMIS = '63000000-0000-4000-8000-000000000003';
const U_VELI_KOK = '63000000-0000-4000-8000-000000000004';
const U_CEMIL = '63000000-0000-4000-8000-000000000005';
const U_DENIZ = '63000000-0000-4000-8000-000000000006';
const U_EMRE = '63000000-0000-4000-8000-000000000007';
const U_FUNDA = '63000000-0000-4000-8000-000000000008';

const Y_ALI_KULLANICI = '64000000-0000-4000-8000-000000000001';
const Y_ALI_GRUP = '64000000-0000-4000-8000-000000000002';
const Y_ALI_SILINMIS = '64000000-0000-4000-8000-000000000003';
const Y_SILINMIS_UYELIGIN = '64000000-0000-4000-8000-000000000004';
const Y_CAPRAZ = '64000000-0000-4000-8000-000000000005';
const Y_CEMIL = '64000000-0000-4000-8000-000000000006';
const Y_DENIZ = '64000000-0000-4000-8000-000000000007';
const Y_EMRE_BOZUK = '64000000-0000-4000-8000-000000000008';
const Y_FUNDA = '64000000-0000-4000-8000-000000000009';

const OT_ALI = '65000000-0000-4000-8000-000000000001';
const OT_VELI = '65000000-0000-4000-8000-000000000002';
const OT_CEMIL = '65000000-0000-4000-8000-000000000003';
const OT_DENIZ = '65000000-0000-4000-8000-000000000004';
const OT_EMRE = '65000000-0000-4000-8000-000000000005';
const OT_FUNDA = '65000000-0000-4000-8000-000000000006';
const OT_SUPERADMIN = '65000000-0000-4000-8000-000000000007';

const YETKI_YOK = {
  kod: 'yetki_yok',
  ileti: 'Bu işlem için yetki yok',
  ayrinti: null,
};
const KIMLIK_GEREKLI = {
  kod: 'kimlik_gerekli',
  ileti: 'Kimlik doğrulanamadı',
  ayrinti: null,
};

// İzin işaretli sınama uçları: her biri izin kataloğundaki bir (kaynak, eylem) çiftini ister.
const SINAMA_UCLARI = [
  ['kullanici-oku', 'Kullanici', 'oku'],
  ['grup-sil', 'Grup', 'sil'],
  ['yetenek-olustur', 'Yetenek', 'olustur'],
  ['oturum-kapat', 'Oturum', 'kapat'],
  ['izin-oku', 'Izin', 'oku'],
] as const;

@Controller('yetki-sinama')
class YetkiSinamaUclari {
  @Get('kullanici-oku')
  @Izin('Kullanici', 'oku')
  kullaniciOku(): { durum: string } {
    return { durum: 'acik' };
  }

  @Get('grup-sil')
  @Izin('Grup', 'sil')
  grupSil(): { durum: string } {
    return { durum: 'acik' };
  }

  @Get('yetenek-olustur')
  @Izin('Yetenek', 'olustur')
  yetenekOlustur(): { durum: string } {
    return { durum: 'acik' };
  }

  @Get('oturum-kapat')
  @Izin('Oturum', 'kapat')
  oturumKapat(): { durum: string } {
    return { durum: 'acik' };
  }

  @Get('izin-oku')
  @Izin('Izin', 'oku')
  izinOku(): { durum: string } {
    return { durum: 'acik' };
  }
}

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;
let superadmin: string;
let kokGrup: string;
let temelRol: string;

function uygulama(): INestApplication<App> {
  if (app === undefined) {
    throw new Error('uygulama açılmadı');
  }
  return app;
}

function yetkiVerisi(): YetkiVerisi {
  return uygulama().get<YetkiVerisi>(YETKI_VERISI);
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

function izinId(kaynak: string, eylem: string): Promise<{ id: string }> {
  return tekSatir<{ id: string }>(
    'select id from izin where kaynak = $1 and eylem = $2',
    [kaynak, eylem],
  );
}

async function grupEkle(id: string, ustGrupId: string): Promise<void> {
  await gozlemci.query(
    'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
    [id, ustGrupId, `Grup ${id}`],
  );
}

async function kisiEkle(id: string, ad: string): Promise<void> {
  await gozlemci.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
    [id, ad],
  );
}

async function uyelikEkle(
  id: string,
  kullaniciId: string,
  grupId: string,
  rolId: string,
  silinmis = false,
): Promise<void> {
  await gozlemci.query(
    `insert into uyelik (id, kullanici_id, grup_id, rol_id, silinme_zamani)
     values ($1, $2, $3, $4, case when $5 then clock_timestamp() end)`,
    [id, kullaniciId, grupId, rolId, silinmis],
  );
}

interface YetenekSecenekleri {
  readonly sart?: unknown;
  readonly kolonlar?: readonly string[];
  readonly silinmis?: boolean;
}

// Şartsız yetenek bütün kayıtları, kolon listesiz yetenek bütün kolonları açar.
async function yetenekEkle(
  id: string,
  grupId: string,
  rolId: string,
  [kaynak, eylem]: readonly [string, string],
  { sart, kolonlar, silinmis = false }: YetenekSecenekleri = {},
): Promise<void> {
  const izin = await izinId(kaynak, eylem);
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, silinme_zamani, koken)
     values ($1, $2, $3, $4, $5::jsonb, $5::jsonb is null, $6, $6::text[] is null,
             case when $7 then clock_timestamp() end, 'yonetici')`,
    [
      id,
      grupId,
      rolId,
      izin.id,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
      silinmis,
    ],
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

async function kisininSayisiniArtir(kullaniciId: string): Promise<void> {
  await gozlemci.query(
    'update kullanici set yetki_surumu = yetki_surumu + 1 where id = $1',
    [kullaniciId],
  );
}

async function genelSayaciArtir(): Promise<void> {
  await gozlemci.query('update yetki_surumu set sayac = sayac + 1');
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

async function getir(
  yol: string,
  kisi?: { kullaniciId: string; oturumId: string },
): Promise<request.Response> {
  const baslik =
    kisi === undefined ? {} : await basliklar(kisi.kullaniciId, kisi.oturumId);
  return request(uygulama().getHttpServer()).get(yol).set(baslik);
}

function sinama(
  uc: string,
  kullaniciId: string,
  oturumId: string,
): Promise<request.Response> {
  return getir(`/yetki-sinama/${uc}`, { kullaniciId, oturumId });
}

async function kurallari(
  kullaniciId: string,
  oturumId: string,
): Promise<YetenekKurali[]> {
  const cevap = await getir(YETKILERIM, { kullaniciId, oturumId });
  expect(cevap.status).toBe(200);
  return (cevap.body as { kurallar: YetenekKurali[] }).kurallar;
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
  expect(await uygulama().get(TohumKosucusu).kos()).toContain(
    KIMLIK_KURULUM_GOCU,
  );
  superadmin = (
    await tekSatir<{ id: string }>(
      "select id from kullanici where kullanici_adi = 'superadmin'",
    )
  ).id;
  kokGrup = (
    await tekSatir<{ id: string }>(
      'select id from grup where ust_grup_id is null',
    )
  ).id;
  temelRol = (
    await tekSatir<{ id: string }>("select id from rol where kod = 'temel'")
  ).id;

  await grupEkle(GRUP_A, kokGrup);
  await grupEkle(GRUP_A1, GRUP_A);
  await grupEkle(GRUP_A1A, GRUP_A1);
  for (const grup of [GRUP_B, GRUP_C, GRUP_D, GRUP_E, GRUP_F]) {
    await grupEkle(grup, kokGrup);
  }
  await gozlemci.query(
    `insert into rol (id, ad) values ($1, 'Rol 1'), ($2, 'Rol 2')`,
    [ROL_1, ROL_2],
  );

  const kisiler = [
    [ALI, 'ali', OT_ALI],
    [VELI, 'veli', OT_VELI],
    [CEMIL, 'cemil', OT_CEMIL],
    [DENIZ, 'deniz', OT_DENIZ],
    [EMRE, 'emre', OT_EMRE],
    [FUNDA, 'funda', OT_FUNDA],
  ] as const;
  for (const [id, ad, oturum] of kisiler) {
    await kisiEkle(id, ad);
    await oturumAc(oturum, id);
  }
  await oturumAc(OT_SUPERADMIN, superadmin);

  // Ali iki üyeliklidir: (A, Rol 1) ve (B, Rol 2); (A1, Rol 1) üyeliği silinmiştir.
  await uyelikEkle(U_ALI_A, ALI, GRUP_A, ROL_1);
  await uyelikEkle(U_ALI_B, ALI, GRUP_B, ROL_2);
  await uyelikEkle(U_ALI_SILINMIS, ALI, GRUP_A1, ROL_1, true);
  // Veli yalnız (Kök, Temel) üyesidir; tohumun o kümeye yazdığı yetenekler kişinin oturumlarıdır.
  await uyelikEkle(U_VELI_KOK, VELI, kokGrup, temelRol);
  await uyelikEkle(U_CEMIL, CEMIL, GRUP_C, ROL_1);
  await uyelikEkle(U_DENIZ, DENIZ, GRUP_D, ROL_1);
  await uyelikEkle(U_EMRE, EMRE, GRUP_E, ROL_1);
  await uyelikEkle(U_FUNDA, FUNDA, GRUP_F, ROL_1);

  await yetenekEkle(Y_ALI_KULLANICI, GRUP_A, ROL_1, ['Kullanici', 'oku']);
  await yetenekEkle(Y_ALI_GRUP, GRUP_B, ROL_2, ['Grup', 'oku'], {
    sart: [
      {
        alan: 'id',
        islec: 'listede',
        deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
      },
    ],
    kolonlar: ['id', 'ad'],
  });
  await yetenekEkle(Y_ALI_SILINMIS, GRUP_A, ROL_1, ['Rol', 'oku'], {
    silinmis: true,
  });
  // Silinmiş üyeliğin kümesine bağlı yetenek.
  await yetenekEkle(Y_SILINMIS_UYELIGIN, GRUP_A1, ROL_1, ['Uyelik', 'oku']);
  // Grubu bir üyelikten, rolü öbür üyelikten gelen küme (KR-008 Seçim 44).
  await yetenekEkle(Y_CAPRAZ, GRUP_A, ROL_2, ['Kullanici', 'guncelle']);
  await yetenekEkle(Y_CEMIL, GRUP_C, ROL_1, ['Kullanici', 'oku']);
  await yetenekEkle(Y_DENIZ, GRUP_D, ROL_1, ['Kullanici', 'oku']);
  await yetenekEkle(Y_EMRE_BOZUK, GRUP_E, ROL_1, ['Kullanici', 'oku'], {
    sart: [{ alan: 'yok', islec: 'esit', deger: 'x' }],
  });
  await yetenekEkle(Y_FUNDA, GRUP_F, ROL_1, ['Kullanici', 'oku']);
}

beforeAll(async () => {
  databases = await createAppDatabases({ migrations: true });
  gozlemci = new pg.Client({ connectionString: databases.asil.url });
  try {
    await gozlemci.connect();
    const modul = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [YetkiSinamaUclari],
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

describe('a) yetki verisi', () => {
  it('iki üyelikli kişi için üyelikler, yetenekler ve alt gruplar döner; silinmiş üyelik ve silinmiş yetenek, öbür üyeliğin rolüyle eşleşen küme dönmez', async () => {
    const surumler = await tekSatir<{ kisi: number; genel: number }>(
      `select k.yetki_surumu as kisi, y.sayac as genel
         from kullanici k cross join yetki_surumu y where k.id = $1`,
      [ALI],
    );

    const veri = await yetkiVerisi().kisininSatirlari(ALI);

    expect(veri.kisiSurumu).toBe(surumler.kisi);
    expect(veri.genelSurum).toBe(surumler.genel);
    expect(veri.uyelikler).toEqual([
      { uyelikId: U_ALI_A, grupId: GRUP_A, rolId: ROL_1 },
      { uyelikId: U_ALI_B, grupId: GRUP_B, rolId: ROL_2 },
    ]);
    expect(veri.yetenekler).toEqual([
      {
        yetenekId: Y_ALI_KULLANICI,
        grupId: GRUP_A,
        rolId: ROL_1,
        kaynak: 'Kullanici',
        eylem: 'oku',
        sart: [],
        butunKayitlar: true,
        butunBirimler: false,
        kolonlar: [],
        butunKolonlar: true,
      },
      {
        yetenekId: Y_ALI_GRUP,
        grupId: GRUP_B,
        rolId: ROL_2,
        kaynak: 'Grup',
        eylem: 'oku',
        sart: [
          {
            alan: 'id',
            islec: 'listede',
            deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
          },
        ],
        butunKayitlar: false,
        butunBirimler: false,
        kolonlar: ['id', 'ad'],
        butunKolonlar: false,
      },
    ]);
    expect(await yetkiVerisi().surumler(ALI)).toEqual({
      kisiSurumu: surumler.kisi,
      genelSurum: surumler.genel,
    });
  });

  it('alt grup listesi üyelik grubunun kendisini ve altındakileri içerir, kardeş grubu içermez', async () => {
    const { altGruplar } = await yetkiVerisi().kisininSatirlari(ALI);

    expect(Object.keys(altGruplar).sort()).toEqual([GRUP_A, GRUP_B].sort());
    expect([...(altGruplar[GRUP_A] ?? [])].sort()).toEqual(
      [GRUP_A, GRUP_A1, GRUP_A1A].sort(),
    );
    expect(altGruplar[GRUP_A]).not.toContain(GRUP_B);
    expect(altGruplar[GRUP_B]).toEqual([GRUP_B]);
  });

  // KR-008 Seçim 41; TS-002 AK-37: kapatılan birim üst birimin açılımında kalır.
  it('silinmiş alt grup ve onun altındaki grup üst grubun açılımında yer alır', async () => {
    const silinmis = '61000000-0000-4000-8000-0000000000a2';
    const silinmisinAltindaki = '61000000-0000-4000-8000-000000000a2a';
    await grupEkle(silinmis, GRUP_A);
    await grupEkle(silinmisinAltindaki, silinmis);
    await gozlemci.query(
      'update grup set silinme_zamani = clock_timestamp() where id = $1',
      [silinmis],
    );
    // Üst grup anahtarı RESTRICT'tir: önce alttaki silinir.
    onTestFinished(async () => {
      for (const id of [silinmisinAltindaki, silinmis]) {
        await gozlemci.query('delete from grup where id = $1', [id]);
      }
    });

    const { altGruplar } = await yetkiVerisi().kisininSatirlari(ALI);

    expect([...(altGruplar[GRUP_A] ?? [])].sort()).toEqual(
      [GRUP_A, GRUP_A1, GRUP_A1A, silinmis, silinmisinAltindaki].sort(),
    );
  });
});

describe('b) izin işaretli uç', () => {
  it('yeteneği olan kişi 200 alır', async () => {
    const cevap = await sinama('kullanici-oku', ALI, OT_ALI);

    expect(cevap.status).toBe(200);
    expect(cevap.body).toEqual({ durum: 'acik' });
  });

  it('yeteneği olmayan kişi 403 yetki_yok alır', async () => {
    const cevap = await sinama('kullanici-oku', VELI, OT_VELI);

    expect(cevap.status).toBe(403);
    expect(cevap.body).toEqual(YETKI_YOK);
  });

  it('şartlı yetenek tür düzeyinde ucu açar: (Kök, Temel) üyesi Oturum:kapat ucunda 200 alır', async () => {
    const cevap = await sinama('oturum-kapat', VELI, OT_VELI);

    expect(cevap.status).toBe(200);
  });

  it('başka bir üyeliğin rolüyle eşleşen kümenin yeteneği ucu açmaz (Kullanici:guncelle yok)', async () => {
    const kurallar = await kurallari(ALI, OT_ALI);

    expect(kurallar.map((k) => k.yetenekId)).not.toContain(Y_CAPRAZ);
  });

  it.each(SINAMA_UCLARI)('SuperAdmin %s ucunda 200 alır', async (uc) => {
    const cevap = await sinama(uc, superadmin, OT_SUPERADMIN);

    expect(cevap.status).toBe(200);
  });

  // SuperAdmin (Kök, Temel) üyesi de olduğu için kişinin oturumlarına bakan iki şartlı kural da taşır.
  it("SuperAdmin'in kuralları izin kataloğundaki her (kaynak, eylem) çifti için koşulsuz ve kolon sınırsız bir kural taşır", async () => {
    const izinler = await satirlar<{ kaynak: string; eylem: string }>(
      'select kaynak, eylem from izin',
    );
    const kurallar = await kurallari(superadmin, OT_SUPERADMIN);
    const sinirsizlar = kurallar.filter(
      (k) => k.conditions === undefined && k.fields === undefined,
    );

    expect(izinler.length).toBeGreaterThan(20);
    expect(
      sinirsizlar.map((k) => `${String(k.subject)}:${String(k.action)}`).sort(),
    ).toEqual(izinler.map((i) => `${i.kaynak}:${i.eylem}`).sort());
  });
});

describe('c) geri alma: yeni giriş gerekmeden ilk istekte', () => {
  it('kişinin üyeliği kapatılıp sayısı artırılınca 403 döner', async () => {
    expect((await sinama('kullanici-oku', CEMIL, OT_CEMIL)).status).toBe(200);

    await gozlemci.query(
      'update uyelik set silinme_zamani = clock_timestamp() where id = $1',
      [U_CEMIL],
    );
    await kisininSayisiniArtir(CEMIL);
    const cevap = await sinama('kullanici-oku', CEMIL, OT_CEMIL);

    expect(cevap.status).toBe(403);
    expect(cevap.body).toEqual(YETKI_YOK);
  });

  it('yetenek silinip genel sayaç artırılınca 403 döner', async () => {
    expect((await sinama('kullanici-oku', DENIZ, OT_DENIZ)).status).toBe(200);

    await gozlemci.query(
      'update yetenek set silinme_zamani = clock_timestamp() where id = $1',
      [Y_DENIZ],
    );
    await genelSayaciArtir();
    const cevap = await sinama('kullanici-oku', DENIZ, OT_DENIZ);

    expect(cevap.status).toBe(403);
    expect(cevap.body).toEqual(YETKI_YOK);
  });
});

describe('d) yetki belleği', () => {
  it('sürümler değişmeden gelen ikinci istekte yetki verisi yeniden okunmaz; sürüm değişince yeniden okunur', async () => {
    const okuma = vi.spyOn(yetkiVerisi(), 'kisininSatirlari');

    expect((await sinama('kullanici-oku', FUNDA, OT_FUNDA)).status).toBe(200);
    expect(okuma).toHaveBeenCalledTimes(1);
    expect(okuma).toHaveBeenLastCalledWith(FUNDA);

    expect((await sinama('kullanici-oku', FUNDA, OT_FUNDA)).status).toBe(200);
    expect(okuma).toHaveBeenCalledTimes(1);

    await kisininSayisiniArtir(FUNDA);
    expect((await sinama('kullanici-oku', FUNDA, OT_FUNDA)).status).toBe(200);
    expect(okuma).toHaveBeenCalledTimes(2);

    await genelSayaciArtir();
    expect((await sinama('kullanici-oku', FUNDA, OT_FUNDA)).status).toBe(200);
    expect(okuma).toHaveBeenCalledTimes(3);

    expect((await sinama('kullanici-oku', FUNDA, OT_FUNDA)).status).toBe(200);
    expect(okuma).toHaveBeenCalledTimes(3);
  });
});

describe('e) yetkilerim', () => {
  it('kişinin kurallarını döner: kaynak, eylem, koşul, kolonlar ve yetenek kimliği', async () => {
    const kurallar = await kurallari(ALI, OT_ALI);

    expect(kurallar).toEqual([
      { yetenekId: Y_ALI_KULLANICI, action: 'oku', subject: 'Kullanici' },
      {
        yetenekId: Y_ALI_GRUP,
        action: 'oku',
        subject: 'Grup',
        fields: ['id', 'ad'],
        conditions: { AND: [{ id: { in: [GRUP_B] } }] },
      },
    ]);
  });

  it('başka kişinin kuralı dönmez; şart isteyenin kimliğine çözülür', async () => {
    const kurallar = await kurallari(VELI, OT_VELI);
    const aliKurallari = (await kurallari(ALI, OT_ALI)).map((k) => k.yetenekId);

    expect(kurallar.map((k) => k.subject)).toEqual(['Oturum', 'Oturum']);
    expect(kurallar.map((k) => k.action).sort()).toEqual(['kapat', 'oku']);
    for (const kural of kurallar) {
      expect(aliKurallari).not.toContain(kural.yetenekId);
      expect(kural.conditions).toEqual({
        AND: [{ kullaniciId: { equals: VELI } }],
      });
    }
  });

  it('oturumsuz istek 401 kimlik_gerekli alır', async () => {
    const cevap = await getir(YETKILERIM);

    expect(cevap.status).toBe(401);
    expect(cevap.body).toEqual(KIMLIK_GEREKLI);
  });
});

describe('f) şartı bozuk yetenek', () => {
  it('bilinmeyen alanlı şart kural üretmez, uç kapalı düşer ve satır kimliğiyle günlüğe yazılır', async () => {
    const uyarilar = vi.spyOn(Logger.prototype, 'warn');

    const cevap = await sinama('kullanici-oku', EMRE, OT_EMRE);

    expect(cevap.status).toBe(403);
    expect(cevap.body).toEqual(YETKI_YOK);
    expect(uyarilar.mock.calls.map(([ileti]) => String(ileti))).toContain(
      `Yetenek derlenmedi: yetenek=${Y_EMRE_BOZUK} neden=bilinmeyen alan: yok`,
    );
    expect(await kurallari(EMRE, OT_EMRE)).toEqual([]);
  });
});
