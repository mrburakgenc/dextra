import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import {
  KAYNAK_KATALOGU,
  prismaKaynakKatalogu,
} from '../../../shared/yetki/kaynak-katalogu.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { KIMLIK_KAYNAKLARI } from '../_shared/yetki-verisi/yetki-verisi.js';
import { GrupListeleHandler } from './application/grup-listele.handler.js';
import { GrupOkuHandler } from './application/grup-oku.handler.js';
import { GRUP_REPO } from './domain/grup.repository.js';
import { grupPrismaRepository } from './infrastructure/grup.prisma-repository.js';
import { GrupController } from './presentation/grup.controller.js';

// Grup alt özelliği (TS-002 AK-30). Kaynağa yetki kapısından erişir; kapının istediği kaynak
// kataloğu kök modüldekiyle aynı listeden kurulur, çünkü kök modülün sağlayıcıları alt modüllere
// görünmez.
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [GrupController],
  providers: [
    {
      provide: KAYNAK_KATALOGU,
      useValue: prismaKaynakKatalogu(KIMLIK_KAYNAKLARI),
    },
    OkumaKapisi,
    GrupListeleHandler,
    GrupOkuHandler,
  ],
})
export class GrupModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(GRUP_REPO, grupPrismaRepository(kapi));
  }
}
