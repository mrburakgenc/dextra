import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './shared/health/health.module.js';
import { MessagingModule } from './shared/messaging/messaging.module.js';

@Module({
  imports: [DatabaseModule, HealthModule, MessagingModule],
})
export class AppModule {}
