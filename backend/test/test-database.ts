import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
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

const backendDir = fileURLToPath(new URL('..', import.meta.url));

// Asıl şemanın göçlerini canlıda kullanılacak komutla uygular; adres yalnız bu komutun
// ortamına verilir.
async function applyMigrations(url: string): Promise<void> {
  await promisify(execFile)(
    `${backendDir}node_modules/.bin/prisma`,
    ['migrate', 'deploy'],
    { cwd: backendDir, env: { ...process.env, DATABASE_URL: url } },
  );
}

// Eşsiz adlı geçici bir veritabanı açar; istenirse önce asıl şemanın göçlerini, sonra verilen
// SQL metinlerini sırayla uygular.
// Testler tabloyu gerçek veritabanlarında değil burada kurar (TS-001); iş bitince drop() çağrılır.
export async function createTestDatabase(
  sqls: readonly string[] = [],
  { migrations = false }: { migrations?: boolean } = {},
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
    if (migrations) {
      await applyMigrations(database.url);
    }
    await client.connect();
    for (const sql of sqls) {
      await client.query(sql);
    }
  } catch (error) {
    // Göç ya da SQL uygulanamazsa yarım veritabanı sunucuda kalmaz. Silme de hata verirse çağırana
    // yine asıl SQL hatası ulaşır; silmenin hatası onu örtmesin diye bırakılır.
    await database.drop().catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
  return database;
}
