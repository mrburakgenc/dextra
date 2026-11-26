import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module.js';
import { ErisimKaydiYazici } from './erisim-kaydi.js';
import { RetKaydiOkuyucu, RetKaydiYazici } from './ret-kaydi.js';

// Erişim kaydı: yazıcı bütün uçlara bağlanır (erisim-kaydi.ts). Ret kaydının yazıcısı da aynı yoldan,
// aynı istemciyle bağlanır (ret-kaydi.ts). Dışa yalnız ret kaydının okuyucusu verilir (teşhis).
@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ErisimKaydiYazici },
    { provide: APP_INTERCEPTOR, useClass: RetKaydiYazici },
    RetKaydiOkuyucu,
  ],
  exports: [RetKaydiOkuyucu],
})
export class ErisimModule {}
