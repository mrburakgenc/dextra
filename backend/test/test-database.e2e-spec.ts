import pg from 'pg';
import { localInfrastructure } from './local-infrastructure.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

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

async function databaseExists(name: string): Promise<boolean> {
  const rows = await query(
    localInfrastructure.databaseUrl,
    'select 1 from pg_database where datname = $1',
    [name],
  );
  return rows.length === 1;
}

// Kullanıcı nesneleri: sistem şemaları dışındaki tablo, dizin, dizi, görünüm vb.
async function userObjects(connectionString: string): Promise<string[]> {
  const rows = await query<{ name: string }>(
    connectionString,
    `select n.nspname || '.' || c.relname as name
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
      order by 1`,
  );
  return rows.map((row) => row.name);
}

describe('geçici test veritabanı yardımcısı', () => {
  let database: TestDatabase | undefined;

  afterAll(async () => {
    await database?.drop();
  });

  it('dextra_test_ önekli veritabanı açar, SQL uygular ve siler; asıl ve iz veritabanına dokunmaz', async () => {
    const mainBefore = await userObjects(localInfrastructure.databaseUrl);
    const traceBefore = await userObjects(localInfrastructure.traceDatabaseUrl);

    database = await createTestDatabase([
      'create table deneme (id integer primary key)',
    ]);

    expect(database.name).toMatch(/^dextra_test_/);
    expect(await databaseExists(database.name)).toBe(true);
    const current = await query<{ name: string }>(
      database.url,
      'select current_database() as name',
    );
    expect(current[0]?.name).toBe(database.name);
    const tables = await query(
      database.url,
      "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'deneme'",
    );
    expect(tables).toHaveLength(1);

    await database.drop();

    expect(await databaseExists(database.name)).toBe(false);
    expect(await userObjects(localInfrastructure.databaseUrl)).toEqual(
      mainBefore,
    );
    expect(await userObjects(localInfrastructure.traceDatabaseUrl)).toEqual(
      traceBefore,
    );
  });

  it('her çağrıda eşsiz ad verir', async () => {
    const first = await createTestDatabase();
    const second = await createTestDatabase();
    try {
      expect(first.name).not.toBe(second.name);
    } finally {
      await first.drop();
      await second.drop();
    }
  });
});
