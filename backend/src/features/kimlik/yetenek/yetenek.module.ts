// Yetenek alt özelliğinin modülü (TS-002 AK-30): beş işin işleyicilerini, satır kurma yardımcısını,
// denetleyiciyi ve iki repository gerçeklemesini bağlar.
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { ErisimModule } from '../../../shared/observability/erisim/erisim.module.js';
import { OkumaKapisi } from '../../../shared/yetki/infrastructure/okuma-kapisi.js';
import { TeshisKapisi } from '../../../shared/yetki/infrastructure/teshis-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { YetenekYazimi } from './application/_shared/yetenek-yazimi.js';
import { YetenekOlusturHandler } from './application/commands/yetenek-olustur/yetenek-olustur.handler.js';
import { YetenekSilHandler } from './application/commands/yetenek-sil/yetenek-sil.handler.js';
import { YetenekYenileHandler } from './application/commands/yetenek-yenile/yetenek-yenile.handler.js';
import { YetenekListeleHandler } from './application/queries/yetenek-listele/yetenek-listele.handler.js';
import { YetenekOkuHandler } from './application/queries/yetenek-oku/yetenek-oku.handler.js';
import { YetenekTeshisHandler } from './application/queries/yetenek-teshis/yetenek-teshis.handler.js';
import {
  YETENEK_REPO,
  YETENEK_YAZMA_REPO,
} from './domain/repositories/i-yetenek.repository.js';
import { YETENEK_TESHIS_REPO } from './domain/repositories/i-yetenek-teshis.repository.js';
import { yetenekOkumaPrismaRepository } from './infrastructure/repositories/yetenek-okuma.prisma-repository.js';
import { yetenekTeshisPrismaRepository } from './infrastructure/repositories/yetenek-teshis.prisma-repository.js';
import { PrismaYetenekYazmaRepo } from './infrastructure/repositories/yetenek-yazma.prisma-repository.js';
import { YetenekController } from './presentation/yetenek.controller.js';

// Yetenek ve izin kaynaklarını kendi sorgularıyla okur, yeteneği kendi deyimleriyle yazar; süzgeci ve
// yazmanın sırasını yetki kapısının okuma ve yazma yüzü verir (TS-007); kapıları kök modülde bir kez
// kurulan genel YetkiModule verir (TS-002 AK-42). Genel sayaç ve bütünlük sorusu çekirdek modülden gelir.
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule, ErisimModule],
  controllers: [YetenekController],
  providers: [
    YetenekListeleHandler,
    YetenekOkuHandler,
    YetenekOlusturHandler,
    YetenekSilHandler,
    YetenekYenileHandler,
    YetenekTeshisHandler,
    YetenekYazimi,
    { provide: YETENEK_YAZMA_REPO, useClass: PrismaYetenekYazmaRepo },
  ],
})
export class YetenekModule {
  constructor(
    registrar: Registrar,
    kapi: OkumaKapisi,
    teshisKapisi: TeshisKapisi,
  ) {
    registrar.register(YETENEK_REPO, yetenekOkumaPrismaRepository(kapi));
    registrar.register(
      YETENEK_TESHIS_REPO,
      yetenekTeshisPrismaRepository(kapi, teshisKapisi),
    );
  }
}
