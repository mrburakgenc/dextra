import {
  type BeforeApplicationShutdown,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { Registrar } from '../../database/registrar.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import { IS_KUYRUGU, type IsKuyrugu } from '../kuyruk/is-kuyrugu.js';
import { KuyrukModule } from '../kuyruk/kuyruk.module.js';
import { islenenOlayRepoKaydet } from '../tuketici/islenen-olay.repository.js';
import { AboneDefteri } from './abone-defteri.js';
import { OlayAktarici } from './olay-aktarici.js';
import { outboxOlayRepoKaydet } from './outbox-olay.repository.js';

// Olay yolu: abone defteri, olay aktarıcısı ve kuyruk kapısı. Dışa abone defteri ve kuyruk kapısı
// verilir; tüketici tabanı (tuketiciBaslat) Unit of Work ile kuyruk kapısını bunlardan alır.
// Aktarıcının döngüsü uygulama açılınca başlar, kapanırken veritabanı ve kuyruk bağlantıları
// kapanmadan (onApplicationShutdown) önce durur. Kuyruk göçü burada koşmaz.
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
  ) {
    outboxOlayRepoKaydet(registrar);
    islenenOlayRepoKaydet(registrar);
  }

  onApplicationBootstrap(): void {
    this.aktarici.baslat();
  }

  beforeApplicationShutdown(): Promise<void> {
    return this.aktarici.durdur();
  }
}
