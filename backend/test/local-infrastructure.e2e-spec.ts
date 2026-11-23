import { Redis } from 'ioredis';
import pg from 'pg';
import { localInfrastructure } from './local-infrastructure.js';

// Yerel altyapıya gerçekten bağlanılabildiğini gösterir; kapsayıcılar çalışmıyorsa kırmızıdır.
describe('yerel altyapı', () => {
  async function currentDatabase(connectionString: string): Promise<unknown> {
    const client = new pg.Client({ connectionString });
    await client.connect();
    try {
      const result = await client.query<{ name: string }>(
        'select current_database() as name',
      );
      return result.rows[0]?.name;
    } finally {
      await client.end();
    }
  }

  it('asıl veritabanına bağlanır', async () => {
    await expect(
      currentDatabase(localInfrastructure.databaseUrl),
    ).resolves.toBe('dextra');
  });

  it('iz veritabanına bağlanır', async () => {
    await expect(
      currentDatabase(localInfrastructure.traceDatabaseUrl),
    ).resolves.toBe('dextra_iz');
  });

  it("Redis'e bağlanır", async () => {
    const redis = new Redis(localInfrastructure.redisUrl, {
      lazyConnect: true,
    });
    await redis.connect();
    try {
      await expect(redis.ping()).resolves.toBe('PONG');
    } finally {
      await redis.quit();
    }
  });
});
