import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { GrupListeleHandler } from './application/grup-listele.handler.js';
import { GrupOkuHandler } from './application/grup-oku.handler.js';
import { GRUP_REPO } from './domain/grup.repository.js';
import { grupPrismaRepository } from './infrastructure/grup.prisma-repository.js';
import { GrupController } from './presentation/grup.controller.js';

// Grup alt özelliği (TS-002 AK-30). Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez
// kurulan genel YetkiModule verir (TS-002 AK-42).
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [GrupController],
  providers: [GrupListeleHandler, GrupOkuHandler],
})
export class GrupModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(GRUP_REPO, grupPrismaRepository(kapi));
  }
}
