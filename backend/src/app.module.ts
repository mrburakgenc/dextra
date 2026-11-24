import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KimlikModule } from './features/kimlik/kimlik.module.js';
import {
  KIMLIK_KAYNAKLARI,
  KimlikYetkiVerisi,
} from './features/kimlik/_shared/yetki-verisi/yetki-verisi.js';
import { OturumDenetimiHandler } from './features/kimlik/oturum/application/oturum-denetimi.handler.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { GuvenlikModule } from './shared/guvenlik/guvenlik.module.js';
import { KimlikGuard } from './shared/guvenlik/kimlik.guard.js';
import { HealthModule } from './shared/health/health.module.js';
import { HttpTemeliModule } from './shared/http/http-temeli.module.js';
import { OTURUM_DENETIMI } from './shared/kimlik/oturum-denetimi.contract.js';
import { YETKI_VERISI } from './shared/kimlik/yetki-verisi.contract.js';
import { MessagingModule } from './shared/messaging/messaging.module.js';
import { OlayModule } from './shared/messaging/olay/olay.module.js';
import { IzModule } from './shared/observability/iz/iz.module.js';
import {
  KAYNAK_KATALOGU,
  prismaKaynakKatalogu,
} from './shared/yetki/kaynak-katalogu.js';
import { YetkiBellegi } from './shared/yetki/yetki-bellegi.js';
import { YetkiGuard } from './shared/yetki/yetki.guard.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    HttpTemeliModule,
    MessagingModule,
    OlayModule,
    IzModule,
    KimlikModule,
    GuvenlikModule,
  ],
  // Ortak koddaki sözleşmeler burada uygulayan feature sınıfına bağlanır (TS-002 "Yapı"). Kimlik
  // guard'ı ve ardından yetki guard'ı bütün uçlara burada bağlanır; genel guard'lar bu sırayla
  // çalışır. İkisi de sözleşmeleri bu modülden alır (TS-002 AK-12, AK-18).
  providers: [
    { provide: OTURUM_DENETIMI, useExisting: OturumDenetimiHandler },
    { provide: YETKI_VERISI, useExisting: KimlikYetkiVerisi },
    {
      provide: KAYNAK_KATALOGU,
      useValue: prismaKaynakKatalogu(KIMLIK_KAYNAKLARI),
    },
    YetkiBellegi,
    { provide: APP_GUARD, useClass: KimlikGuard },
    { provide: APP_GUARD, useClass: YetkiGuard },
  ],
})
export class AppModule {}
