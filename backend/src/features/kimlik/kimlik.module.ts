import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { Registrar } from '../../shared/database/registrar.js';
import { MessagingModule } from '../../shared/messaging/messaging.module.js';
import { TohumDefteri } from '../../shared/tohum/tohum-defteri.js';
import { TohumModule } from '../../shared/tohum/tohum.module.js';
import {
  KULLANICI_CEKIRDEK_REPO,
  kullaniciCekirdekRepo,
} from './_shared/cekirdek/kullanici.repository.js';
import {
  OTURUM_CEKIRDEK_REPO,
  oturumCekirdekRepo,
} from './_shared/cekirdek/oturum.repository.js';
import {
  UYELIK_CEKIRDEK_REPO,
  uyelikCekirdekRepo,
} from './_shared/cekirdek/uyelik.repository.js';
import {
  YETKI_SURUMU_CEKIRDEK_REPO,
  yetkiSurumuCekirdekRepo,
} from './_shared/cekirdek/yetki-surumu.repository.js';
import { GenelSayac } from './_shared/genel-sayac.js';
import { KisiKilidi } from './_shared/kisi-kilidi.js';
import { KisininSayisi } from './_shared/kisinin-sayisi.js';
import { KokUyelik } from './_shared/kok-uyelik.js';
import { TohumYardimcisi } from './_shared/tohum-yardimcisi.js';
import {
  KIMLIK_KURULUM_GOCU,
  KimlikKurulumGocu,
} from './_shared/tohum/kimlik-kurulum.goc.js';
import {
  KURULUM_REPO,
  kurulumRepo,
} from './_shared/tohum/kurulum.repository.js';

// Kimlik feature'ı. Çekirdek repository'ler Unit of Work'e Registrar ile tanıtılır; çekirdek
// parçalar yalnız bu feature'ın içinde kullanılır, dışa verilmez. Tohum göçleri tohum defterine
// sırayla bildirilir.
@Module({
  imports: [DatabaseModule, MessagingModule, TohumModule],
  providers: [
    GenelSayac,
    KisininSayisi,
    KisiKilidi,
    KokUyelik,
    TohumYardimcisi,
    KimlikKurulumGocu,
  ],
})
export class KimlikModule {
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
  }
}
