// İz aktarıcısının dayanıklılığı iki geçici veritabanında sınanır: biri asıl şemanın, öbürü iz
// şemasının göçleri uygulanmış olarak. Notlar outbox_iz'e doğrudan SQL ile eklenir. İz istemcisi
// ürün koduyla aynı bağlantı ayarıyla (süre sınırlarıyla) kurulur.
import { createHook } from 'node:async_hooks';
import { randomUUID, randomUUIDv7 } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { izBaglantiAyari } from '../src/shared/database/database.module.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import { PrismaClient as IzPrismaClient } from '../src/shared/database/iz/generated/client.js';
import { RepoKayitlari } from '../src/shared/database/registrar.js';
import {
  ISLEM_SURE_SINIRI_MS,
  UnitOfWork,
} from '../src/shared/database/unit-of-work.js';
import { Dongu } from '../src/shared/messaging/aktarim/dongu.js';
import {
  BOS_BEKLEME_MS,
  IzAktarici,
  PartiHatasi,
} from '../src/shared/observability/iz/iz-aktarici.js';
import { outboxIzRepoKaydet } from '../src/shared/observability/iz/outbox-iz.repository.js';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

type Govde = Record<string, unknown>;

function govdeUret(degisiklik: Govde = {}): Govde {
  return {
    istek_id: randomUUID(),
    kullanici_id: randomUUID(),
    uyelik_id: randomUUID(),
    yetenek_id: randomUUID(),
    is_adi: 'ornek.guncelle',
    baslatan_kullanici_id: randomUUID(),
    veri_sahibi_kullanici_id: randomUUID(),
    kaynak: 'ornek',
    kayit_id: randomUUID(),
    eylem: 'guncelleme',
    degisen: { ad: { eski: 'a', yeni: 'b' } },
    ...degisiklik,
  };
}

interface NotGirdisi {
  govde?: Govde;
  // SQL ifadesi; örnek: "clock_timestamp() - interval '1 hour'".
  olusturma?: string;
}

let asil: TestDatabase;
let iz: TestDatabase;
let asilSql: pg.Client;
let izSql: pg.Client;
let prisma: PrismaClient;
let izPrisma: IzPrismaClient;
let uow: UnitOfWork;
let aktarici: IzAktarici;

async function notEkle(notlar: readonly NotGirdisi[]): Promise<string[]> {
  const kimlikler: string[] = [];
  for (const not of notlar) {
    const id = randomUUIDv7();
    await asilSql.query(
      `insert into outbox_iz (id, surum, govde, olusturma_zamani)
       values ($1, 1, $2, ${not.olusturma ?? 'clock_timestamp()'})`,
      [id, JSON.stringify(not.govde ?? govdeUret())],
    );
    kimlikler.push(id);
  }
  return kimlikler;
}

async function izKimlikleri(): Promise<string[]> {
  const sonuc = await izSql.query<{ id: string }>(
    'select id from degisiklik_kaydi order by id',
  );
  return sonuc.rows.map((satir) => satir.id);
}

async function aktarilmislar(): Promise<string[]> {
  const sonuc = await asilSql.query<{ id: string }>(
    'select id from outbox_iz where aktarim_zamani is not null order by id',
  );
  return sonuc.rows.map((satir) => satir.id);
}

// Geçişin dokunmaması gereken dört alan; zamanlar metin olarak (mikrosaniyesiyle) okunur.
async function notAlanlari(): Promise<unknown[]> {
  const sonuc = await asilSql.query<Record<string, unknown>>(
    `select id, aktarim_zamani::text, deneme_sayisi, sonraki_deneme_zamani::text, son_hata
       from outbox_iz order by id`,
  );
  return sonuc.rows;
}

// Koşul sağlanana kadar kısa aralıkla yoklar; süre dolarsa son durumu döner.
async function bekle(
  kosul: () => Promise<boolean>,
  enCokMs: number,
): Promise<boolean> {
  const son = performance.now() + enCokMs;
  while (performance.now() < son) {
    if (await kosul()) return true;
    await new Promise((coz) => setTimeout(coz, 20));
  }
  return kosul();
}

function uyku(ms: number): Promise<void> {
  return new Promise((coz) => setTimeout(coz, ms));
}

// Döngünün kurduğu ve henüz ateşlenmemiş ya da kaldırılmamış zamanlayıcılar. Sürecin bütün
// zamanlayıcıları sayılmaz: vitest'in kendi zamanlayıcıları test sırasında açılıp kapanır.
// Zamanlayıcı kurulurken çağrı yığını Dongu.planla'dan geçiyorsa izlenir; ateşlenince ya da
// kaldırılınca Node'un destroy olayıyla kümeden çıkar.
const donguZamanlayicilari = new Set<number>();
createHook({
  init(kimlik, tur) {
    if (tur === 'Timeout' && new Error().stack?.includes('Dongu.planla')) {
      donguZamanlayicilari.add(kimlik);
    }
  },
  destroy(kimlik) {
    donguZamanlayicilari.delete(kimlik);
  },
}).enable();

// Kaldırılan zamanlayıcının destroy olayı eşzamanlı gelmez; bir setImmediate turu beklenir.
async function acikDonguZamanlayicisi(): Promise<number> {
  await new Promise((coz) => setImmediate(coz));
  return donguZamanlayicilari.size;
}

// Prisma'nın ham sorgu hatasından SQLSTATE: meta.driverAdapterError.cause.originalCode.
function sqlstate(hata: unknown): unknown {
  const neden = (hata as { cause?: { meta?: Record<string, unknown> } }).cause;
  const surucu = neden?.meta?.['driverAdapterError'] as
    { cause?: { originalCode?: unknown } } | undefined;
  return surucu?.cause?.originalCode;
}

beforeAll(async () => {
  asil = await createTestDatabase([], { migrations: true });
  iz = await createTestDatabase([], { izMigrations: true });
  asilSql = new pg.Client({ connectionString: asil.url });
  izSql = new pg.Client({ connectionString: iz.url });
  await asilSql.connect();
  await izSql.connect();
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: asil.url }),
  });
  izPrisma = new IzPrismaClient({
    adapter: new PrismaPg(izBaglantiAyari(iz.url)),
  });
  const kayitlar = new RepoKayitlari();
  outboxIzRepoKaydet(kayitlar);
  uow = new UnitOfWork(prisma, kayitlar);
  aktarici = new IzAktarici(uow, izPrisma);
});

afterAll(async () => {
  // Açılış yarıda kaldıysa yalnız açılanlar kapatılır; asıl hatanın yanına ikinci hata eklenmez.
  for (const client of [
    asilSql as pg.Client | undefined,
    izSql as pg.Client | undefined,
  ]) {
    await client?.end();
  }
  await (prisma as PrismaClient | undefined)?.$disconnect();
  await (izPrisma as IzPrismaClient | undefined)?.$disconnect();
  const veritabanlari = [
    asil as TestDatabase | undefined,
    iz as TestDatabase | undefined,
  ];
  const adlar = veritabanlari.map((veritabani) => veritabani?.name);
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    // Silmeden önce: test veritabanlarına açık bağlantı kalmamıştır (sunucu süreci kapanışı
    // istemciden az sonra bitirebilir; kısa süre yoklanır).
    const baglantiYok = await bekle(async () => {
      const acik = await sunucu.query(
        'select 1 from pg_stat_activity where datname = any($1)',
        [adlar],
      );
      return acik.rows.length === 0;
    }, 2000);
    for (const veritabani of veritabanlari) {
      await veritabani?.drop();
    }
    expect(baglantiYok).toBe(true);
    const kalan = await sunucu.query(
      'select 1 from pg_database where datname = any($1)',
      [adlar],
    );
    expect(kalan.rows).toHaveLength(0);
  } finally {
    await sunucu.end();
  }
});

beforeEach(async () => {
  await asilSql.query('truncate outbox_iz');
  await izSql.query('truncate degisiklik_kaydi');
});

describe('a) parti hatası', () => {
  it('iz tablosu yokken (adı değiştirilmiş) geçiş PartiHatasi atar; notların dört alanı değişmez; engel kalkınca hepsi aktarılır', async () => {
    const kimlikler = await notEkle([{}, {}, {}]);
    // Bir not önceden denenmiş gibi hazırlanır: değişmeyen alanlar boş olmayan değerlerle de sınanır.
    await asilSql.query(
      `update outbox_iz set deneme_sayisi = 1, son_hata = 'SQLSTATE 22P02',
              sonraki_deneme_zamani = clock_timestamp() - interval '1 minute'
        where id = $1`,
      [kimlikler[0]],
    );
    const once = await notAlanlari();
    // Engel: iz tablosunun adı değiştirilir, ekleme "tablo yok" (42P01) hatası alır.
    await izSql.query(
      'alter table degisiklik_kaydi rename to degisiklik_kaydi_gizli',
    );
    let hata: unknown;
    try {
      hata = await aktarici.gecis().catch((e: unknown) => e);
    } finally {
      await izSql.query(
        'alter table degisiklik_kaydi_gizli rename to degisiklik_kaydi',
      );
    }
    expect(hata).toBeInstanceOf(PartiHatasi);
    expect(sqlstate(hata)).toBe('42P01');
    expect(await notAlanlari()).toEqual(once);
    expect(await izKimlikleri()).toEqual([]);

    expect(await aktarici.gecis()).toBe(3);
    expect(await izKimlikleri()).toEqual([...kimlikler].sort());
    expect(await aktarilmislar()).toEqual([...kimlikler].sort());
  });

  it('iz veritabanına bağlanılamazken (dinlenmeyen kapı) geçiş PartiHatasi atar; notlar değişmez; bağlanabilen aktarıcı hepsini aktarır', async () => {
    const kimlikler = await notEkle([{}, {}]);
    const once = await notAlanlari();
    // Engel: iz istemcisi kimsenin dinlemediği 1 numaralı kapıya bağlanmaya çalışır.
    const kapaliAdres = new URL(iz.url);
    kapaliAdres.port = '1';
    const ulasilamayan = new IzPrismaClient({
      adapter: new PrismaPg(izBaglantiAyari(kapaliAdres.toString())),
    });
    try {
      const hata = await new IzAktarici(uow, ulasilamayan)
        .gecis()
        .catch((e: unknown) => e);
      expect(hata).toBeInstanceOf(PartiHatasi);
    } finally {
      await ulasilamayan.$disconnect();
    }
    expect(await notAlanlari()).toEqual(once);

    expect(await aktarici.gecis()).toBe(2);
    expect(await aktarilmislar()).toEqual([...kimlikler].sort());
  });
});

describe('b) satır hatası', () => {
  it('beş nottan biri bozukken dördü aktarılır; bozuk satır ertelenir, damgası gövde değeri taşımaz; yeniden denenince aralık büyür', async ({
    annotate,
  }) => {
    // Bozukluk: kullanici_id uuid değil; iz tablosunun uuid kolonuna dönüşmez (22P02).
    const bozukGovde = govdeUret({ kullanici_id: 'gizli-bozuk-deger-7f3a' });
    const [bozuk = '', ...saglamlar] = await notEkle([
      { govde: bozukGovde },
      {},
      {},
      {},
      {},
    ]);

    expect(await aktarici.gecis()).toBe(5);
    expect(await izKimlikleri()).toEqual([...saglamlar].sort());
    expect(await aktarilmislar()).toEqual([...saglamlar].sort());

    const bozukSatir = async () =>
      (
        await asilSql.query<{
          aktarim_zamani: string | null;
          deneme_sayisi: number;
          aralik_sn: number;
          son_hata: string | null;
        }>(
          `select aktarim_zamani, deneme_sayisi, son_hata,
                  extract(epoch from sonraki_deneme_zamani - clock_timestamp())::float8 as aralik_sn
             from outbox_iz where id = $1`,
          [bozuk],
        )
      ).rows;

    const [ilk] = await bozukSatir();
    expect(ilk).toMatchObject({ aktarim_zamani: null, deneme_sayisi: 1 });
    expect(ilk?.aralik_sn).toBeGreaterThan(0);
    expect(ilk?.son_hata).toBe('SQLSTATE 22P02');
    for (const deger of Object.values(bozukGovde)) {
      if (typeof deger === 'string') {
        expect(ilk?.son_hata).not.toContain(deger);
      }
    }

    // Hemen ardından gelen geçiş ertelenen notu almaz.
    expect(await aktarici.gecis()).toBe(0);

    await asilSql.query(
      `update outbox_iz set sonraki_deneme_zamani = clock_timestamp() - interval '1 second'
        where id = $1`,
      [bozuk],
    );
    expect(await aktarici.gecis()).toBe(1);
    const [ikinci] = await bozukSatir();
    expect(ikinci).toMatchObject({ aktarim_zamani: null, deneme_sayisi: 2 });
    expect(ikinci?.aralik_sn).toBeGreaterThan(ilk?.aralik_sn ?? Infinity);
    expect(await izKimlikleri()).not.toContain(bozuk);
    await annotate(
      `ilk aralık ${ilk?.aralik_sn.toFixed(1) ?? '-'} sn, ikinci aralık ${ikinci?.aralik_sn.toFixed(1) ?? '-'} sn`,
    );
  });

  it('zorunlu alanı eksik gövde (23502) de satır hatasıdır; öbür not aktarılır', async () => {
    const eksikGovde = govdeUret();
    delete eksikGovde['kullanici_id'];
    const [eksik = '', saglam = ''] = await notEkle([
      { govde: eksikGovde },
      {},
    ]);

    expect(await aktarici.gecis()).toBe(2);
    expect(await aktarilmislar()).toEqual([saglam]);
    const satir = await asilSql.query(
      'select deneme_sayisi, son_hata from outbox_iz where id = $1',
      [eksik],
    );
    expect(satir.rows).toEqual([
      { deneme_sayisi: 1, son_hata: 'SQLSTATE 23502' },
    ]);
  });
});

describe('c) süre sınırı', () => {
  it('iz tablosu başka bağlantıdan kilitliyken geçiş 5 saniyeden kısa sürede PartiHatasi ile döner; asıl veritabanında açık işlem kalmaz; kilit kalkınca aktarılır', async ({
    annotate,
  }) => {
    const kimlikler = await notEkle([{}, {}, {}]);
    const once = await notAlanlari();
    // Engel: ayrı bir bağlantı iz tablosunu SHARE kipinde kilitler; ekleme (ROW EXCLUSIVE) bekler.
    const kilitleyen = new pg.Client({ connectionString: iz.url });
    await kilitleyen.connect();
    let sure: number;
    let acikIslem: number;
    try {
      await kilitleyen.query('begin');
      await kilitleyen.query('lock table degisiklik_kaydi in share mode');

      const baslangic = performance.now();
      const hata = await aktarici.gecis().catch((e: unknown) => e);
      sure = performance.now() - baslangic;
      expect(hata).toBeInstanceOf(PartiHatasi);
      expect(['55P03', '57014']).toContain(sqlstate(hata));

      // Kilit hâlâ tutulurken: asıl veritabanında bu sorgunun kendisi dışında işlemi açık oturum yoktur.
      const sonuc = await asilSql.query<{ sayi: number }>(
        `select count(*)::int as sayi from pg_stat_activity
          where datname = current_database() and pid <> pg_backend_pid()
            and xact_start is not null`,
      );
      acikIslem = sonuc.rows[0]?.sayi ?? -1;
      await annotate(
        `kilitliyken geçiş süresi: ${sure.toFixed(0)} ms; SQLSTATE ${String(sqlstate(hata))}; asıl veritabanında açık işlem: ${String(acikIslem)}`,
      );
    } finally {
      await kilitleyen.query('rollback');
      await kilitleyen.end();
    }
    expect(sure).toBeLessThan(ISLEM_SURE_SINIRI_MS);
    expect(acikIslem).toBe(0);
    expect(await notAlanlari()).toEqual(once);

    expect(await aktarici.gecis()).toBe(3);
    expect(await aktarilmislar()).toEqual([...kimlikler].sort());
  });

  it('tek tek denemeler asıl işlemin süresine sığmazsa kalan notlar dokunulmadan sonraki geçişe bırakılır', async ({
    annotate,
  }) => {
    // Yavaşlık: bu test veritabanında, is_adi 'yavas' olan her satırın eklenmesi 0,8 sn uyutulur
    // (iz süre sınırının altında). Bozuk not ilk eklenir; toplu yazım ona gelince 22P02 ile hemen
    // düşer, satırlar tek tek denenir ve her yavaş satır 0,8 sn sürer.
    await izSql.query(`
      create function yavaslat() returns trigger language plpgsql as $$
      begin
        if new.is_adi = 'yavas' then perform pg_sleep(0.8); end if;
        return new;
      end $$;
      create trigger yavaslat before insert on degisiklik_kaydi
        for each row execute function yavaslat();`);
    try {
      const [bozuk = '', ...yavaslar] = await notEkle([
        { govde: govdeUret({ kullanici_id: 'bozuk' }) },
        ...Array.from({ length: 8 }, () => ({
          govde: govdeUret({ is_adi: 'yavas' }),
        })),
      ]);

      const baslangic = performance.now();
      const sonuclanan = await aktarici.gecis();
      const sure = performance.now() - baslangic;
      await annotate(
        `9 notluk geçiş ${sure.toFixed(0)} ms sürdü; sonuçlanan not: ${String(sonuclanan)}`,
      );

      expect(sure).toBeLessThan(ISLEM_SURE_SINIRI_MS);
      expect(sonuclanan).toBeGreaterThan(1);
      expect(sonuclanan).toBeLessThan(9);
      const aktarilan = await aktarilmislar();
      expect(aktarilan).toHaveLength(sonuclanan - 1);
      const dokunulmamis = await asilSql.query(
        `select 1 from outbox_iz
          where aktarim_zamani is null and deneme_sayisi = 0
            and sonraki_deneme_zamani is null and son_hata is null`,
      );
      expect(dokunulmamis.rows).toHaveLength(9 - sonuclanan);
      expect(await izKimlikleri()).toEqual([...aktarilan].sort());
      expect(await izKimlikleri()).not.toContain(bozuk);
      expect(yavaslar).toEqual(expect.arrayContaining(aktarilan));
    } finally {
      await izSql.query(
        'drop trigger yavaslat on degisiklik_kaydi; drop function yavaslat()',
      );
    }

    // Yavaşlık kalkınca kalan notlar sonraki geçişte aktarılır (bozuk not ertelenmiştir).
    await aktarici.gecis();
    expect(await aktarilmislar()).toHaveLength(8);
  });
});

describe('d) döngü', () => {
  it('başlatılınca çağrısız aktarır; 250 not beklemeden aktarılır; durdurulunca not alınmaz ve açık zamanlayıcı kalmaz', async ({
    annotate,
  }) => {
    // Bekleme aralığı kısaltılmaz: ürünün BOS_BEKLEME_MS değeri kullanılır.
    const dongulu = new IzAktarici(uow, izPrisma);

    // Temizlik de döngünün içinde koşar: 4 gün önce aktarılmış not, başlatınca çağrısız silinir.
    const [eski = ''] = await notEkle([{}]);
    await asilSql.query(
      `update outbox_iz set aktarim_zamani = clock_timestamp() - interval '4 days' where id = $1`,
      [eski],
    );

    dongulu.baslat();
    // Ölçüm döngünün zamanlayıcılarını görür: aktarım ve temizlik döngüleri birer tane kurmuştur.
    expect(donguZamanlayicilari.size).toBe(2);
    try {
      const sonradan = await notEkle([{}, {}, {}]);
      expect(
        await bekle(
          async () => (await izKimlikleri()).length === 3,
          BOS_BEKLEME_MS * 3,
        ),
      ).toBe(true);
      expect(await izKimlikleri()).toEqual([...sonradan].sort());
      const eskiKaldi = await asilSql.query(
        'select 1 from outbox_iz where id = $1',
        [eski],
      );
      expect(eskiKaldi.rows).toHaveLength(0);
    } finally {
      await dongulu.durdur();
    }

    // 250 not durmuş döngüye eklenir; başlatılınca 100, 100, 50 aktarılır. Dolu partiler arasında
    // beklenseydi süre en az bir BOS_BEKLEME_MS olurdu.
    await asilSql.query(
      `insert into outbox_iz (id, surum, govde)
       select gen_random_uuid(), 1, $1::jsonb from generate_series(1, 250)`,
      [JSON.stringify(govdeUret())],
    );
    const baslangic = performance.now();
    dongulu.baslat();
    let sure: number;
    try {
      expect(
        await bekle(
          async () => (await aktarilmislar()).length === 253,
          BOS_BEKLEME_MS * 3,
        ),
      ).toBe(true);
      sure = performance.now() - baslangic;
    } finally {
      await dongulu.durdur();
    }
    await annotate(
      `250 notun döngüyle aktarımı: ${sure.toFixed(0)} ms (BOS_BEKLEME_MS ${String(BOS_BEKLEME_MS)} ms)`,
    );
    expect(sure).toBeLessThan(BOS_BEKLEME_MS);

    expect(await acikDonguZamanlayicisi()).toBe(0);
    const [gec = ''] = await notEkle([{}]);
    await uyku(BOS_BEKLEME_MS * 2);
    expect(await aktarilmislar()).not.toContain(gec);
    expect(await acikDonguZamanlayicisi()).toBe(0);
  });

  it('Dongu: hata atan adımdan sonra bekleme ikiye katlanır ve üst sınırda durur; true dönen adım beklemeden yinelenir', async ({
    annotate,
  }) => {
    // Aralıklar bu parçanın kurucusuna testte açıkça verilir; iz aktarıcısının değerleri değişmez.
    const zamanlar: number[] = [];
    const sonuclar: ('hata' | boolean)[] = [
      'hata',
      'hata',
      'hata',
      true,
      false,
    ];
    const dongu = new Dongu({
      adim: () => {
        zamanlar.push(performance.now());
        const sonuc = sonuclar.shift() ?? false;
        return sonuc === 'hata'
          ? Promise.reject(new Error('deneme'))
          : Promise.resolve(sonuc);
      },
      bosBeklemeMs: 60_000,
      hataBeklemeTabanMs: 40,
      hataBeklemeUstMs: 100,
    });
    dongu.baslat();
    expect(donguZamanlayicilari.size).toBe(1);
    try {
      expect(
        await bekle(() => Promise.resolve(zamanlar.length === 5), 2000),
      ).toBe(true);
    } finally {
      await dongu.durdur();
    }
    expect(await acikDonguZamanlayicisi()).toBe(0);
    const araliklar = zamanlar
      .slice(1)
      .map((zaman, sira) => zaman - (zamanlar[sira] ?? 0));
    await annotate(
      `adımlar arası: ${araliklar.map((a) => a.toFixed(0)).join(', ')} ms`,
    );
    const [h1 = 0, h2 = 0, h3 = 0, hemen = Infinity] = araliklar;
    expect(h1).toBeGreaterThanOrEqual(38);
    expect(h2).toBeGreaterThanOrEqual(78);
    expect(h3).toBeGreaterThanOrEqual(98);
    expect(h3).toBeLessThan(160);
    expect(hemen).toBeLessThan(30);
  });
});

describe('e) temizlik', () => {
  it('aktarımı 4 gün önce olan silinir; 2 gün önce olan kalır; 10 gün önce oluşturulmuş ama aktarılmamış kalır', async () => {
    const [dortGun = '', ikiGun = '', aktarilmamis = ''] = await notEkle([
      {},
      {},
      { olusturma: "clock_timestamp() - interval '10 days'" },
    ]);
    await asilSql.query(
      `update outbox_iz set aktarim_zamani = clock_timestamp() - interval '4 days' where id = $1`,
      [dortGun],
    );
    await asilSql.query(
      `update outbox_iz set aktarim_zamani = clock_timestamp() - interval '2 days' where id = $1`,
      [ikiGun],
    );

    expect(await aktarici.temizle()).toBe(1);

    const kalan = await asilSql.query<{ id: string }>(
      'select id from outbox_iz order by id',
    );
    expect(kalan.rows.map((satir) => satir.id)).toEqual(
      [ikiGun, aktarilmamis].sort(),
    );
  });
});

describe('f) ölçüler', () => {
  it('en eski denenmemiş notun yaşı ve denenmiş bekleyen sayısı; denenmiş bozuk satır yaşı etkilemez', async () => {
    expect(await aktarici.olculer()).toEqual({
      enEskiDenenmemisYasSn: null,
      denenmisBekleyenSayisi: 0,
    });

    // 1 saat önceki bozuk not denenip ertelenir; 2 saat önceki sağlam not aktarılır.
    await notEkle([
      {
        govde: govdeUret({ kullanici_id: 'bozuk' }),
        olusturma: "clock_timestamp() - interval '1 hour'",
      },
      { olusturma: "clock_timestamp() - interval '2 hours'" },
    ]);
    expect(await aktarici.gecis()).toBe(2);
    // Denenmemiş iki not: 10 ve 5 dakika önce.
    await notEkle([
      { olusturma: "clock_timestamp() - interval '10 minutes'" },
      { olusturma: "clock_timestamp() - interval '5 minutes'" },
    ]);

    const olculer = await aktarici.olculer();
    expect(olculer.denenmisBekleyenSayisi).toBe(1);
    expect(olculer.enEskiDenenmemisYasSn).toBeGreaterThanOrEqual(600);
    expect(olculer.enEskiDenenmemisYasSn).toBeLessThan(660);
  });
});
