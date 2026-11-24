import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KimlikModule } from './features/kimlik/kimlik.module.js';
import { OturumDenetimiHandler } from './features/kimlik/oturum/application/oturum-denetimi.handler.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { GuvenlikModule } from './shared/guvenlik/guvenlik.module.js';
import { KimlikGuard } from './shared/guvenlik/kimlik.guard.js';
import { HealthModule } from './shared/health/health.module.js';
import { HttpTemeliModule } from './shared/http/http-temeli.module.js';
import { OTURUM_DENETIMI } from './shared/kimlik/oturum-denetimi.contract.js';
import { MessagingModule } from './shared/messaging/messaging.module.js';
import { OlayModule } from './shared/messaging/olay/olay.module.js';
import { IzModule } from './shared/observability/iz/iz.module.js';

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
  // guard'ı bütün uçlara burada bağlanır; sözleşmeyi bu modülden alır (TS-002 AK-12).
  providers: [
    { provide: OTURUM_DENETIMI, useExisting: OturumDenetimiHandler },
    { provide: APP_GUARD, useClass: KimlikGuard },
  ],
})
export class AppModule {}
