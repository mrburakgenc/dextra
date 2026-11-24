import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module.js';
import { ErisimKaydiYazici } from './erisim-kaydi.js';

// Erişim kaydı: yazıcı bütün uçlara bağlanır (erisim-kaydi.ts). Dışa bir şey verilmez.
@Module({
  imports: [DatabaseModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ErisimKaydiYazici }],
})
export class ErisimModule {}
