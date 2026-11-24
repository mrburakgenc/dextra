import { Module } from '@nestjs/common';
import { KimlikModule } from './features/kimlik/kimlik.module.js';
import { OturumDenetimiHandler } from './features/kimlik/oturum/application/oturum-denetimi.handler.js';
import { DatabaseModule } from './shared/database/database.module.js';
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
  ],
  // Ortak koddaki sözleşmeler burada uygulayan feature sınıfına bağlanır (TS-002 "Yapı").
  providers: [{ provide: OTURUM_DENETIMI, useExisting: OturumDenetimiHandler }],
})
export class AppModule {}
