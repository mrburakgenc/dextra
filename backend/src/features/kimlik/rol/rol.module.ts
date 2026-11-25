// Rol alt özelliğinin modülü (TS-002 AK-30): altı işin işleyicilerini, denetleyiciyi ve iki repository
// gerçeklemesini bağlar.
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/infrastructure/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { RolAdiniDegistirHandler } from './application/commands/rol-adini-degistir/rol-adini-degistir.handler.js';
import { RolOlusturHandler } from './application/commands/rol-olustur/rol-olustur.handler.js';
import { RolSilHandler } from './application/commands/rol-sil/rol-sil.handler.js';
import { IzinListeleHandler } from './application/queries/izin-listele/izin-listele.handler.js';
import { RolListeleHandler } from './application/queries/rol-listele/rol-listele.handler.js';
import { RolOkuHandler } from './application/queries/rol-oku/rol-oku.handler.js';
import {
  ROL_OKUMA_REPO,
  ROL_YAZMA_REPO,
} from './domain/repositories/i-rol.repository.js';
import { rolOkumaPrismaRepository } from './infrastructure/repositories/rol-okuma.prisma-repository.js';
import { KapiRolYazmaRepo } from './infrastructure/repositories/rol-yazma.kapi-repository.js';
import { RolController } from './presentation/rol.controller.js';

// Rol ve izin kaynaklarını yetki kapısının okuma yüzünden okur, rolü yazma yüzünden yazar; kapıları
// kök modülde bir kez kurulan genel YetkiModule verir (TS-002 AK-42). Genel sayaç ve bütünlük sorusu
// çekirdek modülden gelir.
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [RolController],
  providers: [
    RolOlusturHandler,
    RolAdiniDegistirHandler,
    RolSilHandler,
    RolListeleHandler,
    RolOkuHandler,
    IzinListeleHandler,
    { provide: ROL_YAZMA_REPO, useClass: KapiRolYazmaRepo },
  ],
})
export class RolModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(ROL_OKUMA_REPO, (istemci) =>
      rolOkumaPrismaRepository(istemci, kapi),
    );
  }
}
