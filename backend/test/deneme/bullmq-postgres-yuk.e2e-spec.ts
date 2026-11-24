// GV-009 denemesi (Deneme B): bullmq 6.7.7'nin PostgreSQL arka ucunda aynı işlemde ekleme,
// bağlantı ve boşta yük, hata fırtınası ve temizlik. Üretim kodu değildir. Koşturma:
//   pnpm -C backend test:e2e test/deneme/bullmq-postgres-yuk.e2e-spec.ts --reporter=verbose
// Kurulum biçimi önceki denemeden (bullmq-postgres-temel.e2e-spec.ts) alındı. Testler gözlenen
// davranışı sabitler; ölçülen sayılar ve süreler test notu (annotate) olarak çıktıya yazılır.
// Her şey createTestDatabase ile açılan geçici veritabanlarında olur; Redis ayarı verilmez.
import net from 'node:net';
import { setTimeout as uyu } from 'node:timers/promises';
import {
  Queue,
  Worker,
  createPostgresBackend,
  runMigrations,
  type Job,
  type JobsOptions,
  type PostgresConnectionOptions,
  type PostgresPoolConfig,
} from 'bullmq';
import pg from 'pg';
import { createTestDatabase, type TestDatabase } from '../test-database.js';

const SEMA = 'kuyruk';

// Süreçte açılan her TCP bağlantısı; Redis'e gidilmediğini göstermek için hedef portları okunur.
const tcpBaglantisi = vi.spyOn(net.Socket.prototype, 'connect');

let anaDb: TestDatabase;
let anaBaglanti: PostgresPoolConfig;

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

function kuyrukAc(ad: string, baglanti: PostgresPoolConfig = anaBaglanti) {
  return new Queue(ad, { connection: baglanti }, createPostgresBackend);
}

function isciAc(
  ad: string,
  isle: (is: Job) => Promise<unknown>,
  ayar: { drainDelay?: number; concurrency?: number } = {},
  baglanti: PostgresPoolConfig = anaBaglanti,
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

async function gocKos(url: string, sema: string): Promise<void> {
  const istemci = new pg.Client({ connectionString: url });
  await istemci.connect();
  try {
    await runMigrations(istemci, sema);
  } finally {
    await istemci.end();
  }
}

beforeAll(async () => {
  anaDb = await createTestDatabase();
  // Kurulum burada yarıda kalırsa geçici veritabanı sunucuda kalmaz.
  try {
    anaBaglanti = { connectionString: anaDb.url, schema: SEMA };
    await gocKos(anaDb.url, SEMA);
  } catch (error) {
    await anaDb.drop();
    throw error;
  }
});

afterAll(async () => {
  await anaDb.drop();
  // Bütün dosya boyunca yalnız PostgreSQL portuna bağlanıldı; Redis'e (6379, 6390) gidilmedi.
  expect(baglanilanPortlar()).toEqual(
    new Set([Number(new URL(anaDb.url).port)]),
  );
});

describe('S6 aynı işlemde ekleme', () => {
  it('S6 (i): açık arayüz uygulamanın istemcisini ya da işlemini almaz: Queue.add yalnız ad, veri ve iş seçeneği alır; connection seçeneğinin tipi pg.Client ve pg.PoolClient kabul etmez, kurulu @types/pg ile pg.Pool da tip zorlamasız verilemez (tip denetimiyle doğrulanır)', () => {
    type Ekle = Kuyruk['add'];
    expectTypeOf<Parameters<Ekle>['length']>().toEqualTypeOf<2 | 3>();
    expectTypeOf<Parameters<Ekle>[2]>().toEqualTypeOf<
      JobsOptions | undefined
    >();
    // createPostgresBackend ile açılan Queue ve Worker'ın connection seçeneğinin tipi.
    expectTypeOf<
      Parameters<typeof createPostgresBackend>[1]['connection']
    >().toEqualTypeOf<PostgresConnectionOptions>();
    expectTypeOf<pg.Client>().not.toExtend<PostgresConnectionOptions>();
    expectTypeOf<pg.PoolClient>().not.toExtend<PostgresConnectionOptions>();
    // Belge hazır bir pg.Pool verilebilir der; kurulu @types/pg ile pg.Pool da bu tipe uymaz
    // (PoolClient.on imzası paketin PgPoolClient arayüzüyle uyuşmaz), vermek tip zorlaması ister.
    expectTypeOf<pg.Pool>().not.toExtend<PostgresConnectionOptions>();
  });

  it(`S6 (ii): belgelenmemiş iç SQL işlevi ${SEMA}.add_job uygulamanın işleminde çağrılırsa iş işleme bağlanır: ROLLBACK edilince iş kalmaz ve işlenmez; COMMIT edilmeden önce başka bağlantıdan görünmez, COMMIT sonrası Worker onu işler`, async ({
    annotate,
  }) => {
    const ad = 's6-islem';
    const kuyruk = kuyrukAc(ad);
    const islenen: unknown[] = [];
    const isci = isciAc(ad, (is) => {
      islenen.push(is.data);
      return Promise.resolve('bitti');
    });
    const istemci = new pg.Client({ connectionString: anaDb.url });
    await istemci.connect();
    // Paketin add_job.sql komut dosyasıyla aynı çağrı (Queue.add bunu kendi havuzunda koşar).
    const ekle = async (kimlik: string, veri: object): Promise<string> => {
      const { rows } = await istemci.query<{ id: string }>(
        `select ${SEMA}.add_job($1, $2, 'is', $3::jsonb, '{}'::jsonb, 0, 0, $4, 1,
                null, null, null, null, null, false) as id`,
        [ad, kimlik, JSON.stringify(veri), Date.now()],
      );
      return String(rows[0]?.id);
    };
    const kendiOturumunda = async (kimlik: string): Promise<unknown> => {
      const { rows } = await istemci.query<{ state: string }>(
        `select state from ${SEMA}.job where queue = $1 and id = $2`,
        [ad, kimlik],
      );
      return rows[0]?.state;
    };
    try {
      await isci.waitUntilReady();

      await istemci.query('begin');
      expect(await ekle('geri-alinan', { sira: 1 })).toBe('geri-alinan');
      expect(await kendiOturumunda('geri-alinan')).toBe('waiting');
      expect(await kuyruk.getJobState('geri-alinan')).toBe('unknown');
      await istemci.query('rollback');
      await uyu(500);
      expect(await kuyruk.getJobState('geri-alinan')).toBe('unknown');
      expect(await kendiOturumunda('geri-alinan')).toBeUndefined();

      await istemci.query('begin');
      expect(await ekle('onaylanan', { sira: 2 })).toBe('onaylanan');
      await uyu(500);
      expect(await kuyruk.getJobState('onaylanan')).toBe('unknown');
      expect(islenen).toEqual([]);
      const onay = Date.now();
      await istemci.query('commit');
      await durumOlur(kuyruk, 'onaylanan', 'completed', 5_000);
      await annotate(`COMMIT -> completed: ${String(Date.now() - onay)} ms`);

      expect(islenen).toEqual([{ sira: 2 }]);
      expect(await sayilar(kuyruk)).toEqual({ completed: 1 });
    } finally {
      await istemci.end();
      await isci.close();
      await kuyruk.close();
    }
  }, 15_000);
});

describe('S7 bağlantı ve boşta yük', () => {
  // Ölçülen veritabanında yalnız ölçülen Queue ve Worker'lar olsun diye ayrı geçici veritabanı;
  // gözlemci kendi işlemleri sayıya karışmasın diye ana veritabanına bağlanır.
  let olcumDb: TestDatabase;
  let gozlemci: pg.Client;
  // pg-pool'un boşta bağlantı kapama süresi varsayılan 10 sn; Queue'nun açılışta açtığı
  // bağlantı kapansın diye ölçümden önce bu kadar beklenir.
  const YERLESME_MS = 12_000;
  const PENCERE_MS = 10_000;

  beforeAll(async () => {
    olcumDb = await createTestDatabase();
    try {
      await gocKos(olcumDb.url, SEMA);
      gozlemci = new pg.Client({ connectionString: anaDb.url });
      await gozlemci.connect();
    } catch (error) {
      await olcumDb.drop();
      throw error;
    }
  });

  afterAll(async () => {
    await gozlemci.end();
    await olcumDb.drop();
  });

  async function baglantiSayisi(): Promise<number> {
    const { rows } = await gozlemci.query<{ sayi: number }>(
      `select count(*)::int as sayi from pg_stat_activity
        where datname = $1 and backend_type = 'client backend'`,
      [olcumDb.name],
    );
    return rows[0]?.sayi ?? -1;
  }

  async function baglantiDagilimi(
    veritabani: string,
  ): Promise<{ ad: string; durum: string; sorgu: string; sayi: number }[]> {
    const { rows } = await gozlemci.query<{
      ad: string;
      durum: string;
      sorgu: string;
      sayi: number;
    }>(
      // Paketin .sql komutları yorum satırlarıyla başlar; sorgunun kendisi görünsün diye atılır.
      `select application_name as ad, coalesce(state, '') as durum,
              left(btrim(regexp_replace(query, '^(\\s*--[^\\n]*\\n)+', ''), E' \\n'), 30) as sorgu,
              count(*)::int as sayi
         from pg_stat_activity
        where datname = $1 and backend_type = 'client backend'
        group by 1, 2, 3 order by 1, 2, 3`,
      [veritabani],
    );
    return rows;
  }

  async function onaylananIslem(): Promise<number> {
    const { rows } = await gozlemci.query<{ sayi: string }>(
      'select xact_commit as sayi from pg_stat_database where datname = $1',
      [olcumDb.name],
    );
    return Number(rows[0]?.sayi);
  }

  it.for([{ n: 1 }, { n: 5 }])(
    'S7: $n Queue ve $n Worker boştayken bağlantı sayısı ve 10 sn içinde onaylanan işlem sayısı (pg_stat_activity, pg_stat_database.xact_commit)',
    { timeout: 60_000 },
    async ({ n }, { annotate }) => {
      const olcumBaglanti = { connectionString: olcumDb.url, schema: SEMA };
      const adlar = Array.from(
        { length: n },
        (_, i) => `s7-${String(n)}-${String(i)}`,
      );
      const kuyruklar = adlar.map((ad) => kuyrukAc(ad, olcumBaglanti));
      const isciler = adlar.map((ad) =>
        isciAc(ad, () => Promise.resolve('bitti'), {}, olcumBaglanti),
      );
      try {
        await Promise.all(
          [...kuyruklar, ...isciler].map((k) => k.waitUntilReady()),
        );
        const acilista = await baglantiSayisi();
        await uyu(YERLESME_MS);

        const ilkIslem = await onaylananIslem();
        const baslangic = Date.now();
        const ornekler: number[] = [];
        while (Date.now() - baslangic < PENCERE_MS) {
          ornekler.push(await baglantiSayisi());
          await uyu(1_000);
        }
        const islem = (await onaylananIslem()) - ilkIslem;
        const sure = Date.now() - baslangic;
        const dagilim = await baglantiDagilimi(olcumDb.name);

        await annotate(
          `açılışta ${String(acilista)} bağlantı; boşta (${String(YERLESME_MS)} ms sonra) her saniye: ${JSON.stringify(ornekler)}; ${String(sure)} ms içinde xact_commit farkı: ${String(islem)}`,
        );
        await annotate(`bağlantı dağılımı: ${JSON.stringify(dagilim)}`);

        // Boşta Worker başına 3 bağlantı kalır: adı kuyruk adı olan LISTEN bağlantısı ve
        // has_waiting_job ile next_delay yoklamalarının aynı anda kullandığı 2 havuz bağlantısı.
        // Queue'nun havuz bağlantısı boşta 10 sn sonra kapanmıştır.
        expect(ornekler).toEqual(ornekler.map(() => 3 * n));
        expect(
          dagilim
            .filter((d) => adlar.includes(d.ad))
            .map((d) => [d.ad, d.durum, d.sorgu, d.sayi]),
        ).toEqual(adlar.map((ad) => [ad, 'idle', 'LISTEN bullmq_jobs;', 1]));
        // Boştaki Worker'lar aralıklı sorgu atar: işlem sayısı sıfır değildir.
        expect(islem).toBeGreaterThan(0);
      } finally {
        await Promise.all(isciler.map((i) => i.close()));
        await Promise.all(kuyruklar.map((k) => k.close()));
      }
    },
  );

  it('S7: boştaki Worker yeni işi LISTEN/NOTIFY ile öğrenir: drainDelay 60 sn iken eklenen iş 1 sn içinde işlenir', async ({
    annotate,
  }) => {
    const ad = 's7-uyandirma';
    const kuyruk = kuyrukAc(ad);
    const isci = isciAc(ad, () => Promise.resolve('bitti'), {
      drainDelay: 60,
    });
    try {
      await isci.waitUntilReady();
      // Worker ilk yoklamasını yapıp beklemeye geçsin.
      await uyu(1_000);
      const dinleyen = (await baglantiDagilimi(anaDb.name)).filter(
        (d) => d.ad === ad,
      );

      const ekleme = Date.now();
      const is = await kuyruk.add('is', { sira: 1 });
      await durumOlur(kuyruk, String(is.id), 'completed', 5_000);
      const sure = Date.now() - ekleme;
      await annotate(
        `Worker bağlantısı: ${JSON.stringify(dinleyen)}; add -> completed: ${String(sure)} ms`,
      );

      expect(dinleyen).toEqual([
        { ad, durum: 'idle', sorgu: 'LISTEN bullmq_jobs;', sayi: 1 },
      ]);
      expect(sure).toBeLessThan(1_000);
    } finally {
      await isci.close();
      await kuyruk.close();
    }
  }, 15_000);
});

describe('S8 hata fırtınası', () => {
  const IS_SAYISI = 200;
  const OLCUM_SAYISI = 50;

  // Fırtına bu makinede 0,3-1,1 sn sürdü; 50 ölçüm onun içine sığsın diye ara vermeden art arda alınır.
  async function sorguSureleri(istemci: pg.Client): Promise<number[]> {
    const sureler: number[] = [];
    for (let i = 0; i < OLCUM_SAYISI; i += 1) {
      const t0 = performance.now();
      await istemci.query('select 1');
      sureler.push(performance.now() - t0);
    }
    return sureler;
  }

  function ozet(sureler: number[]): { ortanca: number; enBuyuk: number } {
    const sirali = [...sureler].sort((a, b) => a - b);
    const orta = sirali.length / 2;
    const ortanca =
      ((sirali[Math.floor(orta - 0.5)] ?? 0) +
        (sirali[Math.floor(orta)] ?? 0)) /
      2;
    return {
      ortanca: Number(ortanca.toFixed(2)),
      enBuyuk: Number((sirali.at(-1) ?? 0).toFixed(2)),
    };
  }

  it(`S8: hep hata atan ${String(IS_SAYISI)} iş (attempts 3, sabit 10 ms backoff, concurrency 10) işlenirken aynı veritabanında select 1 süresi ölçülür (tek makine, kaba ölçü, eşik yok); fırtına biter ve ${String(IS_SAYISI)} iş failed kalır`, async ({
    annotate,
  }) => {
    const ad = 's8-firtina';
    const kuyruk = kuyrukAc(ad);
    const istemci = new pg.Client({ connectionString: anaDb.url });
    await istemci.connect();
    let deneme = 0;
    let isci: ReturnType<typeof isciAc> | undefined;
    try {
      const once = await sorguSureleri(istemci);

      await kuyruk.addBulk(
        Array.from({ length: IS_SAYISI }, (_, i) => ({
          name: 'is',
          data: { sira: i },
          opts: { attempts: 3, backoff: { type: 'fixed', delay: 10 } },
        })),
      );
      const baslangic = Date.now();
      isci = isciAc(
        ad,
        () => {
          deneme += 1;
          return Promise.reject(new Error('hep hata'));
        },
        { concurrency: 10 },
      );
      await bekle('fırtına başlar', 5_000, () => deneme > 0);
      const sirasinda = await sorguSureleri(istemci);
      const olcumSonundaDeneme = deneme;

      await bekle(
        `${String(IS_SAYISI)} iş failed`,
        120_000,
        async () =>
          (await kuyruk.getJobCounts('failed'))['failed'] === IS_SAYISI,
      );
      const firtinaSuresi = Date.now() - baslangic;

      await annotate(
        `select 1 önce: ${JSON.stringify(ozet(once))} ms; fırtına sırasında: ${JSON.stringify(ozet(sirasinda))} ms; ölçüm bittiğinde ${String(olcumSonundaDeneme)}/${String(IS_SAYISI * 3)} deneme yapılmıştı; fırtına ${String(firtinaSuresi)} ms sürdü, toplam deneme ${String(deneme)}`,
      );
      expect(await sayilar(kuyruk)).toEqual({ failed: IS_SAYISI });
    } finally {
      await isci?.close();
      await istemci.end();
      await kuyruk.close();
    }
  }, 180_000);
});

describe('S9 temizlik', () => {
  const IS_SAYISI = 100;

  // Şemadaki her tablonun satır sayısı (sıfır olanlar atlanır).
  async function tabloSatirlari(sema: string): Promise<Record<string, number>> {
    const istemci = new pg.Client({ connectionString: anaDb.url });
    await istemci.connect();
    try {
      const { rows } = await istemci.query<{ tablo: string; satir: number }>(
        `select c.relname as tablo,
                (xpath('/row/n/text()', query_to_xml(
                  format('select count(*) as n from %I.%I', n.nspname, c.relname),
                  false, true, '')))[1]::text::int as satir
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = $1 and c.relkind in ('r', 'p')
          order by 1`,
        [sema],
      );
      return Object.fromEntries(
        rows.filter((r) => r.satir > 0).map((r) => [r.tablo, r.satir]),
      );
    } finally {
      await istemci.end();
    }
  }

  // Her durum kendi şemasında koşar; tablo sayıları başka testlerle karışmaz.
  it.for([
    {
      sema: 's9_tamam_yok',
      durum: 'completed',
      secenek: 'yok',
      opts: {},
      kalan: IS_SAYISI,
    },
    {
      sema: 's9_tamam_true',
      durum: 'completed',
      secenek: 'removeOnComplete: true',
      opts: { removeOnComplete: true },
      kalan: 0,
    },
    {
      sema: 's9_tamam_10',
      durum: 'completed',
      secenek: 'removeOnComplete: 10',
      opts: { removeOnComplete: 10 },
      kalan: 10,
    },
    {
      sema: 's9_hata_yok',
      durum: 'failed',
      secenek: 'yok',
      opts: {},
      kalan: IS_SAYISI,
    },
    {
      sema: 's9_hata_true',
      durum: 'failed',
      secenek: 'removeOnFail: true',
      opts: { removeOnFail: true },
      kalan: 0,
    },
    {
      sema: 's9_hata_10',
      durum: 'failed',
      secenek: 'removeOnFail: 10',
      opts: { removeOnFail: 10 },
      kalan: 10,
    },
  ] satisfies {
    sema: string;
    durum: 'completed' | 'failed';
    secenek: string;
    opts: JobsOptions;
    kalan: number;
  }[])(
    `S9: ${String(IS_SAYISI)} iş $durum olduktan sonra, seçenek $secenek iken job tablosunda $kalan satır kalır`,
    { timeout: 30_000 },
    async ({ sema, durum, opts, kalan }, { annotate }) => {
      await gocKos(anaDb.url, sema);
      const baglanti = { connectionString: anaDb.url, schema: sema };
      const kuyruk = kuyrukAc('s9', baglanti);
      let biten = 0;
      const isci = isciAc(
        's9',
        () =>
          durum === 'failed'
            ? Promise.reject(new Error('bilerek'))
            : Promise.resolve('bitti'),
        {},
        baglanti,
      );
      isci.on('completed', () => {
        biten += 1;
      });
      isci.on('failed', () => {
        biten += 1;
      });
      try {
        await kuyruk.addBulk(
          Array.from({ length: IS_SAYISI }, (_, i) => ({
            name: 'is',
            data: { sira: i },
            opts,
          })),
        );
        await bekle(
          `${String(IS_SAYISI)} iş ${durum}`,
          20_000,
          () => biten === IS_SAYISI,
        );
      } finally {
        await isci.close();
        await kuyruk.close();
      }

      const satirlar = await tabloSatirlari(sema);
      await annotate(`${sema} tabloları: ${JSON.stringify(satirlar)}`);
      expect(satirlar['job'] ?? 0).toBe(kalan);
      // Seçenek yalnız job satırını siler; işin olay satırları (en az added, waiting, active
      // ve bitiş) event tablosunda kalır.
      expect(satirlar['event']).toBeGreaterThanOrEqual(4 * IS_SAYISI);
    },
  );
});
