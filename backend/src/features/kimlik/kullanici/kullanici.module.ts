import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { OkumaKapisi } from '../../../shared/yetki/okuma-kapisi.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { KullaniciAcHandler } from './application/kullanici-ac.handler.js';
import { KullaniciGuncelleHandler } from './application/kullanici-guncelle.handler.js';
import { KullaniciListeleHandler } from './application/kullanici-listele.handler.js';
import { KullaniciOkuHandler } from './application/kullanici-oku.handler.js';
import { ParolaBaglantisiUretHandler } from './application/parola-baglantisi-uret.handler.js';
import {
  KULLANICI_REPO,
  KullaniciYazmaRepo,
} from './domain/kullanici.repository.js';
import {
  KullaniciKapiYazmaRepo,
  kullaniciPrismaRepository,
} from './infrastructure/kullanici.prisma-repository.js';
import { KullaniciController } from './presentation/kullanici.controller.js';

// Kullanıcı alt özelliği (TS-002 AK-30). Kaynağa yetki kapısından erişir; kapıyı kök modülde bir kez
// kurulan genel YetkiModule verir (TS-002 AK-42).
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [KullaniciController],
  providers: [
    KullaniciListeleHandler,
    KullaniciOkuHandler,
    KullaniciAcHandler,
    KullaniciGuncelleHandler,
    ParolaBaglantisiUretHandler,
    { provide: KullaniciYazmaRepo, useClass: KullaniciKapiYazmaRepo },
  ],
})
export class KullaniciModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(KULLANICI_REPO, kullaniciPrismaRepository(kapi));
  }
}
