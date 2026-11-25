import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { GuvenlikModule } from '../../../shared/guvenlik/guvenlik.module.js';
import { MessagingModule } from '../../../shared/messaging/messaging.module.js';
import { OkumaKapisi } from '../../../shared/yetki/infrastructure/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { ParolaModule } from '../parola/parola.module.js';
import { CikisHandler } from './application/commands/cikis/cikis.handler.js';
import { GirisHandler } from './application/commands/giris/giris.handler.js';
import { OturumDenetimiHandler } from './application/commands/oturum-denetimi/oturum-denetimi.handler.js';
import { OturumKapatHandler } from './application/commands/oturum-kapat/oturum-kapat.handler.js';
import { YenileHandler } from './application/commands/yenile/yenile.handler.js';
import { OturumListeleHandler } from './application/queries/oturum-listele/oturum-listele.handler.js';
import { OturumOkuHandler } from './application/queries/oturum-oku/oturum-oku.handler.js';
import { OTURUM_DENETIMI_REPO } from './domain/repositories/i-oturum-denetimi.repository.js';
import { OTURUM_REPO } from './domain/repositories/i-oturum.repository.js';
import {
  OTURUM_YONETIM_OKUMA_REPO,
  OTURUM_YONETIM_YAZMA_REPO,
} from './domain/repositories/i-oturum-yonetim.repository.js';
import { oturumDenetimiPrismaRepository } from './infrastructure/repositories/oturum-denetimi.prisma-repository.js';
import { oturumPrismaRepository } from './infrastructure/repositories/oturum.prisma-repository.js';
import { oturumYonetimOkumaPrismaRepository } from './infrastructure/repositories/oturum-yonetim-okuma.prisma-repository.js';
import { PrismaOturumYonetimYazmaRepo } from './infrastructure/repositories/oturum-yonetim-yazma.prisma-repository.js';
import { OturumController } from './presentation/oturum.controller.js';

// Oturum alt özelliği (TS-002 AK-30). Giriş belirteç üreticisini ve adres imzası doğrulayıcısını
// güvenlik modülünden, parola ile giriş yöntemini parola modülünden alır. Oturumların listelenmesi
// ve kapatılması (AK-51) kaynağı kendi sorgularıyla okur ve kendi deyimiyle yazar; süzgeci ve yazmanın
// sırasını yetki kapısının okuma ve yazma yüzü verir (TS-007); kapıları kök modülde bir kez kurulan
// genel YetkiModule verir (AK-42).
@Module({
  imports: [
    DatabaseModule,
    MessagingModule,
    GuvenlikModule,
    KimlikCekirdekModule,
    ParolaModule,
  ],
  controllers: [OturumController],
  providers: [
    OturumDenetimiHandler,
    GirisHandler,
    CikisHandler,
    YenileHandler,
    OturumListeleHandler,
    OturumOkuHandler,
    OturumKapatHandler,
    {
      provide: OTURUM_YONETIM_YAZMA_REPO,
      useClass: PrismaOturumYonetimYazmaRepo,
    },
  ],
  exports: [OturumDenetimiHandler],
})
export class OturumModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(OTURUM_DENETIMI_REPO, oturumDenetimiPrismaRepository);
    registrar.register(OTURUM_REPO, oturumPrismaRepository);
    registrar.register(
      OTURUM_YONETIM_OKUMA_REPO,
      oturumYonetimOkumaPrismaRepository(kapi),
    );
  }
}
