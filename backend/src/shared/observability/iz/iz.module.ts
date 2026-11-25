import {
  type BeforeApplicationShutdown,
  Inject,
  Module,
  type OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { IZ_PRISMA_CLIENT } from '../../database/domain/istemci-belirtecleri.js';
import type { PrismaClient as IzPrismaClient } from '../../database/iz/generated/client.js';
import { Registrar } from '../../database/infrastructure/registrar.js';
import { UnitOfWork } from '../../database/infrastructure/unit-of-work.js';
import { KOMUT_BAGLAMI } from '../../messaging/komut-baglami.js';
import { IzAktarici } from './iz-aktarici.js';
import { outboxIzRepoKaydet } from './outbox-iz.repository.js';

// İz aktarıcısı. Döngüsü uygulama açılınca başlar (komut bağlamında başlamaz; komut-baglami.ts),
// kapanırken veritabanı bağlantıları kapanmadan
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
    @Optional()
    @Inject(KOMUT_BAGLAMI)
    private readonly komutBaglami: true | undefined,
  ) {
    outboxIzRepoKaydet(registrar);
  }

  onApplicationBootstrap(): void {
    if (this.komutBaglami === undefined) {
      this.aktarici.baslat();
    }
  }

  beforeApplicationShutdown(): Promise<void> {
    return this.aktarici.durdur();
  }
}
