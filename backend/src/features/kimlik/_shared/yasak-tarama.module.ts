import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { YasakTaramasi } from './application/yasak-taramasi.js';
import { YASAK_TARAMA_CEKIRDEK_REPO } from './domain/repositories/i-yasak-tarama-cekirdek.repository.js';
import { yasakTaramaCekirdekRepo } from './infrastructure/repositories/yasak-tarama-cekirdek.prisma-repository.js';

// Göçten önceki yasak taraması (TS-008 kapanan AU-36): yalnız tarama komutunun kök modülü içe aktarır;
// uygulamanın kök modülünde yoktur, çekirdek parça yalnız tarama komutunda kayıtlıdır.
@Module({
  imports: [DatabaseModule],
  providers: [YasakTaramasi],
  exports: [YasakTaramasi],
})
export class YasakTaramaModule {
  constructor(registrar: Registrar) {
    registrar.register(YASAK_TARAMA_CEKIRDEK_REPO, yasakTaramaCekirdekRepo);
  }
}
