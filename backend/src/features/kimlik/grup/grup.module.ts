// Grup alt özelliğinin modülü (TS-002 AK-30): altı işin işleyicilerini, denetleyiciyi ve iki
// repository gerçeklemesini bağlar.
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/infrastructure/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { GrupGuncelleHandler } from './application/commands/grup-guncelle/grup-guncelle.handler.js';
import { GrupOlusturHandler } from './application/commands/grup-olustur/grup-olustur.handler.js';
import { GrupSilHandler } from './application/commands/grup-sil/grup-sil.handler.js';
import { GrupTasiHandler } from './application/commands/grup-tasi/grup-tasi.handler.js';
import { GrupListeleHandler } from './application/queries/grup-listele/grup-listele.handler.js';
import { GrupOkuHandler } from './application/queries/grup-oku/grup-oku.handler.js';
import {
  GRUP_OKUMA_REPO,
  GRUP_YAZMA_REPO,
} from './domain/repositories/i-grup.repository.js';
import { grupOkumaPrismaRepository } from './infrastructure/repositories/grup-okuma.prisma-repository.js';
import { PrismaGrupYazmaRepo } from './infrastructure/repositories/grup-yazma.prisma-repository.js';
import { GrupController } from './presentation/grup.controller.js';

// Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez kurulan genel YetkiModule verir (TS-002
// AK-42). Genel sayaç ve bütünlük sorusu çekirdek modülden gelir.
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [GrupController],
  providers: [
    GrupListeleHandler,
    GrupOkuHandler,
    GrupOlusturHandler,
    GrupGuncelleHandler,
    GrupTasiHandler,
    GrupSilHandler,
    { provide: GRUP_YAZMA_REPO, useClass: PrismaGrupYazmaRepo },
  ],
})
export class GrupModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(GRUP_OKUMA_REPO, grupOkumaPrismaRepository(kapi));
  }
}
