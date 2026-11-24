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
import { KullaniciListeleHandler } from './application/kullanici-listele.handler.js';
import { KullaniciOkuHandler } from './application/kullanici-oku.handler.js';
import { KULLANICI_REPO } from './domain/kullanici.repository.js';
import { kullaniciPrismaRepository } from './infrastructure/kullanici.prisma-repository.js';
import { KullaniciController } from './presentation/kullanici.controller.js';

// Kullanıcı alt özelliği (TS-002 AK-30). Kaynağa yetki kapısından erişir; kapının istediği kaynak
// kataloğu kök modüldekiyle aynı listeden kurulur, çünkü kök modülün sağlayıcıları alt modüllere
// görünmez.
@Module({
  imports: [DatabaseModule, KimlikCekirdekModule],
  controllers: [KullaniciController],
  providers: [
    {
      provide: KAYNAK_KATALOGU,
      useValue: prismaKaynakKatalogu(KIMLIK_KAYNAKLARI),
    },
    OkumaKapisi,
    KullaniciListeleHandler,
    KullaniciOkuHandler,
  ],
})
export class KullaniciModule {
  constructor(registrar: Registrar, kapi: OkumaKapisi) {
    registrar.register(KULLANICI_REPO, kullaniciPrismaRepository(kapi));
  }
}
