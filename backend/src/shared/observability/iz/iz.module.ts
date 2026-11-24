import {
  type BeforeApplicationShutdown,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { IZ_PRISMA_CLIENT } from '../../database/istemci-belirtecleri.js';
import type { PrismaClient as IzPrismaClient } from '../../database/iz/generated/client.js';
import { Registrar } from '../../database/registrar.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import { IzAktarici } from './iz-aktarici.js';
import { outboxIzRepoKaydet } from './outbox-iz.repository.js';

// İz aktarıcısı. Döngüsü uygulama açılınca başlar, kapanırken veritabanı bağlantıları kapanmadan
// (onApplicationShutdown) önce durur. Dışa bir şey verilmez.
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: IzAktarici,
      useFactory: (uow: UnitOfWork, izIstemci: IzPrismaClient): IzAktarici =>
        new IzAktarici(uow, izIstemci),
      inject: [UnitOfWork, IZ_PRISMA_CLIENT],
    },
  ],
})
export class IzModule
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  constructor(
    registrar: Registrar,
    private readonly aktarici: IzAktarici,
  ) {
    outboxIzRepoKaydet(registrar);
  }

  onApplicationBootstrap(): void {
    this.aktarici.baslat();
  }

  beforeApplicationShutdown(): Promise<void> {
    return this.aktarici.durdur();
  }
}
