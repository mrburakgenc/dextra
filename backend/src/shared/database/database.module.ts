import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
import { PrismaClient as IzPrismaClient } from './iz/generated/client.js';

// Asıl veritabanının (dextra) istemcisi bu belirteçle enjekte edilir.
export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

// İz veritabanının (dextra_iz) istemcisi bu belirteçle enjekte edilir; yalnız ortak altyapı kodu kullanır (KR-013).
export const IZ_PRISMA_CLIENT = Symbol('IZ_PRISMA_CLIENT');

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
          adapter: new PrismaPg({ connectionString }),
        });
      },
    },
  ],
  exports: [PRISMA_CLIENT, IZ_PRISMA_CLIENT],
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
