import { Module } from '@nestjs/common';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';

// Üyelik alt özelliği (TS-002 AK-30); bugün boştur, yönetim görevleri dosyalarını buraya ekler.
@Module({
  imports: [KimlikCekirdekModule],
})
export class UyelikModule {}
