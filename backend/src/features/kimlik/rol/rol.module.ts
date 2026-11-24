import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { RolSorgulariHandler } from './application/rol-sorgulari.handler.js';
import { ROL_REPO } from './domain/rol.repository.js';
import { rolPrismaRepository } from './infrastructure/rol.prisma-repository.js';
import { RolController } from './presentation/rol.controller.js';

// Rol alt özelliği (TS-002 AK-30). Rol ve izin kaynaklarını yetki kapısının okuma yüzünden okur;
// kapıyı kök modülde bir kez kurulan genel YetkiModule verir (TS-002 AK-42).
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [RolController],
  providers: [RolSorgulariHandler],
})
export class RolModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(ROL_REPO, (istemci) =>
      rolPrismaRepository(istemci, kapi),
    );
  }
}
