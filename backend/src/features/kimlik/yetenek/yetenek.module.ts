// Yetenek alt özelliğinin modülü (TS-002 AK-30): beş işin işleyicilerini, satır kurma yardımcısını,
// denetleyiciyi ve iki repository gerçeklemesini bağlar.
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/infrastructure/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { YetenekYazimi } from './application/_shared/yetenek-yazimi.js';
import { YetenekOlusturHandler } from './application/commands/yetenek-olustur/yetenek-olustur.handler.js';
import { YetenekSilHandler } from './application/commands/yetenek-sil/yetenek-sil.handler.js';
import { YetenekYenileHandler } from './application/commands/yetenek-yenile/yetenek-yenile.handler.js';
import { YetenekListeleHandler } from './application/queries/yetenek-listele/yetenek-listele.handler.js';
import { YetenekOkuHandler } from './application/queries/yetenek-oku/yetenek-oku.handler.js';
import {
  YETENEK_REPO,
  YETENEK_YAZMA_REPO,
} from './domain/repositories/i-yetenek.repository.js';
import { yetenekOkumaPrismaRepository } from './infrastructure/repositories/yetenek-okuma.prisma-repository.js';
import { KapiYetenekYazmaRepo } from './infrastructure/repositories/yetenek-yazma.kapi-repository.js';
import { YetenekController } from './presentation/yetenek.controller.js';

// Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez kurulan genel YetkiModule verir (TS-002
// AK-42). Genel sayaç ve bütünlük sorusu çekirdek modülden gelir.
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [YetenekController],
  providers: [
    YetenekListeleHandler,
    YetenekOkuHandler,
    YetenekOlusturHandler,
    YetenekSilHandler,
    YetenekYenileHandler,
    YetenekYazimi,
    { provide: YETENEK_YAZMA_REPO, useClass: KapiYetenekYazmaRepo },
  ],
})
export class YetenekModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(YETENEK_REPO, yetenekOkumaPrismaRepository(kapi));
  }
}
