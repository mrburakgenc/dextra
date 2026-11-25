import {
  type BeforeApplicationShutdown,
  Inject,
  Module,
  type OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { Registrar } from '../database/infrastructure/registrar.js';
import { UnitOfWork } from '../database/infrastructure/unit-of-work.js';
import { KOMUT_BAGLAMI } from './komut-baglami.js';
import { IS_KUYRUGU, type IsKuyrugu } from './domain/kuyruk/is-kuyrugu.js';
import { KuyrukModule } from './kuyruk.module.js';
import { islenenOlayRepoKaydet } from './infrastructure/tuketici/islenen-olay.prisma-repository.js';
import { AboneDefteri } from './application/olay/abone-defteri.js';
import { OlayAktarici } from './infrastructure/olay/olay-aktarici.js';
import { outboxOlayRepoKaydet } from './infrastructure/olay/outbox-olay.prisma-repository.js';

// Olay yolu: abone defteri, olay aktarıcısı ve kuyruk kapısı. Dışa abone defteri ve kuyruk kapısı
// verilir; tüketici tabanı (tuketiciBaslat) Unit of Work ile kuyruk kapısını bunlardan alır.
// Aktarıcının döngüsü uygulama açılınca başlar (komut bağlamında başlamaz; komut-baglami.ts),
// kapanırken veritabanı ve kuyruk bağlantıları kapanmadan (onApplicationShutdown) önce durur.
// Kuyruk göçü burada koşmaz.
@Module({
  imports: [DatabaseModule, KuyrukModule],
  providers: [
    AboneDefteri,
    {
      provide: OlayAktarici,
      useFactory: (
        uow: UnitOfWork,
        defter: AboneDefteri,
        kuyruk: IsKuyrugu,
      ): OlayAktarici => new OlayAktarici(uow, defter, kuyruk),
      inject: [UnitOfWork, AboneDefteri, IS_KUYRUGU],
    },
  ],
  exports: [AboneDefteri, KuyrukModule],
})
export class OlayModule
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  constructor(
    registrar: Registrar,
    private readonly aktarici: OlayAktarici,
    @Optional()
    @Inject(KOMUT_BAGLAMI)
    private readonly komutBaglami: true | undefined,
  ) {
    outboxOlayRepoKaydet(registrar);
    islenenOlayRepoKaydet(registrar);
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
