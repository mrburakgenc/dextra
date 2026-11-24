import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../shared/database/database.module.js';
import { Registrar } from '../../../../shared/database/registrar.js';
import { KimlikYetkiVerisi } from './yetki-verisi.js';
import {
  YETKI_VERISI_REPO,
  yetkiVerisiRepo,
} from './yetki-verisi.repository.js';

// Yetki verisi (TS-002 AK-16): YetkiVerisi sözleşmesinin uygulamasını yalnız kendisi dışa verir.
// Çekirdek modülden ayrıdır, çünkü sözleşme kök modülde bağlanır ve KimlikModule çekirdek parçaları
// dışa vermeden yalnız bu sınıfı verebilmelidir.
@Module({
  imports: [DatabaseModule],
  providers: [KimlikYetkiVerisi],
  exports: [KimlikYetkiVerisi],
})
export class KimlikYetkiVerisiModule {
  constructor(registrar: Registrar) {
    registrar.register(YETKI_VERISI_REPO, yetkiVerisiRepo);
  }
}
