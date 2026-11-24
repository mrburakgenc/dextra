import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PoolConfig } from 'pg';
import { PrismaClient } from './generated/client.js';
import { IZ_PRISMA_CLIENT, PRISMA_CLIENT } from './istemci-belirtecleri.js';
import { PrismaClient as IzPrismaClient } from './iz/generated/client.js';
import { Registrar, RepoKayitlari } from './registrar.js';
import { UnitOfWork } from './unit-of-work.js';

// İz veritabanına her ifadenin sunucu tarafı süre sınırı (TS-003 sözleşme 6); hem statement_timeout
// hem lock_timeout olarak verilir. Asıl işlemin 5 saniyelik sınırından kısadır; iz aktarıcısı tek tek
// denemelerini bu değere göre o süreye sığdırır.
export const IZ_YAZIM_SURE_SINIRI_MS = 1000;

// İz bağlantı havuzunun ayarı. Sınırlar bağlantının açılış parametresidir: node-postgres havuzun
// her bağlantısına geçirir, sunucu her ifadeye uygular.
export function izBaglantiAyari(connectionString: string): PoolConfig {
  return {
    connectionString,
    statement_timeout: IZ_YAZIM_SURE_SINIRI_MS,
    lock_timeout: IZ_YAZIM_SURE_SINIRI_MS,
  };
}

@Module({
  providers: [
    {
      provide: PRISMA_CLIENT,
      // İstemci ilk sorguda bağlanır; açılışta veritabanına gidilmez.
      useFactory: (): PrismaClient => {
        const connectionString = process.env['DATABASE_URL'];
        if (connectionString === undefined) {
          throw new Error('DATABASE_URL ortam değişkeni tanımlı değil');
        }
        return new PrismaClient({
          adapter: new PrismaPg({ connectionString }),
        });
      },
    },
    {
      provide: IZ_PRISMA_CLIENT,
      // Adres ayrı değişkendedir; iz veritabanını ayrı sunucuya taşımak yalnız ayar işidir.
      useFactory: (): IzPrismaClient => {
        const connectionString = process.env['IZ_DATABASE_URL'];
        if (connectionString === undefined) {
          throw new Error('IZ_DATABASE_URL ortam değişkeni tanımlı değil');
        }
        return new IzPrismaClient({
          adapter: new PrismaPg(izBaglantiAyari(connectionString)),
        });
      },
    },
    RepoKayitlari,
    // Dışa yalnız kayıt yüzü verilir; kuran yüz (RepoKayitlari) modülün içinde kalır.
    { provide: Registrar, useExisting: RepoKayitlari },
    {
      // Unit of Work yalnız asıl veritabanının istemcisini alır (KR-011).
      provide: UnitOfWork,
      useFactory: (
        istemci: PrismaClient,
        kayitlar: RepoKayitlari,
      ): UnitOfWork => new UnitOfWork(istemci, kayitlar),
      inject: [PRISMA_CLIENT, RepoKayitlari],
    },
  ],
  exports: [PRISMA_CLIENT, IZ_PRISMA_CLIENT, Registrar, UnitOfWork],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(IZ_PRISMA_CLIENT) private readonly izPrisma: IzPrismaClient,
  ) {}

  // Bağlantı havuzlarını kapatır; uygulama kapanınca açık bağlantı kalmaz.
  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.prisma.$disconnect(), this.izPrisma.$disconnect()]);
  }
}
