// GV-008 denemesi (Deneme A): bullmq 6.7.7'nin PostgreSQL arka ucu (createPostgresBackend,
// runMigrations). Üretim kodu değildir. Koşturma:
//   pnpm -C backend test:e2e test/deneme/bullmq-postgres-temel.e2e-spec.ts --reporter=verbose
// Testler gözlenen davranışı sabitler: davranış değişirse test kırılır, adı yanlış kalmaz.
// Ölçülen sayılar ve süreler test notu (annotate) olarak çıktıya yazılır.
// Her şey createTestDatabase ile açılan geçici veritabanlarında olur; Redis ayarı verilmez.
import net from 'node:net';
import { setTimeout as uyu } from 'node:timers/promises';
import {
  Queue,
  Worker,
  createPostgresBackend,
  runMigrations,
  type Job,
} from 'bullmq';
import pg from 'pg';
import { createTestDatabase, type TestDatabase } from '../test-database.js';

const SEMA = 'kuyruk';
// S4: kilit ve takılma (stalled) denetimi aralığı, varsayılan 30 sn yerine küçük tutulur.
const KILIT_MS = 1000;
const TAKILMA_MS = 1000;

// Süreçte açılan her TCP bağlantısı; Redis'e gidilmediğini göstermek için hedef portları okunur.
const tcpBaglantisi = vi.spyOn(net.Socket.prototype, 'connect');

let anaDb: TestDatabase;
let baglanti: { connectionString: string; schema: string };

function baglanilanPortlar(): Set<unknown> {
  return new Set(
    tcpBaglantisi.mock.calls.map((args: unknown[]) => {
      // pg connect(port, host) çağırır; net.connect normalleştirilmiş [seçenek, ...] dizisi verir.
      const ilk = args[0];
      const secenek = Array.isArray(ilk) ? (ilk as unknown[])[0] : ilk;
      return typeof secenek === 'object' && secenek !== null
        ? (secenek as { port?: unknown }).port
        : secenek;
    }),
  );
}

async function bekle(
  ne: string,
  sinirMs: number,
  kosul: () => Promise<boolean> | boolean,
): Promise<void> {
  const son = Date.now() + sinirMs;
  while (!(await kosul())) {
    if (Date.now() > son) {
      throw new Error(`${ne}: ${String(sinirMs)} ms içinde gerçekleşmedi`);
    }
    await uyu(25);
  }
}

function kuyrukAc(ad: string) {
  return new Queue(ad, { connection: baglanti }, createPostgresBackend);
}

function isciAc(
  ad: string,
  isle: (is: Job) => Promise<unknown>,
  ayar: { lockDuration?: number; stalledInterval?: number } = {},
) {
  return new Worker(
    ad,
    isle,
    { connection: baglanti, ...ayar },
    createPostgresBackend,
  );
}

type Kuyruk = ReturnType<typeof kuyrukAc>;

// Sıfır olmayan durum sayıları; toplam iş sayısını ve işin hangi durumda olduğunu birlikte gösterir.
async function sayilar(kuyruk: Kuyruk): Promise<Record<string, number>> {
  const hepsi = await kuyruk.getJobCounts();
  return Object.fromEntries(Object.entries(hepsi).filter(([, n]) => n > 0));
}

async function durumOlur(
  kuyruk: Kuyruk,
  kimlik: string,
  durum: string,
  sinirMs: number,
): Promise<void> {
  await bekle(
    `${kimlik} ${durum}`,
    sinirMs,
    async () => (await kuyruk.getJobState(kimlik)) === durum,
  );
}

// --- S1 ölçüm sorguları (sistem kataloğu) ---

async function semalar(istemci: pg.Client): Promise<string[]> {
  const { rows } = await istemci.query<{ nspname: string }>(
    `select nspname from pg_namespace
      where nspname not like 'pg\\_%' and nspname <> 'information_schema'
      order by 1`,
  );
  return rows.map((r) => r.nspname);
}

async function uzantilar(istemci: pg.Client): Promise<string[]> {
  const { rows } = await istemci.query<{ extname: string }>(
    'select extname from pg_extension order by 1',
  );
  return rows.map((r) => r.extname);
}

interface SemaNesneleri {
  tablo: number;
  islev: number;
  dizin: number;
  siraUreteci: number;
  siraliTur: number;
}

async function semaNesneleri(
  istemci: pg.Client,
  sema: string,
): Promise<SemaNesneleri | undefined> {
  const { rows } = await istemci.query<SemaNesneleri>(
    `select
       (select count(*)::int from pg_class c where c.relnamespace = n.oid and c.relkind in ('r', 'p')) as tablo,
       (select count(*)::int from pg_proc p where p.pronamespace = n.oid) as islev,
       (select count(*)::int from pg_class c where c.relnamespace = n.oid and c.relkind = 'i') as dizin,
       (select count(*)::int from pg_class c where c.relnamespace = n.oid and c.relkind = 'S') as "siraUreteci",
       (select count(*)::int from pg_type t where t.typnamespace = n.oid and t.typtype = 'e') as "siraliTur"
     from pg_namespace n where n.nspname = $1`,
    [sema],
  );
  return rows[0];
}

// public şemasındaki her ilişki, işlev ve tür.
async function publicNesneSayisi(istemci: pg.Client): Promise<number> {
  const { rows } = await istemci.query<{ sayi: number }>(
    `select ((select count(*) from pg_class where relnamespace = 'public'::regnamespace)
           + (select count(*) from pg_proc where pronamespace = 'public'::regnamespace)
           + (select count(*) from pg_type where typnamespace = 'public'::regnamespace))::int as sayi`,
  );
  return rows[0]?.sayi ?? -1;
}

// S1 testleri ana veritabanını kirletmesin diye her biri kendi geçici veritabanını açıp siler.
async function geciciVeritabaninda(
  is: (istemci: pg.Client, db: TestDatabase) => Promise<void>,
): Promise<void> {
  const db = await createTestDatabase();
  const istemci = new pg.Client({ connectionString: db.url });
  try {
    await istemci.connect();
    await is(istemci, db);
  } finally {
    await istemci.end();
    await db.drop();
  }
}

// bullmq 6.7.7 göç defterinin son sürümü.
const SON_GOC = 11;
const BEKLENEN_NESNELER: SemaNesneleri = {
  tablo: 15,
  islev: 78,
  dizin: 33,
  siraUreteci: 4,
  siraliTur: 2,
};

beforeAll(async () => {
  anaDb = await createTestDatabase();
  // Kurulum burada yarıda kalırsa geçici veritabanı sunucuda kalmaz.
  try {
    baglanti = { connectionString: anaDb.url, schema: SEMA };
    const istemci = new pg.Client({ connectionString: anaDb.url });
    await istemci.connect();
    try {
      await runMigrations(istemci, SEMA);
    } finally {
      await istemci.end();
    }
  } catch (error) {
    await anaDb.drop();
    throw error;
  }
});

afterAll(async () => {
  await anaDb.drop();
  // Bütün dosya boyunca yalnız PostgreSQL portuna bağlanıldı; Redis'e (6379, 6390) gidilmedi.
  expect(baglanilanPortlar()).toEqual(new Set([Number(new URL(anaDb.url).port)]));
});

describe('S1 kurulum (runMigrations)', () => {
  it(`S1: şema verilmezse runMigrations bullmq şemasına ${String(BEKLENEN_NESNELER.tablo)} tablo, ${String(BEKLENEN_NESNELER.islev)} işlev, ${String(BEKLENEN_NESNELER.dizin)} dizin kurar; uzantı istemez, public boş kalır`, async ({
    annotate,
  }) => {
    await geciciVeritabaninda(async (istemci) => {
      expect(await semalar(istemci)).toEqual(['public']);
      const oncekiUzantilar = await uzantilar(istemci);

      expect(await runMigrations(istemci)).toBe(SON_GOC);

      const nesneler = await semaNesneleri(istemci, 'bullmq');
      await annotate(`bullmq şeması: ${JSON.stringify(nesneler)}`);
      expect(await semalar(istemci)).toEqual(['bullmq', 'public']);
      expect(nesneler).toEqual(BEKLENEN_NESNELER);
      expect(await publicNesneSayisi(istemci)).toBe(0);
      expect(oncekiUzantilar).toEqual(['plpgsql']);
      expect(await uzantilar(istemci)).toEqual(oncekiUzantilar);
    });
  }, 30_000);

  it('S1: runMigrations(istemci, "kuyruk") aynı nesneleri kuyruk şemasına kurar; bullmq şeması açılmaz, public boş kalır', async ({
    annotate,
  }) => {
    await geciciVeritabaninda(async (istemci) => {
      expect(await runMigrations(istemci, SEMA)).toBe(SON_GOC);

      const nesneler = await semaNesneleri(istemci, SEMA);
      await annotate(`kuyruk şeması: ${JSON.stringify(nesneler)}`);
      expect(await semalar(istemci)).toEqual([SEMA, 'public']);
      expect(nesneler).toEqual(BEKLENEN_NESNELER);
      expect(await publicNesneSayisi(istemci)).toBe(0);
      expect(await uzantilar(istemci)).toEqual(['plpgsql']);
    });
  }, 30_000);

  it('S1: veritabanında CREATE yetkisi olmayan rol göçü koşamaz (42501, CREATE SCHEMA); CREATE ON DATABASE verilince süper kullanıcı olmadan göç tamamlanır', async ({
    annotate,
  }) => {
    // Sunucuda yeni rol açmamak için hazır tanımlı, CREATE yetkisi olmayan pg_signal_backend
    // rolüne geçilir; verilen yetki ve rolün sahip olduğu nesneler geçici veritabanıyla silinir.
    await geciciVeritabaninda(async (istemci, db) => {
      await istemci.query('set role pg_signal_backend');
      const hata: unknown = await runMigrations(istemci, SEMA).catch(
        (e: unknown) => e,
      );
      await annotate(`yetkisiz rolle: ${String(hata)}`);
      expect(hata).toMatchObject({
        code: '42501',
        message: `permission denied for database ${db.name}`,
      });
      expect(await semalar(istemci)).toEqual(['public']);

      await istemci.query('reset role');
      await istemci.query(
        `grant create on database ${db.name} to pg_signal_backend`,
      );
      await istemci.query('set role pg_signal_backend');
      expect(await runMigrations(istemci, SEMA)).toBe(SON_GOC);
      expect(await semaNesneleri(istemci, SEMA)).toEqual(BEKLENEN_NESNELER);
      await istemci.query('reset role');
    });
  }, 30_000);
});

describe('S2 akış', () => {
  it('S2: schema seçenekli bağlantıyla Queue.add edilen iş Worker tarafından tamamlanır; Redis ayarı yok, yalnız PostgreSQL portuna bağlanılır', async () => {
    const kuyruk = kuyrukAc('s2-akis');
    const isci = isciAc('s2-akis', (is) =>
      Promise.resolve({ ikiKati: (is.data as { sayi: number }).sayi * 2 }),
    );
    try {
      const is = await kuyruk.add('ikiyle-carp', { sayi: 21 });
      const kimlik = String(is.id);
      await durumOlur(kuyruk, kimlik, 'completed', 5_000);

      expect((await kuyruk.getJob(kimlik))?.returnvalue).toEqual({
        ikiKati: 42,
      });
      expect(await sayilar(kuyruk)).toEqual({ completed: 1 });
      expect(baglanilanPortlar()).toEqual(
        new Set([Number(new URL(anaDb.url).port)]),
      );
    } finally {
      await isci.close();
      await kuyruk.close();
    }

    // schema seçeneği uygulandı: ana veritabanında bullmq şeması yok, public boş.
    const istemci = new pg.Client({ connectionString: anaDb.url });
    await istemci.connect();
    try {
      expect(await semalar(istemci)).toEqual([SEMA, 'public']);
      expect(await publicNesneSayisi(istemci)).toBe(0);
    } finally {
      await istemci.end();
    }
  }, 10_000);
});

describe('S3 kopya engeli (aynı jobId)', () => {
  it('S3: iş beklerken aynı jobId ile ikinci add yeni iş üretmez; ilk işin verisi kalır', async () => {
    const kuyruk = kuyrukAc('s3-bekleyen');
    try {
      await kuyruk.add('is', { sira: 1 }, { jobId: 'tek' });
      const ikinci = await kuyruk.add('is', { sira: 2 }, { jobId: 'tek' });

      expect(ikinci.id).toBe('tek');
      expect(await sayilar(kuyruk)).toEqual({ waiting: 1 });
      expect((await kuyruk.getJob('tek'))?.data).toEqual({ sira: 1 });
    } finally {
      await kuyruk.close();
    }
  }, 10_000);

  it('S3: iş işlenirken aynı jobId ile ikinci add yeni iş üretmez; iş bir kez işlenir', async () => {
    const kuyruk = kuyrukAc('s3-islenen');
    let cagri = 0;
    let birak = (): void => undefined;
    const kapi = new Promise<void>((coz) => {
      birak = coz;
    });
    const isci = isciAc('s3-islenen', async () => {
      cagri += 1;
      await kapi;
    });
    try {
      await kuyruk.add('is', { sira: 1 }, { jobId: 'tek' });
      await durumOlur(kuyruk, 'tek', 'active', 5_000);

      await kuyruk.add('is', { sira: 2 }, { jobId: 'tek' });
      expect(await sayilar(kuyruk)).toEqual({ active: 1 });

      birak();
      await durumOlur(kuyruk, 'tek', 'completed', 5_000);
      expect(cagri).toBe(1);
      expect(await sayilar(kuyruk)).toEqual({ completed: 1 });
      expect((await kuyruk.getJob('tek'))?.data).toEqual({ sira: 1 });
    } finally {
      await isci.close();
      await kuyruk.close();
    }
  }, 10_000);

  it('S3: iş tamamlanmış ve silinmemişken aynı jobId ile ikinci add yeni iş üretmez', async () => {
    const kuyruk = kuyrukAc('s3-tamamlanan');
    const isci = isciAc('s3-tamamlanan', () => Promise.resolve('bitti'));
    try {
      await kuyruk.add('is', { sira: 1 }, { jobId: 'tek' });
      await durumOlur(kuyruk, 'tek', 'completed', 5_000);
      // İşçi kapalıyken yeni iş üretilseydi waiting durumunda görünürdü.
      await isci.close();

      await kuyruk.add('is', { sira: 2 }, { jobId: 'tek' });
      expect(await sayilar(kuyruk)).toEqual({ completed: 1 });
      expect((await kuyruk.getJob('tek'))?.data).toEqual({ sira: 1 });
    } finally {
      await isci.close();
      await kuyruk.close();
    }
  }, 10_000);

  it('S3: iş başarısızken aynı jobId ile ikinci add yeni iş üretmez; iş failed kalır', async () => {
    const kuyruk = kuyrukAc('s3-basarisiz');
    const isci = isciAc('s3-basarisiz', () =>
      Promise.reject(new Error('bilerek')),
    );
    try {
      await kuyruk.add('is', { sira: 1 }, { jobId: 'tek' });
      await durumOlur(kuyruk, 'tek', 'failed', 5_000);
      await isci.close();

      await kuyruk.add('is', { sira: 2 }, { jobId: 'tek' });
      expect(await sayilar(kuyruk)).toEqual({ failed: 1 });
      const is = await kuyruk.getJob('tek');
      expect(is?.data).toEqual({ sira: 1 });
      expect(is?.failedReason).toBe('bilerek');
    } finally {
      await isci.close();
      await kuyruk.close();
    }
  }, 10_000);

  it('S3: removeOnComplete açıkken tamamlanıp silinen işin kimliğiyle yeniden add yeni iş üretir', async () => {
    const kuyruk = kuyrukAc('s3-silinen');
    let cagri = 0;
    const isci = isciAc('s3-silinen', () => {
      cagri += 1;
      return Promise.resolve('bitti');
    });
    try {
      await kuyruk.add(
        'is',
        { sira: 1 },
        { jobId: 'tek', removeOnComplete: true },
      );
      await bekle(
        'tek işlenip silinir',
        5_000,
        async () =>
          cagri === 1 && (await kuyruk.getJobState('tek')) === 'unknown',
      );
      await isci.close();

      await kuyruk.add(
        'is',
        { sira: 2 },
        { jobId: 'tek', removeOnComplete: true },
      );
      expect(await sayilar(kuyruk)).toEqual({ waiting: 1 });
      expect((await kuyruk.getJob('tek'))?.data).toEqual({ sira: 2 });
    } finally {
      await isci.close();
      await kuyruk.close();
    }
  }, 10_000);
});

describe('S4 dayanıklılık', () => {
  it('S4: Worker yokken eklenen iş bekler, Worker açılınca işlenir', async ({
    annotate,
  }) => {
    const kuyruk = kuyrukAc('s4-isci-yok');
    try {
      const is = await kuyruk.add('is', { sira: 1 });
      const kimlik = String(is.id);
      await uyu(500);
      expect(await kuyruk.getJobState(kimlik)).toBe('waiting');

      const acilis = Date.now();
      const isci = isciAc('s4-isci-yok', () => Promise.resolve('bitti'));
      try {
        await durumOlur(kuyruk, kimlik, 'completed', 5_000);
        await annotate(
          `Worker açılışından tamamlanmaya: ${String(Date.now() - acilis)} ms`,
        );
      } finally {
        await isci.close();
      }
    } finally {
      await kuyruk.close();
    }
  }, 10_000);

  it(`S4: işlenirken Worker close(true) ile zorla kapatılırsa iş kaybolmaz, takılma denetimiyle (lockDuration ${String(KILIT_MS)} ms, stalledInterval ${String(TAKILMA_MS)} ms) 10 sn içinde ikinci Worker'da yeniden işlenir`, async ({
    annotate,
  }) => {
    const ayar = { lockDuration: KILIT_MS, stalledInterval: TAKILMA_MS };
    const kuyruk = kuyrukAc('s4-zorla');
    let ilkBasladi = false;
    // İlk işçinin işi hiç bitmez: kapatıldığında iş hâlâ elindedir.
    const ilkIsci = isciAc(
      's4-zorla',
      async () => {
        ilkBasladi = true;
        await new Promise<never>(() => undefined);
      },
      ayar,
    );
    let ikinciBaslangic = 0;
    let ikinci: ReturnType<typeof isciAc> | undefined;
    try {
      const is = await kuyruk.add('is', { sira: 1 });
      const kimlik = String(is.id);
      await bekle('ilk işçi işe başlar', 5_000, () => ilkBasladi);

      const kapanis = Date.now();
      await ilkIsci.close(true);
      expect(await kuyruk.getJobState(kimlik)).toBe('active');

      ikinci = isciAc(
        's4-zorla',
        () => {
          ikinciBaslangic = Date.now();
          return Promise.resolve('bitti');
        },
        ayar,
      );
      await durumOlur(kuyruk, kimlik, 'completed', 10_000);

      const sure = ikinciBaslangic - kapanis;
      const bitmis = await kuyruk.getJob(kimlik);
      await annotate(
        `close(true) -> yeniden işleme: ${String(sure)} ms; stalledCounter=${String(bitmis?.stalledCounter)}, attemptsStarted=${String(bitmis?.attemptsStarted)}`,
      );
      expect(sure).toBeGreaterThan(0);
      expect(sure).toBeLessThan(10_000);
      expect(bitmis?.stalledCounter).toBe(1);
      expect(await sayilar(kuyruk)).toEqual({ completed: 1 });
    } finally {
      await ilkIsci.close(true);
      await ikinci?.close();
      await kuyruk.close();
    }
  }, 20_000);
});

describe('S5 yeniden deneme', () => {
  it('S5: attempts 3 ve üstel backoff (100 ms) verilen, hep hata atan iş 3 kez denenir, failed kalır; Queue deneme sayısını ve hata nedenini verir', async ({
    annotate,
  }) => {
    const kuyruk = kuyrukAc('s5-yeniden');
    const zamanlar: number[] = [];
    const isci = isciAc('s5-yeniden', () => {
      zamanlar.push(Date.now());
      return Promise.reject(new Error('hep hata'));
    });
    try {
      const is = await kuyruk.add(
        'is',
        { sira: 1 },
        { attempts: 3, backoff: { type: 'exponential', delay: 100 } },
      );
      const kimlik = String(is.id);
      await durumOlur(kuyruk, kimlik, 'failed', 10_000);
      // Bir sonraki üstel bekleme (400 ms) geçse de yeni deneme olmaz.
      await uyu(600);

      const araliklar = zamanlar.slice(1).map((z, i) => z - (zamanlar[i] ?? z));
      await annotate(
        `deneme sayısı ${String(zamanlar.length)}, denemeler arası ${JSON.stringify(araliklar)} ms`,
      );
      expect(zamanlar).toHaveLength(3);
      expect(araliklar[0]).toBeGreaterThanOrEqual(100);
      expect(araliklar[1]).toBeGreaterThanOrEqual(200);
      expect(await kuyruk.getJobState(kimlik)).toBe('failed');

      const basarisiz = await kuyruk.getFailed();
      expect(basarisiz.map((b) => b.id)).toEqual([kimlik]);
      expect(basarisiz[0]?.attemptsMade).toBe(3);
      expect(basarisiz[0]?.failedReason).toBe('hep hata');
    } finally {
      await isci.close();
      await kuyruk.close();
    }
  }, 15_000);
});
