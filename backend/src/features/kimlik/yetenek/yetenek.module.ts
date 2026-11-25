import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { YetenekListeleHandler } from './application/yetenek-listele.handler.js';
import { YetenekOkuHandler } from './application/yetenek-oku.handler.js';
import { YetenekOlusturHandler } from './application/yetenek-olustur.handler.js';
import { YetenekSilHandler } from './application/yetenek-sil.handler.js';
import {
  YETENEK_REPO,
  YetenekYazmaRepo,
} from './domain/yetenek.repository.js';
import {
  YetenekKapiYazmaRepo,
  yetenekPrismaRepository,
} from './infrastructure/yetenek.prisma-repository.js';
import { YetenekController } from './presentation/yetenek.controller.js';

// Yetenek alt özelliği (TS-002 AK-30). Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez
// kurulan genel YetkiModule verir (TS-002 AK-42).
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [YetenekController],
  providers: [
    YetenekListeleHandler,
    YetenekOkuHandler,
    YetenekOlusturHandler,
    YetenekSilHandler,
    { provide: YetenekYazmaRepo, useClass: YetenekKapiYazmaRepo },
  ],
})
export class YetenekModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(YETENEK_REPO, yetenekPrismaRepository(kapi));
  }
}
