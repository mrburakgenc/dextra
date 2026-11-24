import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './shared/health/health.module.js';
import { MessagingModule } from './shared/messaging/messaging.module.js';
import { OlayModule } from './shared/messaging/olay/olay.module.js';
import { IzModule } from './shared/observability/iz/iz.module.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    MessagingModule,
    OlayModule,
    IzModule,
  ],
})
export class AppModule {}
