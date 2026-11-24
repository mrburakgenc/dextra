import { Controller, Get } from '@nestjs/common';
import { HerkeseAcik } from '../guvenlik/isaretler.js';

export interface HealthStatus {
  readonly status: 'ok';
}

@Controller('health')
export class HealthController {
  @Get()
  @HerkeseAcik()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
