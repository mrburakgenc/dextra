import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { GuvenlikModule } from '../../../shared/guvenlik/guvenlik.module.js';
import { MessagingModule } from '../../../shared/messaging/messaging.module.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { ParolaModule } from '../parola/parola.module.js';
import { CikisHandler } from './application/cikis.handler.js';
import { GirisHandler } from './application/giris.handler.js';
import { OturumDenetimiHandler } from './application/oturum-denetimi.handler.js';
import { OTURUM_DENETIMI_REPO } from './domain/oturum-denetimi.repository.js';
import { OTURUM_REPO } from './domain/oturum.repository.js';
import { oturumDenetimiPrismaRepository } from './infrastructure/oturum-denetimi.prisma-repository.js';
import { oturumPrismaRepository } from './infrastructure/oturum.prisma-repository.js';
import { OturumController } from './presentation/oturum.controller.js';

// Oturum alt özelliği (TS-002 AK-30). Giriş belirteç üreticisini ve adres imzası doğrulayıcısını
// güvenlik modülünden, parola ile giriş yöntemini parola modülünden alır.
@Module({
  imports: [
    DatabaseModule,
    MessagingModule,
    GuvenlikModule,
    KimlikCekirdekModule,
    ParolaModule,
  ],
  controllers: [OturumController],
  providers: [OturumDenetimiHandler, GirisHandler, CikisHandler],
  exports: [OturumDenetimiHandler],
})
export class OturumModule {
  constructor(registrar: Registrar) {
    registrar.register(OTURUM_DENETIMI_REPO, oturumDenetimiPrismaRepository);
    registrar.register(OTURUM_REPO, oturumPrismaRepository);
  }
}
