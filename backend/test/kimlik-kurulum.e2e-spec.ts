// İlk kurulum göçü 202611240000-kimlik-kurulum (GV-027, GV-042; TS-002 AK-2, AK-3) ve yasak izinleri
// göçü 202611260000-kimlik-yasak-izinleri (GV-145; TS-008 "Aşamalar" 1 (b)). Koşturma:
//   pnpm -C backend test:e2e test/kimlik-kurulum.e2e-spec.ts --reporter=verbose
// Göçleri uygulanmış boş geçici veritabanında, uygulamanın KimlikModule'üyle kurulmuş tohum koşucusu
// çalıştırılır. Önce kuru koşu, sonra gerçek koşu yapılır; satırlar ayrı bir pg bağlantısından okunur.
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { KIMLIK_KURULUM_GOCU } from '../src/features/kimlik/_shared/infrastructure/tohum/kimlik-kurulum.goc.js';
import { KIMLIK_YASAK_IZINLERI_GOCU } from '../src/features/kimlik/_shared/infrastructure/tohum/kimlik-yasak-izinleri.goc.js';
import { KIMLIK_KAYNAKLARI } from '../src/features/kimlik/_shared/application/yetki-verisi.js';
import { KimlikModule } from '../src/features/kimlik/kimlik.module.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { PRISMA_CLIENT } from '../src/shared/database/domain/istemci-belirtecleri.js';
import { UnitOfWork } from '../src/shared/database/infrastructure/unit-of-work.js';
import type { YetenekSatiri } from '../src/shared/kimlik/domain/i-yetki-verisi.contract.js';
import { TohumDefteri } from '../src/shared/tohum/application/tohum-defteri.js';
import { TohumKosucusu } from '../src/shared/tohum/infrastructure/tohum-kosucusu.js';
import { prismaKaynakKatalogu } from '../src/shared/yetki/infrastructure/prisma-kaynak-katalogu.js';
import { yetenekleriDerle } from '../src/shared/yetki/application/yetenek-derleyici.js';
import { YetkiModule } from '../src/shared/yetki/yetki.module.js';
import { kalanBaglantiSayisi } from './baglanti-sayisi.js';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

const GOC_ADI = '202611240000-kimlik-kurulum';
const IS_ADI = `tohum:${GOC_ADI}`;
const YENI_GOC_ADI = '202611260000-kimlik-yasak-izinleri';
const YENI_IS_ADI = `tohum:${YENI_GOC_ADI}`;

// TS-008 "Veri modeli": yasak izinleri göçünün yazdığı iki izin.
const YASAK_IZINLERI = ['Yetenek:yasakla', 'Yetenek:teshis'];

// TS-002 "Uçlar ve izinler", yönetim listesi: 27 (kaynak, eylem) çifti; TS-008'in iki izniyle 29.
const YONETIM_IZINLERI = [
  'Kullanici:oku',
  'Kullanici:olustur',
  'Kullanici:guncelle',
  'Kullanici:giris_bilgisini_degistir',
  'Kullanici:pasife_al',
  'Kullanici:yeniden_ac',
  'Kullanici:parola_baglantisi_uret',
  'Kullanici:unut',
  'Oturum:oku',
  'Oturum:kapat',
  'Grup:oku',
  'Grup:olustur',
  'Grup:guncelle',
  'Grup:tasi',
  'Grup:sil',
  'Rol:oku',
  'Rol:olustur',
  'Rol:guncelle',
  'Rol:sil',
  'Izin:oku',
  'Uyelik:oku',
  'Uyelik:olustur',
  'Uyelik:sil',
  'Yetenek:oku',
  'Yetenek:olustur',
  'Yetenek:yenile',
  'Yetenek:sil',
  ...YASAK_IZINLERI,
];

// Notu olan kaynak tabloları ve model adları. Genel sayaç (AK-20) ve koşucunun defteri not bırakmaz.
const KAYNAK_TABLOLARI: Record<string, string> = {
  kullanici: 'Kullanici',
  grup: 'Grup',
  rol: 'Rol',
  izin: 'Izin',
  uyelik: 'Uyelik',
  yetenek: 'Yetenek',
};

let db: TestDatabase;
let moduleRef: TestingModule;
let kosucu: TohumKosucusu;
let gozlemci: pg.Client;
let gozlemciPid: number;

async function satirlar<T extends pg.QueryResultRow>(
  sql: string,
  degerler: unknown[] = [],
  istemci: pg.Client = gozlemci,
): Promise<T[]> {
  return (await istemci.query<T>(sql, degerler)).rows;
}

// Göç defteri dahil, Prisma'nın kendi defteri hariç bütün tabloların satır sayıları.
async function satirSayilari(
  istemci: pg.Client = gozlemci,
): Promise<Record<string, number>> {
  const tablolar = await satirlar<{ ad: string }>(
    `select table_name as ad from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
        and table_name <> '_prisma_migrations'
      order by table_name`,
    [],
    istemci,
  );
  const sayilar: Record<string, number> = {};
  for (const { ad } of tablolar) {
    const [satir] = await satirlar<{ sayi: number }>(
      `select count(*)::int as sayi from "${ad}"`,
      [],
      istemci,
    );
    sayilar[ad] = satir?.sayi ?? -1;
  }
  return sayilar;
}

async function sistemAktoru(): Promise<string> {
  const [satir] = await satirlar<{ id: string }>(
    'select id from kullanici where sistem_aktoru',
  );
  if (satir === undefined) {
    throw new Error('sistem aktörü yok');
  }
  return satir.id;
}

async function sunucudaVarMi(veritabani: string): Promise<boolean> {
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const { rows } = await sunucu.query(
      'select 1 from pg_database where datname = $1',
      [veritabani],
    );
    return rows.length > 0;
  } finally {
    await sunucu.end();
  }
}

// Göçü tohum defterine KimlikModule'ün kendisi bildirir. Kapıları sağlayan ortak modül kök
// modüldeki gibi kimlik kaynaklarının kataloğuyla kurulur (TS-002 AK-42 eki).
function modulKur(url: string): Promise<TestingModule> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  return Test.createTestingModule({
    imports: [
      KimlikModule,
      YetkiModule.forRoot(prismaKaynakKatalogu(KIMLIK_KAYNAKLARI)),
    ],
  })
    .overrideProvider(PRISMA_CLIENT)
    .useValue(prisma)
    .compile();
}

// Kurulumun karşılaştırılabilir dökümü: kimlikler ve zamanlar dışında yazılan her şey.
async function dokum(istemci: pg.Client): Promise<unknown> {
  return {
    sayilar: await satirSayilari(istemci),
    sayac: await satirlar('select id, sayac from yetki_surumu', [], istemci),
    gocler: await satirlar(
      'select ad from tohum_gocu order by ad',
      [],
      istemci,
    ),
    izinler: await satirlar(
      "select kaynak || ':' || eylem as cift from izin order by cift",
      [],
      istemci,
    ),
    yetenekler: await satirlar(
      `select g.ad as grup, r.kod as rol, i.kaynak || ':' || i.eylem as cift, y.sart,
              y.butun_kayitlar, y.butun_birimler, y.kolonlar, y.butun_kolonlar, y.sistem_satiri,
              y.giremez, y.oncelik, y.koken, y.tohum_anahtari, y.silinme_zamani
         from yetenek y join izin i on i.id = y.izin_id join rol r on r.id = y.rol_id
         join grup g on g.id = y.grup_id
        order by y.tohum_anahtari`,
      [],
      istemci,
    ),
    notlar: await satirlar(
      `select govde->>'is_adi' as is_adi, govde->>'kaynak' as kaynak,
              govde->>'eylem' as eylem, count(*)::int as sayi
         from outbox_iz group by 1, 2, 3 order by 1, 2, 3`,
      [],
      istemci,
    ),
  };
}

beforeAll(async () => {
  db = await createTestDatabase([], { migrations: true });
  try {
    moduleRef = await modulKur(db.url);
    kosucu = moduleRef.get(TohumKosucusu);
    gozlemci = new pg.Client({ connectionString: db.url });
    await gozlemci.connect();
    const [satir] = await satirlar<{ pid: number }>(
      'select pg_backend_pid() as pid',
    );
    gozlemciPid = satir?.pid ?? -1;
  } catch (error) {
    await db.drop();
    throw error;
  }
});

afterAll(async () => {
  // Modülün kapanışı asıl istemciyi (burada test veritabanınınkini) kapatır.
  await moduleRef.close();
  const acikKalan = await kalanBaglantiSayisi(gozlemci, db.name, [gozlemciPid]);
  await gozlemci.end();
  await db.drop();
  expect(acikKalan).toBe(0);
  expect(await sunucudaVarMi(db.name)).toBe(false);
});

describe('k) kuru koşu', () => {
  it('k) kuru koşu göçleri uygulanacak diye bildirir ve hiçbir tabloda satır bırakmaz', async () => {
    expect(await kosucu.kuruKos()).toEqual([
      KIMLIK_KURULUM_GOCU,
      KIMLIK_YASAK_IZINLERI_GOCU,
    ]);

    const sayilar = await satirSayilari();
    expect(Object.keys(sayilar)).toContain('yetenek');
    expect(Object.values(sayilar).every((sayi) => sayi === 0)).toBe(true);
  });
});

describe('kurulum', () => {
  let sureMs: number;
  let uygulanan: string[];

  beforeAll(async () => {
    const baslangic = performance.now();
    uygulanan = await kosucu.kos();
    sureMs = performance.now() - baslangic;
  });

  it('l) göçler sırayla uygulanır ve deftere 202611240000-kimlik-kurulum ve 202611260000-kimlik-yasak-izinleri adlarıyla yazılır; ölçülen süresi 5 saniyenin altındadır', async ({
    annotate,
  }) => {
    await annotate(`göçlerin süresi: ${sureMs.toFixed(0)} ms`);
    expect(uygulanan).toEqual([
      KIMLIK_KURULUM_GOCU,
      KIMLIK_YASAK_IZINLERI_GOCU,
    ]);
    expect(KIMLIK_KURULUM_GOCU).toBe(GOC_ADI);
    expect(KIMLIK_YASAK_IZINLERI_GOCU).toBe(YENI_GOC_ADI);
    expect(await satirlar('select ad from tohum_gocu order by ad')).toEqual([
      { ad: GOC_ADI },
      { ad: YENI_GOC_ADI },
    ]);
    expect(sureMs).toBeLessThan(5000);
  });

  it('a) genel sayaç tablosunda tek satır vardır', async () => {
    expect(await satirlar('select id from yetki_surumu')).toEqual([{ id: 1 }]);
  });

  it('b) üstü olmayan ve silinmemiş tek grup vardır; adı Kök', async () => {
    expect(
      await satirlar(
        'select ad from grup where ust_grup_id is null and silinme_zamani is null',
      ),
    ).toEqual([{ ad: 'Kök' }]);
  });

  it('c) kodu temel ve superadmin olan iki rol vardır', async () => {
    expect(await satirlar('select kod, ad from rol order by kod')).toEqual([
      { kod: 'superadmin', ad: 'SuperAdmin' },
      { kod: 'temel', ad: 'Temel' },
    ]);
  });

  it('d) izin tablosu yönetim listesindeki her (kaynak, eylem) çiftini tam bir kez taşır', async () => {
    const izinler = (
      await satirlar<{ cift: string }>(
        "select kaynak || ':' || eylem as cift from izin",
      )
    ).map((s) => s.cift);

    expect(izinler.toSorted()).toEqual(YONETIM_IZINLERI.toSorted());
    expect(izinler).toHaveLength(29);
  });

  it('d) canlı yetenek sayısı 31dir: SuperAdmin için 29, Temel için 2', async () => {
    expect(
      await satirlar(
        `select r.kod as rol, count(*)::int as sayi
           from yetenek y join rol r on r.id = y.rol_id
          where y.silinme_zamani is null group by r.kod order by r.kod`,
      ),
    ).toEqual([
      { rol: 'superadmin', sayi: 29 },
      { rol: 'temel', sayi: 2 },
    ]);
  });

  it('d) yasakla ve teshis izinleri yalnız (Kök, SuperAdmin) kümesindedir; temel rolün kümesinde yoktur', async () => {
    expect(
      await satirlar(
        `select i.kaynak || ':' || i.eylem as cift, g.ust_grup_id, r.kod as rol
           from yetenek y join izin i on i.id = y.izin_id join rol r on r.id = y.rol_id
           join grup g on g.id = y.grup_id
          where i.kaynak || ':' || i.eylem = any($1)
          order by cift`,
        [YASAK_IZINLERI],
      ),
    ).toEqual([
      { cift: 'Yetenek:teshis', ust_grup_id: null, rol: 'superadmin' },
      { cift: 'Yetenek:yasakla', ust_grup_id: null, rol: 'superadmin' },
    ]);
  });

  it('e) (Kök, SuperAdmin) için her izne bir yetenek: bütün kayıtlar, birimler, kolonlar, sistem satırı, izin (giremez hayır), öncelik 0, köken goc, farklı tohum anahtarları', async () => {
    const yetenekler = await satirlar<{
      cift: string;
      sart: unknown;
      butun_kayitlar: boolean;
      butun_birimler: boolean;
      kolonlar: string[] | null;
      butun_kolonlar: boolean;
      sistem_satiri: boolean;
      giremez: boolean;
      oncelik: number;
      silinme_zamani: Date | null;
      koken: string;
      tohum_anahtari: string;
    }>(
      `select i.kaynak || ':' || i.eylem as cift, y.sart, y.butun_kayitlar, y.butun_birimler,
              y.kolonlar, y.butun_kolonlar, y.sistem_satiri, y.giremez, y.oncelik,
              y.silinme_zamani, y.koken, y.tohum_anahtari
         from yetenek y join izin i on i.id = y.izin_id join rol r on r.id = y.rol_id
         join grup g on g.id = y.grup_id
        where r.kod = 'superadmin' and g.ust_grup_id is null`,
    );

    expect(yetenekler.map((y) => y.cift).toSorted()).toEqual(
      YONETIM_IZINLERI.toSorted(),
    );
    for (const y of yetenekler) {
      expect(y).toEqual({
        cift: y.cift,
        sart: null,
        butun_kayitlar: true,
        butun_birimler: true,
        kolonlar: null,
        butun_kolonlar: true,
        sistem_satiri: true,
        giremez: false,
        oncelik: 0,
        silinme_zamani: null,
        koken: 'goc',
        tohum_anahtari: `kimlik:${y.cift}:superadmin`,
      });
    }
    expect(new Set(yetenekler.map((y) => y.tohum_anahtari)).size).toBe(
      yetenekler.length,
    );
  });

  it('f) (Kök, Temel) için oturum okuma ve kapatma yetenekleri şartlıdır ve sistem satırıdır; derleyici şartı isteyenin kimliğine çözer', async () => {
    const yetenekler = await satirlar<{
      id: string;
      grup_id: string;
      rol_id: string;
      kaynak: string;
      eylem: string;
      sart: YetenekSatiri['sart'];
      butun_kayitlar: boolean;
      butun_kolonlar: boolean;
      sistem_satiri: boolean;
      koken: string;
      tohum_anahtari: string;
    }>(
      `select y.id, y.grup_id, y.rol_id, i.kaynak, i.eylem, y.sart, y.butun_kayitlar,
              y.butun_kolonlar, y.sistem_satiri, y.koken, y.tohum_anahtari
         from yetenek y join izin i on i.id = y.izin_id join rol r on r.id = y.rol_id
         join grup g on g.id = y.grup_id
        where r.kod = 'temel' and g.ust_grup_id is null
        order by i.eylem`,
    );
    const sart = [
      { alan: 'kullaniciId', islec: 'esit', deger: { yerTutucu: 'isteyen' } },
    ];

    // Dizide toMatchObject uzunluğu da sınar: tam iki satır vardır; kimlik kolonları sınanmaz.
    expect(yetenekler).toMatchObject([
      {
        kaynak: 'Oturum',
        eylem: 'kapat',
        sart,
        butun_kayitlar: false,
        butun_kolonlar: true,
        sistem_satiri: true,
        koken: 'goc',
        tohum_anahtari: 'kimlik:Oturum:kapat:temel',
      },
      {
        kaynak: 'Oturum',
        eylem: 'oku',
        sart,
        butun_kayitlar: false,
        butun_kolonlar: true,
        sistem_satiri: true,
        koken: 'goc',
        tohum_anahtari: 'kimlik:Oturum:oku:temel',
      },
    ]);

    // Saklanan şart, yetki motorunun derleyicisinden geçer ve isteyenin kimliğine çözülür.
    const isteyen = '30000000-0000-4000-8000-000000000001';
    const { kurallar, derlenmeyenler } = yetenekleriDerle(
      {
        yetenekler: yetenekler.map((y) => ({
          yetenekId: y.id,
          grupId: y.grup_id,
          rolId: y.rol_id,
          kaynak: y.kaynak,
          eylem: y.eylem,
          sart: y.sart,
          butunKayitlar: y.butun_kayitlar,
          butunBirimler: false,
          kolonlar: [],
          butunKolonlar: y.butun_kolonlar,
        })),
        altGruplar: {},
      },
      isteyen,
      {
        alanlar: (tur) =>
          tur === 'Oturum' ? ['id', 'kullaniciId'] : undefined,
        alanTipleri: (tur) =>
          tur === 'Oturum'
            ? { id: 'kimlik', kullaniciId: 'kimlik' }
            : undefined,
      },
    );
    expect(derlenmeyenler).toEqual([]);
    expect(kurallar.map((k) => k.conditions)).toEqual([
      { AND: [{ kullaniciId: { equals: isteyen } }] },
      { AND: [{ kullaniciId: { equals: isteyen } }] },
    ]);
  });

  it('g) sistem aktörü kullanıcısı vardır: kullanıcı adı, telefon ve üyeliği yoktur', async () => {
    const aktorler = await satirlar(
      'select id, kullanici_adi, telefon, gorunen_ad from kullanici where sistem_aktoru',
    );
    const id = await sistemAktoru();

    expect(aktorler).toEqual([
      { id, kullanici_adi: null, telefon: null, gorunen_ad: 'kimlik' },
    ]);
    expect(
      await satirlar('select id from uyelik where kullanici_id = $1', [id]),
    ).toEqual([]);
  });

  it('h) superadmin kullanıcısının tam iki canlı üyeliği vardır ((Kök, Temel) ve (Kök, SuperAdmin)); parola sırrı satırı yoktur', async () => {
    expect(
      await satirlar(
        "select gorunen_ad, sistem_aktoru, telefon from kullanici where kullanici_adi = 'superadmin'",
      ),
    ).toEqual([
      { gorunen_ad: 'Sistem Yöneticisi', sistem_aktoru: false, telefon: null },
    ]);
    expect(
      await satirlar(
        `select g.ad as grup, g.ust_grup_id, r.kod as rol
           from uyelik u join kullanici k on k.id = u.kullanici_id
           join grup g on g.id = u.grup_id join rol r on r.id = u.rol_id
          where k.kullanici_adi = 'superadmin' and u.silinme_zamani is null
          order by r.kod`,
      ),
    ).toEqual([
      { grup: 'Kök', ust_grup_id: null, rol: 'superadmin' },
      { grup: 'Kök', ust_grup_id: null, rol: 'temel' },
    ]);
    expect(await satirlar('select kullanici_id from kullanici_sirri')).toEqual(
      [],
    );
  });

  it('i) ikinci koşu hiçbir şey uygulamaz ve hiçbir tablonun satır sayısını değiştirmez', async () => {
    const once = await satirSayilari();

    expect(await kosucu.kos()).toEqual([]);
    expect(await satirSayilari()).toEqual(once);
  });

  it('j) her yazma için işin adı yazan göçün adı (tohum:<göç>) olan ve yazanı sistem aktörü olan bir not vardır', async () => {
    const aktor = await sistemAktoru();
    // Yasak izinleri göçünün yazdığı satırlar: iki izin ve onların iki yeteneği.
    const yeniGocunSatirlari = new Set(
      (
        await satirlar<{ id: string }>(
          `select i.id from izin i where i.kaynak || ':' || i.eylem = any($1)
           union all
           select y.id from yetenek y join izin i on i.id = y.izin_id
            where i.kaynak || ':' || i.eylem = any($1)`,
          [YASAK_IZINLERI],
        )
      ).map((s) => s.id),
    );
    expect(yeniGocunSatirlari.size).toBe(4);
    // Her kaynak satırı bir oluşturma notu; tohum yardımcısı her kullanıcının sayısını artırır.
    const beklenen: string[] = [];
    for (const [tablo, kaynak] of Object.entries(KAYNAK_TABLOLARI)) {
      for (const { id } of await satirlar<{ id: string }>(
        `select id from "${tablo}"`,
      )) {
        beklenen.push(`${kaynak} ${id} olusturma`);
        if (tablo === 'kullanici') {
          beklenen.push(`${kaynak} ${id} guncelleme`);
        }
      }
    }
    const notlar = (
      await satirlar<{ govde: Record<string, unknown> }>(
        'select govde from outbox_iz',
      )
    ).map((s) => s.govde);

    expect(
      notlar
        .map(
          (n) =>
            `${String(n['kaynak'])} ${String(n['kayit_id'])} ${String(n['eylem'])}`,
        )
        .toSorted(),
    ).toEqual(beklenen.toSorted());
    for (const not of notlar) {
      expect(not).toMatchObject({
        is_adi: yeniGocunSatirlari.has(String(not['kayit_id']))
          ? YENI_IS_ADI
          : IS_ADI,
        kullanici_id: aktor,
      });
    }
  });
});

// İlk kurulum göçü daha önce uygulanmış veritabanı: yeni göç tek başına uygulanır; sonuç, iki göçün
// art arda uygulandığı yukarıdaki veritabanıyla (kimlikler ve zamanlar dışında) aynıdır.
describe('m) ilk kurulumu uygulanmış veritabanında yasak izinleri göçü', () => {
  let db2: TestDatabase;
  let moduleRef2: TestingModule;
  let gozlemci2: pg.Client;
  let gozlemci2Pid: number;

  beforeAll(async () => {
    db2 = await createTestDatabase([], { migrations: true });
    try {
      moduleRef2 = await modulKur(db2.url);
      gozlemci2 = new pg.Client({ connectionString: db2.url });
      await gozlemci2.connect();
      const [satir] = await satirlar<{ pid: number }>(
        'select pg_backend_pid() as pid',
        [],
        gozlemci2,
      );
      gozlemci2Pid = satir?.pid ?? -1;
    } catch (error) {
      await db2.drop();
      throw error;
    }
  });

  afterAll(async () => {
    await moduleRef2.close();
    const acikKalan = await kalanBaglantiSayisi(gozlemci2, db2.name, [
      gozlemci2Pid,
    ]);
    await gozlemci2.end();
    await db2.drop();
    expect(acikKalan).toBe(0);
    expect(await sunucudaVarMi(db2.name)).toBe(false);
  });

  it('m) önce yalnız ilk kurulum göçü (27 izin, 29 canlı yetenek), sonra koşucu yalnız yeni göçü uygular; döküm sıfırdan kurulumunkine eşittir; üçüncü koşu satır sayısını değiştirmez', async () => {
    // Uygulamanın kendi defterindeki ilk kurulum göçü, yalnız onu taşıyan bir deftere alınır.
    const ilkGoc = new TohumDefteri();
    for (const [ad, goc] of moduleRef2.get(TohumDefteri).sirayla()) {
      if (ad === KIMLIK_KURULUM_GOCU) {
        ilkGoc.bildir(ad, goc);
      }
    }
    expect(
      await new TohumKosucusu(moduleRef2.get(UnitOfWork), ilkGoc).kos(),
    ).toEqual([KIMLIK_KURULUM_GOCU]);
    expect(
      await satirlar(
        `select (select count(*) from izin)::int as izin,
                (select count(*) from yetenek where silinme_zamani is null)::int as yetenek`,
        [],
        gozlemci2,
      ),
    ).toEqual([{ izin: 27, yetenek: 29 }]);

    const kosucu2 = moduleRef2.get(TohumKosucusu);
    expect(await kosucu2.kos()).toEqual([KIMLIK_YASAK_IZINLERI_GOCU]);
    expect(await dokum(gozlemci2)).toEqual(await dokum(gozlemci));

    const once = await satirSayilari(gozlemci2);
    expect(await kosucu2.kos()).toEqual([]);
    expect(await satirSayilari(gozlemci2)).toEqual(once);
  });
});
