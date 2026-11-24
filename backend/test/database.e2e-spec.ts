import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import {
  IZ_PRISMA_CLIENT,
  PRISMA_CLIENT,
} from '../src/shared/database/istemci-belirtecleri.js';
import type { PrismaClient } from '../src/shared/database/generated/client.js';
import type { PrismaClient as IzPrismaClient } from '../src/shared/database/iz/generated/client.js';

// Değişken baştan tanımsızsa geri yüklemek onu silmektir; "undefined" metnine eşitlemek değil.
function restoreEnv(name: string, saved: string | undefined): void {
  if (saved === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = saved;
  }
}

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
      restoreEnv('DATABASE_URL', saved);
    }
  });
});

describe('iz veritabanı istemcisi', () => {
  it('iz belirteciyle verilen istemci iz veritabanına bağlanır', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    try {
      const izPrisma = app.get<IzPrismaClient>(IZ_PRISMA_CLIENT);
      const rows = await izPrisma.$queryRaw<
        { name: string }[]
      >`select current_database() as name`;

      expect(rows[0]?.name).toBe('dextra_iz');
    } finally {
      await app.close();
    }
  });

  it('IZ_DATABASE_URL tanımsızsa modül derlemesi değişkenin adıyla reddedilir', async () => {
    const saved = process.env['IZ_DATABASE_URL'];
    delete process.env['IZ_DATABASE_URL'];
    try {
      await expect(
        Test.createTestingModule({ imports: [AppModule] }).compile(),
      ).rejects.toThrow('IZ_DATABASE_URL');
    } finally {
      restoreEnv('IZ_DATABASE_URL', saved);
    }
  });
});

describe('ortam değişkenini geri yükleme', () => {
  it('değişken baştan tanımsızsa onu siler', () => {
    const name = 'DEXTRA_GERI_YUKLEME_DENEMESI';
    process.env[name] = 'gecici';
    restoreEnv(name, undefined);

    expect(name in process.env).toBe(false);
  });
});
