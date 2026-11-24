import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { PRISMA_CLIENT } from '../src/shared/database/database.module.js';
import type { PrismaClient } from '../src/shared/database/generated/client.js';

describe('asıl veritabanı modülü', () => {
  it('modülün verdiği istemciyle asıl veritabanına bağlanır', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    try {
      const prisma = app.get<PrismaClient>(PRISMA_CLIENT);
      const rows = await prisma.$queryRaw<
        { name: string }[]
      >`select current_database() as name`;

      expect(rows[0]?.name).toBe('dextra');
    } finally {
      await app.close();
    }
  });

  it('DATABASE_URL tanımsızsa modül derlemesi değişkenin adıyla reddedilir', async () => {
    const saved = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      await expect(
        Test.createTestingModule({ imports: [AppModule] }).compile(),
      ).rejects.toThrow('DATABASE_URL');
    } finally {
      process.env['DATABASE_URL'] = saved;
    }
  });
});
