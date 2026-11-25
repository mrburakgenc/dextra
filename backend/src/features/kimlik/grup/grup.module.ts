import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { GrupGuncelleHandler } from './application/grup-guncelle.handler.js';
import { GrupListeleHandler } from './application/grup-listele.handler.js';
import { GrupOkuHandler } from './application/grup-oku.handler.js';
import { GrupOlusturHandler } from './application/grup-olustur.handler.js';
import { GrupSilHandler } from './application/grup-sil.handler.js';
import { GrupTasiHandler } from './application/grup-tasi.handler.js';
import { GRUP_REPO, GrupYazmaRepo } from './domain/grup.repository.js';
import {
  GrupKapiYazmaRepo,
  grupPrismaRepository,
} from './infrastructure/grup.prisma-repository.js';
import { GrupController } from './presentation/grup.controller.js';

// Grup alt özelliği (TS-002 AK-30). Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez
// kurulan genel YetkiModule verir (TS-002 AK-42).
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
    { provide: GrupYazmaRepo, useClass: GrupKapiYazmaRepo },
  ],
})
export class GrupModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(GRUP_REPO, grupPrismaRepository(kapi));
  }
}
