import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { MessagingModule } from '../../../shared/messaging/messaging.module.js';
import { TohumDefteri } from '../../../shared/tohum/tohum-defteri.js';
import { TohumModule } from '../../../shared/tohum/tohum.module.js';
import { ParolaBaglantisi } from './baglanti/parola-baglantisi.js';
import {
  PAROLA_BAGLANTISI_REPO,
  parolaBaglantisiRepo,
} from './baglanti/parola-baglantisi.repository.js';
import {
  KULLANICI_CEKIRDEK_REPO,
  kullaniciCekirdekRepo,
} from './cekirdek/kullanici.repository.js';
import {
  OTURUM_CEKIRDEK_REPO,
  oturumCekirdekRepo,
} from './cekirdek/oturum.repository.js';
import {
  UYELIK_CEKIRDEK_REPO,
  uyelikCekirdekRepo,
} from './cekirdek/uyelik.repository.js';
import {
  YETKI_SURUMU_CEKIRDEK_REPO,
  yetkiSurumuCekirdekRepo,
} from './cekirdek/yetki-surumu.repository.js';
import { GenelSayac } from './genel-sayac.js';
import { KisiKilidi } from './kisi-kilidi.js';
import { KisininSayisi } from './kisinin-sayisi.js';
import { KokUyelik } from './kok-uyelik.js';
import { TohumYardimcisi } from './tohum-yardimcisi.js';
import {
  KIMLIK_KURULUM_GOCU,
  KimlikKurulumGocu,
} from './tohum/kimlik-kurulum.goc.js';
import { KURULUM_REPO, kurulumRepo } from './tohum/kurulum.repository.js';

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
  ],
  exports: [GenelSayac, KisininSayisi, KisiKilidi, KokUyelik, ParolaBaglantisi],
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
  }
}
