// İş kuyruğu kapısı ve BullMQ-PostgreSQL bağdaştırıcısı (GV-013). Koşturma:
//   pnpm -C backend test:e2e test/kuyruk.e2e-spec.ts --reporter=verbose
// Testler kapıya yalnız arayüzden (IS_KUYRUGU) ulaşır; bullmq sınıfları burada kullanılmaz,
// doğrulama sorguları pg ile atılır. Her şey createTestDatabase ile açılan geçici
// veritabanlarında olur. Yeniden deneme aralığı testten değiştirilmez: testler ürün kodundaki
// sabitlerle (5 deneme, 1 sn'den başlayan üstel aralık) koşar.
import net from 'node:net';
import { setTimeout as uyu } from 'node:timers/promises';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import { DENEME_SAYISI } from '../src/shared/messaging/kuyruk/bullmq-is-kuyrugu.js';
import {
  IS_KUYRUGU,
  type IsKuyrugu,
  type KuyrukIsi,
} from '../src/shared/messaging/kuyruk/is-kuyrugu.js';
import { kuyrukGocunuKos } from '../src/shared/messaging/kuyruk/kuyruk-gocu.js';
import { KuyrukModule } from '../src/shared/messaging/kuyruk/kuyruk.module.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

// Süreçte açılan her TCP bağlantısı; Redis'e gidilmediğini göstermek için hedef portları okunur.
const tcpBaglantisi = vi.spyOn(net.Socket.prototype, 'connect');

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

let db: TestDatabase;
// Doğrulama sorgularını atan bağlantı; bağlantı sayımında kendisi sayılmaz.
let gozlemci: pg.Client;
const asilAdres = process.env['DATABASE_URL'];

// Modül bağlantı adresini DATABASE_URL'den okur; bu dosyada geçici veritabanını gösterir.
async function kuyrukModuluAc(): Promise<{
  kuyruk: IsKuyrugu;
  kapat: () => Promise<void>;
}> {
  const modul = await Test.createTestingModule({
    imports: [KuyrukModule],
  }).compile();
  return {
    kuyruk: modul.get<IsKuyrugu>(IS_KUYRUGU),
    // Uygulamanın kapanışı: onApplicationShutdown kancaları koşar.
    kapat: () => modul.close(),
  };
}

async function isSatirlari(
  kuyruk: string,
): Promise<{ id: string; state: string }[]> {
  const { rows } = await gozlemci.query<{ id: string; state: string }>(
    'select id, state from kuyruk.job where queue = $1 order by id',
    [kuyruk],
  );
  return rows;
}

async function baglantiSayisi(): Promise<number> {
  const { rows } = await gozlemci.query<{ sayi: number }>(
    `select count(*)::int as sayi from pg_stat_activity
      where datname = $1 and backend_type = 'client backend' and pid <> pg_backend_pid()`,
    [db.name],
  );
  return rows[0]?.sayi ?? -1;
}

beforeAll(async () => {
  db = await createTestDatabase();
  // Kurulum burada yarıda kalırsa geçici veritabanı sunucuda kalmaz.
  try {
    await kuyrukGocunuKos(db.url);
    gozlemci = new pg.Client({ connectionString: db.url });
    await gozlemci.connect();
    process.env['DATABASE_URL'] = db.url;
  } catch (error) {
    await db.drop();
    throw error;
  }
});

afterAll(async () => {
  process.env['DATABASE_URL'] = asilAdres;
  await gozlemci.end();
  await db.drop();
  // Bütün dosya boyunca yalnız PostgreSQL portuna bağlanıldı; Redis'e gidilmedi.
  expect(baglanilanPortlar()).toEqual(new Set([Number(new URL(db.url).port)]));
});

describe('a) göç', () => {
  it('a) kuyruk göçü işlevi tabloları kuyruk şemasına kurar; başka şema açılmaz, public şemasında nesne yoktur', async ({
    annotate,
  }) => {
    const gocDb = await createTestDatabase();
    const istemci = new pg.Client({ connectionString: gocDb.url });
    try {
      await istemci.connect();
      const semalar = async (): Promise<string[]> => {
        const { rows } = await istemci.query<{ nspname: string }>(
          `select nspname from pg_namespace
            where nspname not like 'pg\\_%' and nspname <> 'information_schema'
            order by 1`,
        );
        return rows.map((r) => r.nspname);
      };
      expect(await semalar()).toEqual(['public']);

      await kuyrukGocunuKos(gocDb.url);

      const { rows: tablolar } = await istemci.query<{ relname: string }>(
        `select relname from pg_class
          where relnamespace = 'kuyruk'::regnamespace and relkind in ('r', 'p')
          order by 1`,
      );
      const { rows: publicNesne } = await istemci.query<{ sayi: number }>(
        `select ((select count(*) from pg_class where relnamespace = 'public'::regnamespace)
               + (select count(*) from pg_proc where pronamespace = 'public'::regnamespace)
               + (select count(*) from pg_type where typnamespace = 'public'::regnamespace))::int as sayi`,
      );
      await annotate(
        `kuyruk şemasının tabloları: ${JSON.stringify(tablolar.map((t) => t.relname))}`,
      );
      expect(await semalar()).toEqual(['kuyruk', 'public']);
      expect(tablolar.map((t) => t.relname)).toContain('job');
      expect(publicNesne[0]?.sayi).toBe(0);
    } finally {
      await istemci.end();
      await gocDb.drop();
    }
  }, 30_000);
});

describe('b-e) kuyruk davranışı', () => {
  it('b) konan iş, kuyruğu dinleyen işleyiciye kimliği, adı ve verisiyle ulaşır ve bir kez işlenir', async () => {
    const { kuyruk, kapat } = await kuyrukModuluAc();
    const gelen: KuyrukIsi[] = [];
    try {
      const is = { kimlik: 'b-is', ad: 'selamla', veri: { kime: 'dünya' } };
      const dinleyici = await kuyruk.dinle('b-akis', (i) => {
        gelen.push(i);
        return Promise.resolve();
      });
      await kuyruk.koy('b-akis', is);
      await bekle('iş işlenir', 5_000, () => gelen.length === 1);
      // İkinci bir işleme olmadığını görmek için kısa süre daha beklenir.
      await uyu(500);
      await dinleyici.kapat();

      expect(gelen).toEqual([is]);
    } finally {
      await kapat();
    }
  }, 15_000);

  it('c) dinleyici yokken aynı kimlikle iki kez konan işten kuyrukta tek iş vardır; dinleyici açılınca işleyici bir kez çağrılır ve ilk verinin işini alır', async () => {
    const { kuyruk, kapat } = await kuyrukModuluAc();
    const gelen: KuyrukIsi[] = [];
    try {
      await kuyruk.koy('c-kopya', {
        kimlik: 'tek',
        ad: 'is',
        veri: { sira: 1 },
      });
      await kuyruk.koy('c-kopya', {
        kimlik: 'tek',
        ad: 'is',
        veri: { sira: 2 },
      });
      expect(await isSatirlari('c-kopya')).toEqual([
        { id: 'tek', state: 'waiting' },
      ]);

      const dinleyici = await kuyruk.dinle('c-kopya', (i) => {
        gelen.push(i);
        return Promise.resolve();
      });
      await bekle('iş işlenir', 5_000, () => gelen.length === 1);
      await uyu(500);
      await dinleyici.kapat();

      expect(gelen).toEqual([{ kimlik: 'tek', ad: 'is', veri: { sira: 1 } }]);
    } finally {
      await kapat();
    }
  }, 15_000);

  it('d) işleyici ilk iki çağrıda hata atıp üçüncüde başarırsa iş tamamlanır; işleyici üç kez çağrılmıştır', async () => {
    const { kuyruk, kapat } = await kuyrukModuluAc();
    let cagri = 0;
    try {
      const dinleyici = await kuyruk.dinle('d-yeniden', () => {
        cagri += 1;
        return cagri <= 2
          ? Promise.reject(new Error(`deneme ${String(cagri)}`))
          : Promise.resolve();
      });
      await kuyruk.koy('d-yeniden', { kimlik: 'd-is', ad: 'is', veri: {} });
      // Tamamlanan iş hemen silinir: tablodan çıkması tamamlandığını gösterir.
      await bekle(
        'üçüncü denemede tamamlanır',
        10_000,
        async () =>
          cagri === 3 && (await isSatirlari('d-yeniden')).length === 0,
      );
      await uyu(500);
      await dinleyici.kapat();

      expect(cagri).toBe(3);
      expect(await kuyruk.basarisizSayisi('d-yeniden')).toBe(0);
    } finally {
      await kapat();
    }
  }, 20_000);

  it(`d, e) hep hata atan iş ${String(DENEME_SAYISI)} kez çağrılır ve başarısız sayısını 1 yapar; başarısız iş iş tablosunda kalır, aynı kuyrukta tamamlanan iş kalmaz`, async ({
    annotate,
  }) => {
    const { kuyruk, kapat } = await kuyrukModuluAc();
    const cagri = { tamam: 0, hata: 0 };
    try {
      const baslangic = Date.now();
      const dinleyici = await kuyruk.dinle('de-temizlik', (i) => {
        if (i.kimlik === 'hata') {
          cagri.hata += 1;
          return Promise.reject(new Error('hep hata'));
        }
        cagri.tamam += 1;
        return Promise.resolve();
      });
      await kuyruk.koy('de-temizlik', { kimlik: 'tamam', ad: 'is', veri: {} });
      await kuyruk.koy('de-temizlik', { kimlik: 'hata', ad: 'is', veri: {} });
      // Üstel aralık 1 + 2 + 4 + 8 sn: son deneme yaklaşık 15 sn sonra olur.
      await bekle(
        'başarısız sayısı 1 olur',
        25_000,
        async () => (await kuyruk.basarisizSayisi('de-temizlik')) === 1,
      );
      await annotate(
        `başarısız sayısı 1 olana kadar ${String(Date.now() - baslangic)} ms`,
      );
      await uyu(500);
      await dinleyici.kapat();

      expect(cagri).toEqual({ tamam: 1, hata: DENEME_SAYISI });
      expect(await isSatirlari('de-temizlik')).toEqual([
        { id: 'hata', state: 'failed' },
      ]);
    } finally {
      await kapat();
    }
  }, 40_000);
});

describe('f) kapanış', () => {
  it('f) dinleyici kapatılınca açtığı veritabanı bağlantılarının hepsi kapanır', async ({
    annotate,
  }) => {
    const { kuyruk, kapat } = await kuyrukModuluAc();
    try {
      await bekle(
        'önceki testlerin bağlantıları kapanır',
        5_000,
        async () => (await baglantiSayisi()) === 0,
      );
      const dinleyici = await kuyruk.dinle('f-dinleyici', () =>
        Promise.resolve(),
      );
      await bekle(
        'dinleyici bağlanır',
        5_000,
        async () => (await baglantiSayisi()) > 0,
      );
      await annotate(
        `açık dinleyicinin bağlantısı: ${String(await baglantiSayisi())}`,
      );

      await dinleyici.kapat();
      await bekle(
        'bağlantılar kapanır',
        5_000,
        async () => (await baglantiSayisi()) === 0,
      );
    } finally {
      await kapat();
    }
  }, 20_000);

  it('f) uygulama kapanınca bağdaştırıcı açtığı kuyruk ve dinleyicileri kapatır; geçici veritabanında bağdaştırıcıdan bağlantı kalmaz', async ({
    annotate,
  }) => {
    const { kuyruk, kapat } = await kuyrukModuluAc();
    let islenen = 0;
    await kuyruk.dinle('f-uygulama', () => {
      islenen += 1;
      return Promise.resolve();
    });
    await kuyruk.koy('f-uygulama', { kimlik: 'f-is', ad: 'is', veri: {} });
    await bekle('iş işlenir', 5_000, () => islenen === 1);
    expect(await kuyruk.basarisizSayisi('f-uygulama')).toBe(0);
    const acik = await baglantiSayisi();
    await annotate(`kapanıştan önce bağlantı: ${String(acik)}`);
    expect(acik).toBeGreaterThan(0);

    // Dinleyici ve kuyruk elle kapatılmaz; kapanış kancası kapatır.
    await kapat();
    await bekle(
      'bağlantılar kapanır',
      5_000,
      async () => (await baglantiSayisi()) === 0,
    );
  }, 20_000);
});
