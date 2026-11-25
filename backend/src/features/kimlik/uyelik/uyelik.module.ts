import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { UyelikKaldirHandler } from './application/uyelik-kaldir.handler.js';
import { UyelikListeleHandler } from './application/uyelik-listele.handler.js';
import { UyelikOkuHandler } from './application/uyelik-oku.handler.js';
import { UyelikVerHandler } from './application/uyelik-ver.handler.js';
import { UYELIK_REPO, UyelikYazmaRepo } from './domain/uyelik.repository.js';
import {
  UyelikKapiYazmaRepo,
  uyelikPrismaRepository,
} from './infrastructure/uyelik.prisma-repository.js';
import { UyelikController } from './presentation/uyelik.controller.js';

// Üyelik alt özelliği (TS-002 AK-30). Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez
// kurulan genel YetkiModule verir (TS-002 AK-42).
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [UyelikController],
  providers: [
    UyelikListeleHandler,
    UyelikOkuHandler,
    UyelikVerHandler,
    UyelikKaldirHandler,
    { provide: UyelikYazmaRepo, useClass: UyelikKapiYazmaRepo },
  ],
})
export class UyelikModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(UYELIK_REPO, uyelikPrismaRepository(kapi));
  }
}
