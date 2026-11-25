import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../shared/database/database.module.js';
import { Registrar } from '../../../shared/database/registrar.js';
import { MessagingModule } from '../../../shared/messaging/messaging.module.js';
import { KimlikCekirdekModule } from '../_shared/kimlik-cekirdek.module.js';
import { KurulumBaglantisiHandler } from './application/kurulum-baglantisi.handler.js';
import { ParolaBelirleHandler } from './application/parola-belirle.handler.js';
import { ParolaDegistirHandler } from './application/parola-degistir.handler.js';
import { ParolaGirisYontemi } from './application/parola-giris-yontemi.js';
import { ParolaOzetleyici } from './domain/parola-ozetleyici.port.js';
import { PAROLA_REPO } from './domain/parola.repository.js';
import { Argon2idParolaOzetleyici } from './infrastructure/parola-ozetleyici.argon2id.js';
import { parolaPrismaRepository } from './infrastructure/parola.prisma-repository.js';
import { ParolaController } from './presentation/parola.controller.js';

// Parola alt özelliği (TS-002 AK-30). Giriş yöntemi oturum alt özelliğine dışa verilir.
@Module({
  imports: [DatabaseModule, MessagingModule, KimlikCekirdekModule],
  controllers: [ParolaController],
  providers: [
    { provide: ParolaOzetleyici, useClass: Argon2idParolaOzetleyici },
    ParolaBelirleHandler,
    ParolaDegistirHandler,
    KurulumBaglantisiHandler,
    ParolaGirisYontemi,
  ],
  exports: [ParolaGirisYontemi],
})
export class ParolaModule {
  constructor(registrar: Registrar) {
    registrar.register(PAROLA_REPO, parolaPrismaRepository);
  }
}
