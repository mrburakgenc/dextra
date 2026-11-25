import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/infrastructure/registrar.js';
import { MessagingModule } from '../../../shared/messaging/messaging.module.js';
import { TohumDefteri } from '../../../shared/tohum/application/tohum-defteri.js';
import { TohumModule } from '../../../shared/tohum/tohum.module.js';
import { ButunlukSorusu } from './application/butunluk-sorusu.js';
import { GenelSayac } from './application/genel-sayac.js';
import { KisiKilidi } from './application/kisi-kilidi.js';
import { KisininSayisi } from './application/kisinin-sayisi.js';
import { KokUyelik } from './application/kok-uyelik.js';
import { ParolaBaglantisi } from './application/parola-baglantisi.js';
import { ParolaSirri } from './application/parola-sirri.js';
import { TohumYardimcisi } from './application/tohum-yardimcisi.js';
import { BUTUNLUK_CEKIRDEK_REPO } from './domain/repositories/i-butunluk-cekirdek.repository.js';
import { KULLANICI_CEKIRDEK_REPO } from './domain/repositories/i-kullanici-cekirdek.repository.js';
import { KULLANICI_SIRRI_CEKIRDEK_REPO } from './domain/repositories/i-kullanici-sirri-cekirdek.repository.js';
import { KURULUM_REPO } from './domain/repositories/i-kurulum.repository.js';
import { OTURUM_CEKIRDEK_REPO } from './domain/repositories/i-oturum-cekirdek.repository.js';
import { PAROLA_BAGLANTISI_REPO } from './domain/repositories/i-parola-baglantisi.repository.js';
import { UYELIK_CEKIRDEK_REPO } from './domain/repositories/i-uyelik-cekirdek.repository.js';
import { YETKI_SURUMU_CEKIRDEK_REPO } from './domain/repositories/i-yetki-surumu-cekirdek.repository.js';
import { butunlukCekirdekRepo } from './infrastructure/repositories/butunluk-cekirdek.prisma-repository.js';
import { kullaniciCekirdekRepo } from './infrastructure/repositories/kullanici-cekirdek.prisma-repository.js';
import { kullaniciSirriCekirdekRepo } from './infrastructure/repositories/kullanici-sirri-cekirdek.prisma-repository.js';
import { kurulumRepo } from './infrastructure/repositories/kurulum.prisma-repository.js';
import { oturumCekirdekRepo } from './infrastructure/repositories/oturum-cekirdek.prisma-repository.js';
import { parolaBaglantisiRepo } from './infrastructure/repositories/parola-baglantisi.prisma-repository.js';
import { uyelikCekirdekRepo } from './infrastructure/repositories/uyelik-cekirdek.prisma-repository.js';
import { yetkiSurumuCekirdekRepo } from './infrastructure/repositories/yetki-surumu-cekirdek.prisma-repository.js';
import {
  KIMLIK_KURULUM_GOCU,
  KimlikKurulumGocu,
} from './infrastructure/tohum/kimlik-kurulum.goc.js';

// Kimlik'in çekirdek modülü (TS-002 AK-30). Alt özelliklerin ortak kullandığı çekirdek parçalar burada
// sağlanır ve alt modüllere dışa verilir; çekirdek repository'ler Unit of Work'e
// burada Registrar ile tanıtılır. Tohum göçü tohum defterine yalnız buradan bildirilir.
@Module({
  imports: [DatabaseModule, MessagingModule, TohumModule],
  providers: [
    GenelSayac,
    KisininSayisi,
    KisiKilidi,
    KokUyelik,
    TohumYardimcisi,
    KimlikKurulumGocu,
    ParolaBaglantisi,
    ButunlukSorusu,
    ParolaSirri,
  ],
  exports: [
    GenelSayac,
    KisininSayisi,
    KisiKilidi,
    KokUyelik,
    ParolaBaglantisi,
    ButunlukSorusu,
    ParolaSirri,
  ],
})
export class KimlikCekirdekModule {
  constructor(
    registrar: Registrar,
    defter: TohumDefteri,
    kurulumGocu: KimlikKurulumGocu,
  ) {
    registrar.register(YETKI_SURUMU_CEKIRDEK_REPO, yetkiSurumuCekirdekRepo);
    registrar.register(KULLANICI_CEKIRDEK_REPO, kullaniciCekirdekRepo);
    registrar.register(OTURUM_CEKIRDEK_REPO, oturumCekirdekRepo);
    registrar.register(UYELIK_CEKIRDEK_REPO, uyelikCekirdekRepo);
    registrar.register(KURULUM_REPO, kurulumRepo);
    defter.bildir(KIMLIK_KURULUM_GOCU, (ad, islem) =>
      kurulumGocu.uygula(ad, islem),
    );
    registrar.register(PAROLA_BAGLANTISI_REPO, parolaBaglantisiRepo);
    registrar.register(BUTUNLUK_CEKIRDEK_REPO, butunlukCekirdekRepo);
    registrar.register(
      KULLANICI_SIRRI_CEKIRDEK_REPO,
      kullaniciSirriCekirdekRepo,
    );
  }
}
