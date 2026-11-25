import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KimlikModule } from './features/kimlik/kimlik.module.js';
import {
  KIMLIK_KAYNAKLARI,
  KIMLIK_SISTEM_ALANLARI,
  KimlikYetkiVerisi,
} from './features/kimlik/_shared/application/yetki-verisi.js';
import { OturumDenetimiHandler } from './features/kimlik/oturum/application/commands/oturum-denetimi/oturum-denetimi.handler.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { GuvenlikModule } from './shared/guvenlik/guvenlik.module.js';
import { KimlikGuard } from './shared/guvenlik/infrastructure/kimlik.guard.js';
import { HealthModule } from './shared/health/health.module.js';
import { HttpTemeliModule } from './shared/http/http-temeli.module.js';
import { OTURUM_DENETIMI } from './shared/kimlik/domain/i-oturum-denetimi.contract.js';
import { YETKI_VERISI } from './shared/kimlik/domain/i-yetki-verisi.contract.js';
import { MessagingModule } from './shared/messaging/messaging.module.js';
import { OlayModule } from './shared/messaging/olay/olay.module.js';
import { ErisimModule } from './shared/observability/erisim/erisim.module.js';
import { IzModule } from './shared/observability/iz/iz.module.js';
import { prismaKaynakKatalogu } from './shared/yetki/infrastructure/prisma-kaynak-katalogu.js';
import { YetkiBellegi } from './shared/yetki/infrastructure/yetki-bellegi.js';
import { YetkiGuard } from './shared/yetki/infrastructure/yetki.guard.js';
import { YetkiModule } from './shared/yetki/yetki.module.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    HttpTemeliModule,
    MessagingModule,
    OlayModule,
    IzModule,
    ErisimModule,
    KimlikModule,
    GuvenlikModule,
    // Kaynak kataloğu uygulamada yalnız burada kurulur (TS-002 AK-42).
    YetkiModule.forRoot(
      prismaKaynakKatalogu(KIMLIK_KAYNAKLARI, KIMLIK_SISTEM_ALANLARI),
    ),
  ],
  // Ortak koddaki sözleşmeler burada uygulayan feature sınıfına bağlanır (TS-002 "Yapı"). Kimlik
  // guard'ı ve ardından yetki guard'ı bütün uçlara burada bağlanır; genel guard'lar bu sırayla
  // çalışır. İkisi de sözleşmeleri bu modülden alır (TS-002 AK-12, AK-18).
  providers: [
    { provide: OTURUM_DENETIMI, useExisting: OturumDenetimiHandler },
    { provide: YETKI_VERISI, useExisting: KimlikYetkiVerisi },
    YetkiBellegi,
    { provide: APP_GUARD, useClass: KimlikGuard },
    { provide: APP_GUARD, useClass: YetkiGuard },
  ],
})
export class AppModule {}
