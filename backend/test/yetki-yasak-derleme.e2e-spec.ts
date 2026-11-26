// Bozuk yasağın derlenmesi ve guard'ın yalnız izinleri sayması (GV-149; TS-008 "Derleme" ve Değişmez 5;
// KU-017, KU-019; AK-2). Koşturma:
//   pnpm -C backend test:e2e test/yetki-yasak-derleme.e2e-spec.ts --reporter=verbose
// Uygulama AppModule ile, göçleri uygulanmış asıl ve iz geçici veritabanlarıyla açılır; başlangıcı tohum
// koşucusu kurar. Yasak satırları veritabanına doğrudan yazılır; yasak yazımını kapatan geçici kısıt
// test yardımcısıyla düşürülür. Yasağın okumada ve yazmada uygulanması bu işin konusu değildir: uçta
// yalnız guard'ın kararına bakılır. Her test kendi kişisiyle çalışır, çünkü yetki belleği süreç
// boyunca yaşar.
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
  YETKI_VERISI,
  type YetkiVerisi,
} from '../src/shared/kimlik/domain/i-yetki-verisi.contract.js';
import { TohumKosucusu } from '../src/shared/tohum/infrastructure/tohum-kosucusu.js';
import { YetkiBellegi } from '../src/shared/yetki/infrastructure/yetki-bellegi.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { type AppDatabases, createAppDatabases } from './test-database.js';
import { yasakKisitiniDusur } from './yardimci/yasak-kisiti.js';

const IP = '203.0.113.31';
const TARAYICI = 'Mozilla/5.0 yasak derleme deneme';
// İzin işaretli uç: Kullanici:oku.
const UC = '/kimlik/kullanici';

// Kimlikler: kişiler 80…, gruplar 81…, roller 82…, üyelikler 83…, yetenekler 84…, oturumlar 85….
const YALNIZ_YASAK = '80000000-0000-4000-8000-000000000001';
const YALNIZ_BOZUK = '80000000-0000-4000-8000-000000000002';
const IZINLI_YASAKLI = '80000000-0000-4000-8000-000000000003';
const KOLONU_DUSEN = '80000000-0000-4000-8000-000000000004';
const SARTI_BOZUK = '80000000-0000-4000-8000-000000000005';

const ROL = '82000000-0000-4000-8000-000000000001';

const YETENEK = {
  yalnizYasak: '84000000-0000-4000-8000-000000000001',
  yalnizBozuk: '84000000-0000-4000-8000-000000000002',
  izin3: '84000000-0000-4000-8000-000000000003',
  yasak3: '84000000-0000-4000-8000-000000000004',
  izin4: '84000000-0000-4000-8000-000000000005',
  kolonuDusen: '84000000-0000-4000-8000-000000000006',
  izin5: '84000000-0000-4000-8000-000000000007',
  sartiBozuk: '84000000-0000-4000-8000-000000000008',
  sartiBozukIzin: '84000000-0000-4000-8000-000000000009',
} as const;

const YETKI_YOK = {
  kod: 'yetki_yok',
  ileti: 'Bu işlem için yetki yok',
  ayrinti: null,
};

let databases: AppDatabases;
let app: INestApplication<App> | undefined;
let gozlemci: pg.Client;
let gozlemciPid: number;
let kokGrup: string;
let kullaniciOkuIzni: string;

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

// Kişi: kendi grubu (kökün altında), oturumu ve (grup, ROL) üyeliği. Grup, üyelik ve oturum kimlikleri
// kişinin kimliğinin son hanesiyle türetilir.
async function kisiKur(
  kisi: string,
): Promise<{ grup: string; oturum: string }> {
  const no = kisi.slice(-1);
  const grup = `81000000-0000-4000-8000-00000000000${no}`;
  const oturum = `85000000-0000-4000-8000-00000000000${no}`;
  await gozlemci.query(
    'insert into grup (id, ust_grup_id, ad) values ($1, $2, $3)',
    [grup, kokGrup, `Grup ${no}`],
  );
  await gozlemci.query(
    'insert into kullanici (id, kullanici_adi, gorunen_ad) values ($1, $2, $2)',
    [kisi, `kisi${no}`],
  );
  await gozlemci.query(
    'insert into uyelik (id, kullanici_id, grup_id, rol_id) values ($1, $2, $3, $4)',
    [`83000000-0000-4000-8000-00000000000${no}`, kisi, grup, ROL],
  );
  await gozlemci.query(
    `insert into oturum (id, kullanici_id, giris_yontemi, mutlak_bitis_zamani, son_dondurme_zamani,
                         ip_adresi, tarayici_bilgisi)
     values ($1, $2, 'parola', clock_timestamp() + interval '7 days', clock_timestamp(), $3, $4)`,
    [oturum, kisi, IP, TARAYICI],
  );
  return { grup, oturum };
}

interface YetenekSecenekleri {
  readonly giremez?: boolean;
  // Saklanan şart olduğu gibi yazılır; verilmezse bütün kayıtlar.
  readonly sart?: unknown;
  // Verilmezse bütün kolonlar.
  readonly kolonlar?: readonly string[];
}

// Kullanici:oku yeteneği.
async function yetenekEkle(
  id: string,
  grup: string,
  { giremez = false, sart, kolonlar }: YetenekSecenekleri = {},
): Promise<void> {
  await gozlemci.query(
    `insert into yetenek (id, grup_id, rol_id, izin_id, sart, butun_kayitlar, kolonlar,
                          butun_kolonlar, giremez, koken)
     values ($1, $2, $3, $4, $5::jsonb, $5::jsonb is null, $6, $6::text[] is null, $7, 'yonetici')`,
    [
      id,
      grup,
      ROL,
      kullaniciOkuIzni,
      sart === undefined ? null : JSON.stringify(sart),
      kolonlar ?? null,
      giremez,
    ],
  );
}

async function getir(
  kullaniciId: string,
  oturumId: string,
): Promise<request.Response> {
  const zaman = Date.now();
  const belirtec = await new BelirtecServisi(process.env).erisimBelirteciUret({
    kullaniciId,
    oturumId,
  });
  return request(uygulama().getHttpServer())
    .get(UC)
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
async function derlenmisYetki(kisi: string) {
  const surumler = await uygulama()
    .get<YetkiVerisi>(YETKI_VERISI)
    .surumler(kisi);
  return uygulama().get(YetkiBellegi).al(kisi, surumler);
}

function iletiler(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map(([ileti]) => String(ileti));
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
    kullaniciOkuIzni = (
      await tekSatir<{ id: string }>(
        "select id from izin where kaynak = 'Kullanici' and eylem = 'oku'",
      )
    ).id;
    await gozlemci.query("insert into rol (id, ad) values ($1, 'Rol')", [ROL]);
  } catch (error) {
    await app?.close();
    await gozlemci.end();
    await databases.drop();
    throw error;
  }
}, 60_000);

afterAll(async () => {
  await app?.close();
  const acikKalan = await kalanBaglantiSayisi(gozlemci, databases.asil.name, [
    gozlemciPid,
  ]);
  await gozlemci.end();
  await databases.drop();
  expect(acikKalan).toBe(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('guard yalnız izin kurallarını sayar (KU-019)', () => {
  it('yalnız yasağı olan kişi izin işaretli uçta 403 alır', async () => {
    const { grup, oturum } = await kisiKur(YALNIZ_YASAK);
    await yetenekEkle(YETENEK.yalnizYasak, grup, { giremez: true });

    const cevap = await getir(YALNIZ_YASAK, oturum);

    expect(cevap.status).toBe(403);
    expect(cevap.body).toEqual(YETKI_YOK);
    const yetki = await derlenmisYetki(YALNIZ_YASAK);
    expect(yetki.kurallar).toEqual([]);
    expect(yetki.butunKurallar.map((k) => k.yetenekId)).toEqual([
      YETENEK.yalnizYasak,
    ]);
  });

  it('yalnız bozuk yasağı olan kişi de 403 alır: öncelik 100 yasak izin sayılmaz', async () => {
    const { grup, oturum } = await kisiKur(YALNIZ_BOZUK);
    await yetenekEkle(YETENEK.yalnizBozuk, grup, {
      giremez: true,
      sart: [{ alan: 'yok', islec: 'esit', deger: 'x' }],
    });

    const cevap = await getir(YALNIZ_BOZUK, oturum);

    expect(cevap.status).toBe(403);
    expect(cevap.body).toEqual(YETKI_YOK);
  });

  it('izni ve yasağı olan kişi uca girer', async () => {
    const { grup, oturum } = await kisiKur(IZINLI_YASAKLI);
    await yetenekEkle(YETENEK.izin3, grup);
    await yetenekEkle(YETENEK.yasak3, grup, { giremez: true });

    const cevap = await getir(IZINLI_YASAKLI, oturum);

    expect(cevap.status).toBe(200);
  });
});

describe('bozuk yasak (KU-017; AK-2)', () => {
  it('şemada olmayan kolon adı taşıyan yasak daralarak yaşamaz: koşulsuz, bütün kolonlu, öncelik 100 yasak olarak derlenir; derleme başına günlüğe tek hata satırı düşer', async () => {
    const { grup, oturum } = await kisiKur(KOLONU_DUSEN);
    await yetenekEkle(YETENEK.izin4, grup);
    // İki kolonlu yasak; ikinci kolonun adı şemada kalmamıştır.
    await yetenekEkle(YETENEK.kolonuDusen, grup, {
      giremez: true,
      kolonlar: ['gorunenAd', 'eskiKolon'],
    });
    const hatalar = vi.spyOn(Logger.prototype, 'error');
    const satiri = (): string[] =>
      iletiler(hatalar).filter((ileti) => ileti.includes(YETENEK.kolonuDusen));

    expect((await getir(KOLONU_DUSEN, oturum)).status).toBe(200);
    expect((await getir(KOLONU_DUSEN, oturum)).status).toBe(200);

    // İki istek, bir derleme.
    expect(satiri()).toEqual([
      `Bozuk yasak: yetenek=${YETENEK.kolonuDusen} neden=şemada olmayan kolon: eskiKolon`,
    ]);
    const yetki = await derlenmisYetki(KOLONU_DUSEN);
    expect(yetki.butunKurallar).toEqual([
      {
        yetenekId: YETENEK.izin4,
        action: 'oku',
        subject: 'Kullanici',
        giremez: false,
        oncelik: 0,
        yasaktanMuaf: false,
      },
      {
        yetenekId: YETENEK.kolonuDusen,
        action: 'oku',
        subject: 'Kullanici',
        giremez: true,
        oncelik: 100,
        yasaktanMuaf: false,
        kesinTutmuyor: { id: { in: [] } },
      },
    ]);
    expect(yetki.kurallar.map((k) => k.yetenekId)).toEqual([YETENEK.izin4]);

    // Sürüm artınca yeniden derlenir: ikinci derleme ikinci satırı yazar.
    await gozlemci.query(
      'update kullanici set yetki_surumu = yetki_surumu + 1 where id = $1',
      [KOLONU_DUSEN],
    );
    expect((await getir(KOLONU_DUSEN, oturum)).status).toBe(200);
    expect(satiri()).toHaveLength(2);
  });

  it('şartının biçimi bozuk yasak atılmaz, bozuk yasak olarak derlenir; aynı bozukluktaki izin bugünkü gibi atılır ve uyarıyla bildirilir', async () => {
    const { grup, oturum } = await kisiKur(SARTI_BOZUK);
    await yetenekEkle(YETENEK.izin5, grup);
    // Şart öğelerin dizisi değildir.
    await yetenekEkle(YETENEK.sartiBozuk, grup, {
      giremez: true,
      sart: { alan: 'id' },
    });
    await yetenekEkle(YETENEK.sartiBozukIzin, grup, { sart: { alan: 'id' } });
    const hatalar = vi.spyOn(Logger.prototype, 'error');
    const uyarilar = vi.spyOn(Logger.prototype, 'warn');

    expect((await getir(SARTI_BOZUK, oturum)).status).toBe(200);

    expect(iletiler(hatalar)).toContain(
      `Bozuk yasak: yetenek=${YETENEK.sartiBozuk} neden=şartın biçimi bozuk`,
    );
    expect(iletiler(uyarilar)).toContain(
      `Yetenek derlenmedi: yetenek=${YETENEK.sartiBozukIzin} neden=şartın biçimi bozuk`,
    );
    expect(
      iletiler(uyarilar).filter((ileti) => ileti.includes(YETENEK.sartiBozuk)),
    ).toEqual([]);
    const yetki = await derlenmisYetki(SARTI_BOZUK);
    expect(yetki.butunKurallar.map((k) => k.yetenekId)).toEqual([
      YETENEK.izin5,
      YETENEK.sartiBozuk,
    ]);
    expect(yetki.butunKurallar[1]).toEqual({
      yetenekId: YETENEK.sartiBozuk,
      action: 'oku',
      subject: 'Kullanici',
      giremez: true,
      oncelik: 100,
      yasaktanMuaf: false,
      kesinTutmuyor: { id: { in: [] } },
    });
    expect(yetki.bozukYasaklar).toEqual([
      {
        yetenekId: YETENEK.sartiBozuk,
        tur: 'derleme',
        neden: 'şartın biçimi bozuk',
      },
    ]);
  });
});
