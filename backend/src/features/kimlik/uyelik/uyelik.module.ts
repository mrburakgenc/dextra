// Üyelik alt özelliğinin modülü (TS-002 AK-30): dört işin işleyicilerini, denetleyiciyi ve iki
// repository gerçeklemesini bağlar.
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { UyelikKaldirHandler } from './application/commands/uyelik-kaldir/uyelik-kaldir.handler.js';
import { UyelikVerHandler } from './application/commands/uyelik-ver/uyelik-ver.handler.js';
import { UyelikListeleHandler } from './application/queries/uyelik-listele/uyelik-listele.handler.js';
import { UyelikOkuHandler } from './application/queries/uyelik-oku/uyelik-oku.handler.js';
import {
  UYELIK_OKUMA_REPO,
  UYELIK_YAZMA_REPO,
} from './domain/repositories/i-uyelik.repository.js';
import { uyelikOkumaPrismaRepository } from './infrastructure/repositories/uyelik-okuma.prisma-repository.js';
import { KapiUyelikYazmaRepo } from './infrastructure/repositories/uyelik-yazma.kapi-repository.js';
import { UyelikController } from './presentation/uyelik.controller.js';

// Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez kurulan genel YetkiModule verir (TS-002
// AK-42).
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [UyelikController],
  providers: [
    UyelikListeleHandler,
    UyelikOkuHandler,
    UyelikVerHandler,
    UyelikKaldirHandler,
    { provide: UYELIK_YAZMA_REPO, useClass: KapiUyelikYazmaRepo },
  ],
})
export class UyelikModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(UYELIK_OKUMA_REPO, uyelikOkumaPrismaRepository(kapi));
  }
}
