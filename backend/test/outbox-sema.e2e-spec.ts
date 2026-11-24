import { execFile } from 'node:child_process';
import { randomUUIDv7 } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

// Hedefteki kolon listesi, sırayla; her satır "ad | tür | boş olabilir mi | varsayılan | hassasiyet"
// biçimindedir, varsayılanı olmayan kolonda varsayılan "-" yazılır. Hassasiyet zaman kolonlarının
// kesir hanesidir, ötekilerde "-"; Prisma'nın fark komutu hassasiyet farkını görmediği için burada sınanır.
const outboxIzKolonlari = [
  'id | uuid | NO | - | -',
  'surum | integer | NO | - | -',
  'govde | jsonb | NO | - | -',
  'olusturma_zamani | timestamp with time zone | NO | clock_timestamp() | 6',
  'aktarim_zamani | timestamp with time zone | YES | - | 6',
  'deneme_sayisi | integer | NO | 0 | -',
  'sonraki_deneme_zamani | timestamp with time zone | YES | - | 6',
  'son_hata | text | YES | - | -',
];

const outboxOlayKolonlari = [
  'id | uuid | NO | - | -',
  'ad | text | NO | - | -',
  'surum | integer | NO | - | -',
  'govde | jsonb | NO | - | -',
  'olusturma_zamani | timestamp with time zone | NO | clock_timestamp() | 6',
  'aktarim_zamani | timestamp with time zone | YES | - | 6',
  'deneme_sayisi | integer | NO | 0 | -',
  'sonraki_deneme_zamani | timestamp with time zone | YES | - | 6',
  'son_hata | text | YES | - | -',
];

// Kimlik verilmeden yazılan ekleme ve kimlik verilen iki ekleme; zaman hiçbirinde verilmez.
const tablolar = [
  {
    ad: 'outbox_iz',
    kolonlar: outboxIzKolonlari,
    kimliksizEkleme: `insert into outbox_iz (surum, govde) values (1, '{}')`,
    ekleme: `insert into outbox_iz (id, surum, govde) values ($1, 1, '{}')`,
  },
  {
    ad: 'outbox_olay',
    kolonlar: outboxOlayKolonlari,
    kimliksizEkleme: `insert into outbox_olay (ad, surum, govde) values ('deneme', 1, '{}')`,
    ekleme: `insert into outbox_olay (id, ad, surum, govde) values ($1, 'deneme', 1, '{}')`,
  },
] as const;

async function query<T extends pg.QueryResultRow>(
  connectionString: string,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return (await client.query<T>(sql, values)).rows;
  } finally {
    await client.end();
  }
}

describe('outbox tabloları (asıl şemanın ilk göçü)', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase([], { migrations: true });
  });

  afterAll(async () => {
    // Açılış başarısızsa yardımcı veritabanını zaten silmiştir; asıl hatanın yanına ikinci hata eklenmez.
    const acilan = database as TestDatabase | undefined;
    if (acilan === undefined) return;
    await acilan.drop();
    const kalan = await query(
      localInfrastructure.databaseUrl,
      'select 1 from pg_database where datname = $1',
      [acilan.name],
    );
    expect(kalan).toHaveLength(0);
  });

  it.each(tablolar)(
    '$ad kolonları ad, tür, boş olabilirlik, varsayılan ve hassasiyet olarak hedefle birebir aynıdır',
    async ({ ad, kolonlar }) => {
      const rows = await query<{ kolon: string }>(
        database.url,
        `select concat_ws(' | ', column_name, data_type, is_nullable,
                          coalesce(column_default, '-'),
                          coalesce(datetime_precision::text, '-')) as kolon
           from information_schema.columns
          where table_schema = 'public' and table_name = $1
          order by ordinal_position`,
        [ad],
      );
      expect(rows.map((row) => row.kolon)).toEqual(kolonlar);
    },
  );

  it('outbox_iz üzerinde birincil anahtardan başka tek dizin vardır: aktarılmamış satırlar için kısmi dizin', async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      database.url,
      `select indexname, indexdef from pg_indexes
        where schemaname = 'public' and tablename = 'outbox_iz' order by indexname`,
    );
    expect(rows).toEqual([
      {
        indexname: 'outbox_iz_ba',
        indexdef:
          'CREATE UNIQUE INDEX outbox_iz_ba ON public.outbox_iz USING btree (id)',
      },
      {
        indexname: 'outbox_iz_olusturma_zamani_dizin',
        indexdef:
          'CREATE INDEX outbox_iz_olusturma_zamani_dizin ON public.outbox_iz USING btree (olusturma_zamani) WHERE (aktarim_zamani IS NULL)',
      },
    ]);
  });

  it('outbox_olay üzerinde birincil anahtardan başka tek dizin vardır: aktarılmamış satırlar için kısmi dizin', async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      database.url,
      `select indexname, indexdef from pg_indexes
        where schemaname = 'public' and tablename = 'outbox_olay' order by indexname`,
    );
    expect(rows).toEqual([
      {
        indexname: 'outbox_olay_ba',
        indexdef:
          'CREATE UNIQUE INDEX outbox_olay_ba ON public.outbox_olay USING btree (id)',
      },
      {
        indexname: 'outbox_olay_olusturma_zamani_dizin',
        indexdef:
          'CREATE INDEX outbox_olay_olusturma_zamani_dizin ON public.outbox_olay USING btree (olusturma_zamani) WHERE (aktarim_zamani IS NULL)',
      },
    ]);
  });

  it('public şemasında iki outbox tablosu, işlenen olay tablosu ve göç aracının kendi tablosundan başka tablo yoktur', async () => {
    const rows = await query<{ name: string }>(
      database.url,
      "select table_name as name from information_schema.tables where table_schema = 'public' order by 1",
    );
    expect(rows.map((row) => row.name)).toEqual([
      '_prisma_migrations',
      'islenen_olay',
      'outbox_iz',
      'outbox_olay',
    ]);
  });

  it.each(tablolar)(
    '$ad: aynı işlemde art arda eklenen iki satırın oluşturma zamanı farklıdır ve ikincisi büyüktür',
    async ({ ad, ekleme }) => {
      const ilk = randomUUIDv7();
      const ikinci = randomUUIDv7();
      const client = new pg.Client({ connectionString: database.url });
      await client.connect();
      try {
        await client.query('begin');
        await client.query(ekleme, [ilk]);
        await client.query(ekleme, [ikinci]);
        // Karşılaştırma veritabanında yapılır; JavaScript tarihi mikrosaniyeyi kaybeder.
        const rows = (
          await client.query<{ buyuk: boolean }>(
            `select (select olusturma_zamani from ${ad} where id = $2)
                  > (select olusturma_zamani from ${ad} where id = $1) as buyuk`,
            [ilk, ikinci],
          )
        ).rows;
        await client.query('commit');
        expect(rows).toEqual([{ buyuk: true }]);
      } finally {
        await client.end();
      }
    },
  );

  it.each(tablolar)(
    '$ad: kimlik verilmeden yapılan ekleme veritabanında hata verir',
    async ({ kimliksizEkleme }) => {
      // 23502: NOT NULL kısıtı ihlali.
      await expect(query(database.url, kimliksizEkleme)).rejects.toMatchObject({
        code: '23502',
      });
    },
  );

  it('göçleri uygulanmış veritabanı ile şema arasında Prisma fark görmez', async ({
    annotate,
  }) => {
    const backendDir = fileURLToPath(new URL('..', import.meta.url));
    // --exit-code: fark yoksa 0, fark varsa 2 ile biter; 2 execFile'ı reddettirir.
    const { stdout } = await promisify(execFile)(
      `${backendDir}node_modules/.bin/prisma`,
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      { cwd: backendDir, env: { ...process.env, DATABASE_URL: database.url } },
    );
    await annotate(`prisma migrate diff çıktısı: ${stdout.trim()}`);
  });
});
