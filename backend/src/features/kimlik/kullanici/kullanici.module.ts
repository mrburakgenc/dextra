// Kullanıcı alt özelliğinin modülü (TS-002 AK-30): yedi işin işleyicilerini, denetleyiciyi ve iki
// repository gerçeklemesini bağlar.
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/infrastructure/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { KullaniciAcHandler } from './application/commands/kullanici-ac/kullanici-ac.handler.js';
import { KullaniciGuncelleHandler } from './application/commands/kullanici-guncelle/kullanici-guncelle.handler.js';
import { KullaniciPasifeAlHandler } from './application/commands/kullanici-pasife-al/kullanici-pasife-al.handler.js';
import { KullaniciYenidenAcHandler } from './application/commands/kullanici-yeniden-ac/kullanici-yeniden-ac.handler.js';
import { ParolaBaglantisiUretHandler } from './application/commands/parola-baglantisi-uret/parola-baglantisi-uret.handler.js';
import { KullaniciListeleHandler } from './application/queries/kullanici-listele/kullanici-listele.handler.js';
import { KullaniciOkuHandler } from './application/queries/kullanici-oku/kullanici-oku.handler.js';
import {
  KULLANICI_OKUMA_REPO,
  KULLANICI_YAZMA_REPO,
} from './domain/repositories/i-kullanici.repository.js';
import { kullaniciOkumaPrismaRepository } from './infrastructure/repositories/kullanici-okuma.prisma-repository.js';
import { PrismaKullaniciYazmaRepo } from './infrastructure/repositories/kullanici-yazma.prisma-repository.js';
import { KullaniciController } from './presentation/kullanici.controller.js';

// Kaynağı kendi sorgularıyla okur ve kendi deyimleriyle yazar; süzgeci ve yazmanın sırasını yetki
// kapısının okuma ve yazma yüzü verir (TS-007); kapıları kök modülde bir kez kurulan genel YetkiModule
// verir (TS-002 AK-42). Bütünlük sorusu, genel sayaç ve öbür çekirdek parçalar çekirdek modülden gelir.
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [KullaniciController],
  providers: [
    KullaniciListeleHandler,
    KullaniciOkuHandler,
    KullaniciAcHandler,
    KullaniciGuncelleHandler,
    ParolaBaglantisiUretHandler,
    KullaniciPasifeAlHandler,
    KullaniciYenidenAcHandler,
    { provide: KULLANICI_YAZMA_REPO, useClass: PrismaKullaniciYazmaRepo },
  ],
})
export class KullaniciModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(KULLANICI_OKUMA_REPO, (istemci) =>
      kullaniciOkumaPrismaRepository(istemci, kapi),
    );
  }
}
