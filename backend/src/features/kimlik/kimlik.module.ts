import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { Registrar } from '../../shared/database/registrar.js';
import { MessagingModule } from '../../shared/messaging/messaging.module.js';
import { TohumDefteri } from '../../shared/tohum/tohum-defteri.js';
import { TohumModule } from '../../shared/tohum/tohum.module.js';
import { ParolaBaglantisi } from './_shared/baglanti/parola-baglantisi.js';
import {
  PAROLA_BAGLANTISI_REPO,
  parolaBaglantisiRepo,
} from './_shared/baglanti/parola-baglantisi.repository.js';
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
import { OturumDenetimiHandler } from './oturum/application/oturum-denetimi.handler.js';
import { OTURUM_DENETIMI_REPO } from './oturum/domain/oturum-denetimi.repository.js';
import { oturumDenetimiPrismaRepository } from './oturum/infrastructure/oturum-denetimi.prisma-repository.js';
import { TohumYardimcisi } from './_shared/tohum-yardimcisi.js';
import {
  KIMLIK_KURULUM_GOCU,
  KimlikKurulumGocu,
} from './_shared/tohum/kimlik-kurulum.goc.js';
import {
  KURULUM_REPO,
  kurulumRepo,
} from './_shared/tohum/kurulum.repository.js';
import { KurulumBaglantisiHandler } from './parola/application/kurulum-baglantisi.handler.js';
import { ParolaBelirleHandler } from './parola/application/parola-belirle.handler.js';
import { ParolaOzetleyici } from './parola/domain/parola-ozetleyici.port.js';
import { PAROLA_REPO } from './parola/domain/parola.repository.js';
import { Argon2idParolaOzetleyici } from './parola/infrastructure/parola-ozetleyici.argon2id.js';
import { parolaPrismaRepository } from './parola/infrastructure/parola.prisma-repository.js';
import { ParolaController } from './parola/presentation/parola.controller.js';

// Kimlik feature'ı. Çekirdek repository'ler Unit of Work'e Registrar ile tanıtılır; çekirdek
// parçalar yalnız bu feature'ın içinde kullanılır, dışa verilmez. Tohum göçleri tohum defterine
// sırayla bildirilir.
@Module({
  imports: [DatabaseModule, MessagingModule, TohumModule],
  controllers: [ParolaController],
  providers: [
    GenelSayac,
    KisininSayisi,
    KisiKilidi,
    KokUyelik,
    TohumYardimcisi,
    KimlikKurulumGocu,
    ParolaBaglantisi,
    { provide: ParolaOzetleyici, useClass: Argon2idParolaOzetleyici },
    ParolaBelirleHandler,
    KurulumBaglantisiHandler,
    OturumDenetimiHandler,
  ],
  // Sözleşmeyi uygulayan sınıf; sözleşmeye kök modülde bağlanır (TS-002 "Yapı").
  exports: [OturumDenetimiHandler],
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
    registrar.register(PAROLA_BAGLANTISI_REPO, parolaBaglantisiRepo);
    registrar.register(PAROLA_REPO, parolaPrismaRepository);
    registrar.register(OTURUM_DENETIMI_REPO, oturumDenetimiPrismaRepository);
  }
}
