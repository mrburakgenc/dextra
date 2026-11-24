import { Module } from '@nestjs/common';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './shared/health/health.module.js';

@Module({
  imports: [DatabaseModule, HealthModule],
})
export class AppModule {}
