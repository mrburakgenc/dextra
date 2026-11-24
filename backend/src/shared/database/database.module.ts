import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

// Asıl veritabanının (dextra) istemcisi bu belirteçle enjekte edilir.
export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

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
  ],
  exports: [PRISMA_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  // Bağlantı havuzunu kapatır; uygulama kapanınca açık bağlantı kalmaz.
  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
