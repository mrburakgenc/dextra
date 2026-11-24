// Tüketici tabanı ve işlenen olay kaydı (GV-017). Koşturma:
//   pnpm -C backend test:e2e test/tuketici.e2e-spec.ts --reporter=verbose
// Her şey göçleri ve kuyruk göçü uygulanmış tek bir geçici veritabanında olur. Olaylar kuyruğa
// kuyruk kapısıyla (IS_KUYRUGU) konur; doğrulama sorguları pg ile atılır. Her test kendi kuyruk
// (tüketici) adını kullanır.
// Yeniden deneme aralığı testte KISALTILMAZ: kuyruk klasörü değişmez ve ürünün sabitleri olduğu
// gibi kullanılır. İlk yeniden deneme ILK_ARALIK_MS (1 sn) sonradır; bekleme sınırları ondan kurulur.
import { execFile } from 'node:child_process';
import { createHash, randomUUIDv7 } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as uyu } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import { DatabaseModule } from '../src/shared/database/database.module.js';
import { Registrar } from '../src/shared/database/registrar.js';
import { UnitOfWork } from '../src/shared/database/unit-of-work.js';
import { ILK_ARALIK_MS } from '../src/shared/messaging/kuyruk/bullmq-is-kuyrugu.js';
import {
  IS_KUYRUGU,
  type IsKuyrugu,
  type KuyrukIsi,
} from '../src/shared/messaging/kuyruk/is-kuyrugu.js';
import { kuyrukGocunuKos } from '../src/shared/messaging/kuyruk/kuyruk-gocu.js';
import { KuyrukModule } from '../src/shared/messaging/kuyruk/kuyruk.module.js';
import {
  ISLENEN_OLAY_REPO,
  islenenOlayRepoKaydet,
  type SahiplenmeSonucu,
} from '../src/shared/messaging/tuketici/islenen-olay.repository.js';
import {
  SAHIPLENME_SURESI_SN,
  type Zarf,
  tuketiciBaslat,
} from '../src/shared/messaging/tuketici/tuketici-tabani.js';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const gocKlasoru = `${backendDir}prisma/migrations`;
const ilkGoc = '20261124163457_outbox';
// İlk göç dosyasının GV-010'da yazılan hâlinin SHA-256 özeti; dosya değişirse test kırılır.
const ilkGocOzeti =
  'a32d08e15b19ddc59eb92d90620aff9af00083d3a85aa7c85f134f9f7c8706e8';
const yeniGoc = '20261124200000_islenen_olay';

// Hedefteki kolon listesi, sırayla: "ad | tür | boş olabilir mi | varsayılan" ("-": varsayılan yok).
const islenenOlayKolonlari = [
  'tuketici | text | NO | -',
  'olay_id | uuid | NO | -',
  'durum | text | NO | -',
  'sahiplenme_bitis_zamani | timestamp with time zone | NO | -',
  'tamamlanma_zamani | timestamp with time zone | YES | -',
  'olusturma_zamani | timestamp with time zone | NO | clock_timestamp()',
];

interface IslenenSatir {
  tuketici: string;
  olay_id: string;
  durum: string;
  sahiplenme_bitis_zamani: Date;
  tamamlanma_zamani: Date | null;
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

// Uygulamanın modülleriyle bir "süreç": Unit of Work ve kuyruk kapısı. İkisi de bağlantı adresini
// DATABASE_URL'den okur; bu dosyada geçici veritabanını gösterir. Tablonun repository'si tüketici
// klasörünün kaydıyla tanıtılır.
async function surecAc(): Promise<{
  uow: UnitOfWork;
  kuyruk: IsKuyrugu;
  kapat: () => Promise<void>;
}> {
  const modul = await Test.createTestingModule({
    imports: [DatabaseModule, KuyrukModule],
  }).compile();
  islenenOlayRepoKaydet(modul.get(Registrar));
  return {
    uow: modul.get(UnitOfWork),
    kuyruk: modul.get<IsKuyrugu>(IS_KUYRUGU),
    // Uygulamanın kapanışı: onApplicationShutdown kancaları koşar.
    kapat: () => modul.close(),
  };
}

function olay(kimlik: string = randomUUIDv7()): KuyrukIsi {
  return {
    kimlik,
    ad: 'ornek.olustu',
    veri: { surum: 1, govde: { sayi: 7 } },
  };
}

async function satirlar(tuketici: string): Promise<IslenenSatir[]> {
  const { rows } = await gozlemci.query<IslenenSatir>(
    `select tuketici, olay_id, durum, sahiplenme_bitis_zamani, tamamlanma_zamani
       from islenen_olay where tuketici = $1 order by olay_id`,
    [tuketici],
  );
  return rows;
}

async function durum(
  tuketici: string,
  olayId: string,
): Promise<string | undefined> {
  const { rows } = await gozlemci.query<{ durum: string }>(
    'select durum from islenen_olay where tuketici = $1 and olay_id = $2',
    [tuketici, olayId],
  );
  return rows[0]?.durum;
}

async function isSatirlari(kuyruk: string): Promise<
  {
    id: string;
    state: string;
    attempts_made: number;
    failed_reason: string | null;
  }[]
> {
  const { rows } = await gozlemci.query<{
    id: string;
    state: string;
    attempts_made: number;
    failed_reason: string | null;
  }>(
    'select id, state, attempts_made, failed_reason from kuyruk.job where queue = $1 order by id',
    [kuyruk],
  );
  return rows;
}

// Sahiplenme satırını doğrudan yazar; bitiş veritabanının saatine göre verilir.
async function sahiplenmeYaz(
  tuketici: string,
  olayId: string,
  bitis: string,
): Promise<void> {
  await gozlemci.query(
    `insert into islenen_olay (tuketici, olay_id, durum, sahiplenme_bitis_zamani)
     values ($1, $2, 'isleniyor', clock_timestamp() + $3::interval)`,
    [tuketici, olayId, bitis],
  );
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
  db = await createTestDatabase([], { migrations: true });
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
}, 60_000);

afterAll(async () => {
  process.env['DATABASE_URL'] = asilAdres;
  await gozlemci.end();
  await db.drop();
  const sunucu = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await sunucu.connect();
  try {
    const kalan = await sunucu.query(
      'select 1 from pg_database where datname = $1',
      [db.name],
    );
    expect(kalan.rows).toHaveLength(0);
  } finally {
    await sunucu.end();
  }
});

describe('a) göç', () => {
  it('a) islenen_olay tablosunun kolonları hedefle birebir aynıdır', async () => {
    const { rows } = await gozlemci.query<{ satir: string }>(
      `select column_name || ' | ' || data_type || ' | ' || is_nullable || ' | ' ||
              coalesce(column_default, '-') as satir
         from information_schema.columns
        where table_schema = 'public' and table_name = 'islenen_olay'
        order by ordinal_position`,
    );
    expect(rows.map((r) => r.satir)).toEqual(islenenOlayKolonlari);
  });

  it('a) birincil anahtar (tuketici, olay_id) ve adı islenen_olay_ba; başka dizin, kısıt, tablo ve tür yoktur', async () => {
    const { rows: kisitlar } = await gozlemci.query<{
      conname: string;
      tanim: string;
    }>(
      `select conname, pg_get_constraintdef(oid) as tanim from pg_constraint
        where conrelid = 'islenen_olay'::regclass and contype <> 'n'`,
    );
    const { rows: dizinler } = await gozlemci.query<{ ad: string }>(
      `select indexrelid::regclass::text as ad from pg_index
        where indrelid = 'islenen_olay'::regclass`,
    );
    const { rows: tablolar } = await gozlemci.query<{ relname: string }>(
      `select relname from pg_class
        where relnamespace = 'public'::regnamespace and relkind in ('r', 'p')
        order by 1`,
    );
    // Tabloların satır türleri dışında public şemasında tür (enum, alan, bileşik) yoktur.
    const { rows: turler } = await gozlemci.query<{ typname: string }>(
      `select typname from pg_type
        where typnamespace = 'public'::regnamespace and typtype <> 'b' and typrelid = 0`,
    );
    expect(kisitlar).toEqual([
      { conname: 'islenen_olay_ba', tanim: 'PRIMARY KEY (tuketici, olay_id)' },
    ]);
    expect(dizinler.map((d) => d.ad)).toEqual(['islenen_olay_ba']);
    expect(tablolar.map((t) => t.relname)).toEqual([
      '_prisma_migrations',
      'islenen_olay',
      'outbox_iz',
      'outbox_olay',
    ]);
    expect(turler).toEqual([]);
  });

  it('a) ilk göç dosyası değişmemiştir; yeni göç ayrı klasördedir ve göç klasörlerinin hepsi uygulanmıştır', async ({
    annotate,
  }) => {
    const klasorler = (await readdir(gocKlasoru, { withFileTypes: true }))
      .filter((g) => g.isDirectory())
      .map((g) => g.name)
      .sort();
    const ozet = createHash('sha256')
      .update(await readFile(`${gocKlasoru}/${ilkGoc}/migration.sql`))
      .digest('hex');
    const { rows: uygulanan } = await gozlemci.query<{
      migration_name: string;
    }>(
      'select migration_name from _prisma_migrations where finished_at is not null order by migration_name',
    );
    await annotate(`göç klasörleri: ${JSON.stringify(klasorler)}`);
    expect(ozet).toBe(ilkGocOzeti);
    expect(klasorler.slice(0, 2)).toEqual([ilkGoc, yeniGoc]);
    expect(uygulanan.map((g) => g.migration_name)).toEqual(klasorler);
  });

  it("a) Prisma'nın migrate diff komutu şema ile göçleri uygulanmış veritabanı arasında fark görmez", async () => {
    // --exit-code: fark yoksa 0, fark varsa 2 ile biter; 0 dışı çıkış execFile'ı reddettirir.
    const { stdout } = await promisify(execFile)(
      `${backendDir}node_modules/.bin/prisma`,
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
        '--exit-code',
      ],
      { cwd: backendDir, env: { ...process.env, DATABASE_URL: db.url } },
    );
    expect(stdout).toContain('-- This is an empty migration.');
  }, 30_000);
});

describe('b-h) tüketici davranışı', () => {
  it("b) kuyruğa konan olay için işleyici zarfla bir kez çağrılır; satır 'tamamlandi' ve tamamlanma zamanı doludur", async () => {
    const { uow, kuyruk, kapat } = await surecAc();
    const gelen: Zarf[] = [];
    try {
      const tuketici = await tuketiciBaslat(uow, kuyruk, 'b-bir-kez', (z) => {
        gelen.push(z);
        return Promise.resolve();
      });
      const is = olay();
      await kuyruk.koy('b-bir-kez', is);
      await bekle(
        'olay tamamlanır',
        5_000,
        async () => (await durum('b-bir-kez', is.kimlik)) === 'tamamlandi',
      );
      // İkinci bir çağrı olmadığını görmek için kısa süre daha beklenir.
      await uyu(500);
      await tuketici.durdur();

      expect(gelen).toEqual([
        { id: is.kimlik, ad: 'ornek.olustu', surum: 1, govde: { sayi: 7 } },
      ]);
      const [satir] = await satirlar('b-bir-kez');
      expect(satir?.durum).toBe('tamamlandi');
      expect(satir?.tamamlanma_zamani).toBeInstanceOf(Date);
      expect(await isSatirlari('b-bir-kez')).toEqual([]);
    } finally {
      await kapat();
    }
  }, 15_000);

  it('c) tamamlanan olay aynı kimlikle kuyruğa yeniden konursa yeni iş oluşur, işleyici ikinci kez çağrılmaz ve iş başarıyla biter', async ({
    annotate,
  }) => {
    const { uow, kuyruk, kapat } = await surecAc();
    let cagri = 0;
    const isleyici = (): Promise<void> => {
      cagri += 1;
      return Promise.resolve();
    };
    try {
      const is = olay();
      const ilk = await tuketiciBaslat(uow, kuyruk, 'c-yineleme', isleyici);
      await kuyruk.koy('c-yineleme', is);
      await bekle(
        'ilk iş tamamlanır',
        5_000,
        async () =>
          (await durum('c-yineleme', is.kimlik)) === 'tamamlandi' &&
          (await isSatirlari('c-yineleme')).length === 0,
      );
      await ilk.durdur();
      const ilkSatir = await satirlar('c-yineleme');

      // Kuyruk tamamlanan işi sildiği için aynı kimlik yeni iş üretir.
      await kuyruk.koy('c-yineleme', is);
      const bekleyen = await isSatirlari('c-yineleme');
      await annotate(
        `yeniden konan iş: ${JSON.stringify(bekleyen.map((i) => [i.id, i.state]))}`,
      );
      expect(bekleyen.map((i) => i.id)).toEqual([is.kimlik]);

      const ikinci = await tuketiciBaslat(uow, kuyruk, 'c-yineleme', isleyici);
      // Tamamlanan iş hemen silinir: tablodan çıkması başarıyla bittiğini gösterir.
      await bekle(
        'ikinci iş biter',
        5_000,
        async () => (await isSatirlari('c-yineleme')).length === 0,
      );
      await uyu(500);
      await ikinci.durdur();

      expect(cagri).toBe(1);
      expect(await kuyruk.basarisizSayisi('c-yineleme')).toBe(0);
      expect(await satirlar('c-yineleme')).toEqual(ilkSatir);
    } finally {
      await kapat();
    }
  }, 20_000);

  it(`d) işleyici ilk çağrıda hata atarsa satır silinir, kuyruk ${String(ILK_ARALIK_MS)} ms (kısaltılmamış ilk aralık) sonra yeniden dener, ikinci çağrıda başarır ve satır 'tamamlandi' olur`, async ({
    annotate,
  }) => {
    const { uow, kuyruk, kapat } = await surecAc();
    const cagriZamanlari: number[] = [];
    let ilkHatadanSonraSatirSilindi = false;
    try {
      const tuketici = await tuketiciBaslat(uow, kuyruk, 'd-hata', () => {
        cagriZamanlari.push(Date.now());
        return cagriZamanlari.length === 1
          ? Promise.reject(new Error('ilk deneme'))
          : Promise.resolve();
      });
      const is = olay();
      await kuyruk.koy('d-hata', is);
      await bekle('ilk çağrı', 5_000, () => cagriZamanlari.length === 1);
      // Yeniden denemeye kadar ILK_ARALIK_MS vardır; satır bu arada silinmiş olmalıdır.
      await bekle('satır silinir', ILK_ARALIK_MS, async () => {
        ilkHatadanSonraSatirSilindi =
          cagriZamanlari.length === 1 &&
          (await durum('d-hata', is.kimlik)) === undefined;
        return ilkHatadanSonraSatirSilindi;
      });
      await bekle(
        'ikinci çağrıda tamamlanır',
        ILK_ARALIK_MS + 5_000,
        async () =>
          (await durum('d-hata', is.kimlik)) === 'tamamlandi' &&
          (await isSatirlari('d-hata')).length === 0,
      );
      await uyu(500);
      await tuketici.durdur();

      const aralik = (cagriZamanlari[1] ?? 0) - (cagriZamanlari[0] ?? 0);
      await annotate(`iki çağrı arası: ${String(aralik)} ms`);
      expect(ilkHatadanSonraSatirSilindi).toBe(true);
      expect(cagriZamanlari).toHaveLength(2);
      expect(aralik).toBeGreaterThanOrEqual(ILK_ARALIK_MS);
      const [satir] = await satirlar('d-hata');
      expect(satir?.durum).toBe('tamamlandi');
      expect(satir?.tamamlanma_zamani).toBeInstanceOf(Date);
      expect(await kuyruk.basarisizSayisi('d-hata')).toBe(0);
    } finally {
      await kapat();
    }
  }, 20_000);

  it("e) 'isleniyor' ve bitişi gelecekte olan satır varken gelen olay işleyiciyi çağırmaz, iş hatayla bırakılır ve satıra dokunulmaz", async ({
    annotate,
  }) => {
    const { uow, kuyruk, kapat } = await surecAc();
    let cagri = 0;
    try {
      const is = olay();
      await sahiplenmeYaz('e-suren', is.kimlik, '1 hour');
      const once = await satirlar('e-suren');
      const tuketici = await tuketiciBaslat(uow, kuyruk, 'e-suren', () => {
        cagri += 1;
        return Promise.resolve();
      });
      await kuyruk.koy('e-suren', is);
      await bekle(
        'iş hatayla bırakılır',
        5_000,
        async () =>
          ((await isSatirlari('e-suren'))[0]?.attempts_made ?? 0) >= 1,
      );
      await tuketici.durdur();

      const [isSatiri] = await isSatirlari('e-suren');
      await annotate(`kuyruktaki iş: ${JSON.stringify(isSatiri)}`);
      expect(cagri).toBe(0);
      expect(isSatiri?.failed_reason).toContain('başka bir işçi işliyor');
      expect(await satirlar('e-suren')).toEqual(once);
    } finally {
      await kapat();
    }
  }, 15_000);

  it("f) süresi dolmuş sahiplenme devralınır ve satır 'tamamlandi' olur; kabul edilen sınır: işleyici daha önce başarıyla çalışmış olsa bile yeniden çağrılır", async () => {
    const { uow, kuyruk, kapat } = await surecAc();
    const gelen: string[] = [];
    const isleyici = (z: Zarf): Promise<void> => {
      gelen.push(z.id);
      return Promise.resolve();
    };
    try {
      const is = olay();
      // Önceki işçi işleyiciyi başarıyla çalıştırdı, "tamamlandi" yazamadan öldü: satır
      // 'isleniyor' kaldı ve süresi doldu.
      await isleyici({ id: is.kimlik, ad: is.ad, surum: 1, govde: {} });
      await sahiplenmeYaz('f-dolmus', is.kimlik, '-1 second');

      const tuketici = await tuketiciBaslat(uow, kuyruk, 'f-dolmus', isleyici);
      await kuyruk.koy('f-dolmus', is);
      await bekle(
        'olay tamamlanır',
        5_000,
        async () => (await durum('f-dolmus', is.kimlik)) === 'tamamlandi',
      );
      await uyu(500);
      await tuketici.durdur();

      // Aynı olay için işleyici iki kez çalışmıştır; komutun tekrar güvenli olması bu yüzdendir.
      expect(gelen).toEqual([is.kimlik, is.kimlik]);
      const [satir] = await satirlar('f-dolmus');
      expect(satir?.tamamlanma_zamani).toBeInstanceOf(Date);
    } finally {
      await kapat();
    }
  }, 15_000);

  it('g) aynı tüketici adıyla iki taban yan yana çalışırken her olay için işleyici toplamda bir kez çağrılır', async () => {
    const birinci = await surecAc();
    const ikinci = await surecAc();
    const cagri = new Map<string, number>();
    const isleyici = (z: Zarf): Promise<void> => {
      cagri.set(z.id, (cagri.get(z.id) ?? 0) + 1);
      return Promise.resolve();
    };
    try {
      const tabanlar = [
        await tuketiciBaslat(birinci.uow, birinci.kuyruk, 'g-yaris', isleyici),
        await tuketiciBaslat(ikinci.uow, ikinci.kuyruk, 'g-yaris', isleyici),
      ];
      const olaylar = Array.from({ length: 20 }, () => olay());
      await Promise.all(olaylar.map((is) => birinci.kuyruk.koy('g-yaris', is)));
      await bekle(
        'olayların hepsi tamamlanır',
        15_000,
        async () =>
          (await satirlar('g-yaris')).filter((s) => s.durum === 'tamamlandi')
            .length === olaylar.length,
      );
      await uyu(500);
      await Promise.all(tabanlar.map((t) => t.durdur()));

      expect(olaylar.map((is) => cagri.get(is.kimlik))).toEqual(
        olaylar.map(() => 1),
      );
    } finally {
      await birinci.kapat();
      await ikinci.kapat();
    }
  }, 30_000);

  it('g) sahiplenme adımı iki süreçten aynı anda çağrılınca yalnız biri sahiplenir: yeni satırda da süresi dolmuş satırda da', async () => {
    const birinci = await surecAc();
    const ikinci = await surecAc();
    const sahiplen = (
      uow: UnitOfWork,
      olayId: string,
    ): Promise<SahiplenmeSonucu> =>
      uow.run((islem) =>
        islem
          .repo(ISLENEN_OLAY_REPO)
          .sahiplen('g-adim', olayId, SAHIPLENME_SURESI_SN),
      );
    try {
      const yeni = Array.from({ length: 20 }, () => randomUUIDv7());
      const dolmus = Array.from({ length: 20 }, () => randomUUIDv7());
      for (const olayId of dolmus) {
        await sahiplenmeYaz('g-adim', olayId, '-1 second');
      }
      const sonuclar = await Promise.all(
        [...yeni, ...dolmus].map(async (olayId) =>
          (
            await Promise.all([
              sahiplen(birinci.uow, olayId),
              sahiplen(ikinci.uow, olayId),
            ])
          ).sort(),
        ),
      );

      expect(sonuclar).toEqual(
        [...yeni, ...dolmus].map(() => ['isleniyor', 'sahiplenildi']),
      );
    } finally {
      await birinci.kapat();
      await ikinci.kapat();
    }
  }, 30_000);

  it('h) aynı olay kimliği iki ayrı tüketici adına ayrı ayrı işlenir; satırlar tüketiciye göre ayrıdır', async () => {
    const { uow, kuyruk, kapat } = await surecAc();
    const gelen = { a: 0, b: 0 };
    try {
      const tabanlar = [
        await tuketiciBaslat(uow, kuyruk, 'h-a', () => {
          gelen.a += 1;
          return Promise.resolve();
        }),
        await tuketiciBaslat(uow, kuyruk, 'h-b', () => {
          gelen.b += 1;
          return Promise.resolve();
        }),
      ];
      const is = olay();
      await kuyruk.koy('h-a', is);
      await kuyruk.koy('h-b', is);
      await bekle(
        'iki tüketici de tamamlar',
        5_000,
        async () =>
          (await durum('h-a', is.kimlik)) === 'tamamlandi' &&
          (await durum('h-b', is.kimlik)) === 'tamamlandi',
      );
      await uyu(500);
      await Promise.all(tabanlar.map((t) => t.durdur()));

      expect(gelen).toEqual({ a: 1, b: 1 });
      const { rows } = await gozlemci.query<{
        tuketici: string;
        durum: string;
      }>(
        'select tuketici, durum from islenen_olay where olay_id = $1 order by tuketici',
        [is.kimlik],
      );
      expect(rows).toEqual([
        { tuketici: 'h-a', durum: 'tamamlandi' },
        { tuketici: 'h-b', durum: 'tamamlandi' },
      ]);
    } finally {
      await kapat();
    }
  }, 15_000);
});

describe('i) kapanış', () => {
  it('i) taban durdurulunca dinleyicinin bağlantıları kapanır; uygulama da kapanınca geçici veritabanına açık bağlantı kalmaz', async ({
    annotate,
  }) => {
    await bekle(
      'önceki testlerin bağlantıları kapanır',
      5_000,
      async () => (await baglantiSayisi()) === 0,
    );
    const { uow, kuyruk, kapat } = await surecAc();
    try {
      // Yalnız taban: Unit of Work ve kuyruk henüz bağlanmadı; bağlantıların hepsi dinleyicinindir.
      const bos = await tuketiciBaslat(uow, kuyruk, 'i-bos', () =>
        Promise.resolve(),
      );
      await bekle(
        'dinleyici bağlanır',
        5_000,
        async () => (await baglantiSayisi()) > 0,
      );
      await annotate(
        `açık tabanın bağlantısı: ${String(await baglantiSayisi())}`,
      );
      await bos.durdur();
      await bekle(
        'taban durunca bağlantılar kapanır',
        5_000,
        async () => (await baglantiSayisi()) === 0,
      );

      // Olay işlemiş taban: durdurulur, sonra uygulama kapanır.
      const tuketici = await tuketiciBaslat(uow, kuyruk, 'i-isleyen', () =>
        Promise.resolve(),
      );
      const is = olay();
      await kuyruk.koy('i-isleyen', is);
      await bekle(
        'olay tamamlanır',
        5_000,
        async () => (await durum('i-isleyen', is.kimlik)) === 'tamamlandi',
      );
      await tuketici.durdur();
      await annotate(
        `durdurulduktan sonra Unit of Work ve kuyruk kapısının bağlantısı: ${String(await baglantiSayisi())}`,
      );
    } finally {
      await kapat();
    }
    await bekle(
      'uygulama kapanınca bağlantılar kapanır',
      5_000,
      async () => (await baglantiSayisi()) === 0,
    );
  }, 30_000);
});
