import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { localInfrastructure } from './local-infrastructure.js';

export interface TestDatabase {
  readonly name: string;
  readonly url: string;
  drop(): Promise<void>;
}

// Yerel sunucuya asıl veritabanının adresiyle bağlanıp yalnız sunucu düzeyinde komut verir;
// dextra ve dextra_iz içine nesne yazılmaz.
async function onServer(sql: string): Promise<void> {
  const client = new pg.Client({
    connectionString: localInfrastructure.databaseUrl,
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

// Eşsiz adlı geçici bir veritabanı açar, verilen SQL metinlerini sırayla uygular.
// Testler tabloyu gerçek veritabanlarında değil burada kurar (TS-001); iş bitince drop() çağrılır.
export async function createTestDatabase(
  sqls: readonly string[] = [],
): Promise<TestDatabase> {
  const name = `dextra_test_${randomUUID().replaceAll('-', '')}`;
  await onServer(`CREATE DATABASE ${name}`);

  const url = new URL(localInfrastructure.databaseUrl);
  url.pathname = `/${name}`;
  const database: TestDatabase = {
    name,
    url: url.toString(),
    // Açık kalmış bağlantılar silmeyi engellemesin diye FORCE kullanılır.
    drop: () => onServer(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`),
  };

  const client = new pg.Client({ connectionString: database.url });
  try {
    await client.connect();
    for (const sql of sqls) {
      await client.query(sql);
    }
  } catch (error) {
    // SQL uygulanamazsa yarım veritabanı sunucuda kalmaz.
    await database.drop();
    throw error;
  } finally {
    await client.end();
  }
  return database;
}
