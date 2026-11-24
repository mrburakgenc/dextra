import { Module } from '@nestjs/common';
import { KimlikCekirdekModule } from './_shared/kimlik-cekirdek.module.js';
import { KimlikYetkiVerisiModule } from './_shared/yetki-verisi/yetki-verisi.module.js';
import { GrupModule } from './grup/grup.module.js';
import { KullaniciModule } from './kullanici/kullanici.module.js';
import { OturumModule } from './oturum/oturum.module.js';
import { ParolaModule } from './parola/parola.module.js';
import { RolModule } from './rol/rol.module.js';
import { UyelikModule } from './uyelik/uyelik.module.js';
import { YetenekModule } from './yetenek/yetenek.module.js';

// Kimlik feature'ı. Her alt özellik kendi modülünü taşır; bu modül yalnız onları içe aktarır (TS-002
// AK-30). Dışa yalnız kök modülün sözleşmelere bağladığı iki sınıf çıkar: OturumDenetimiHandler
// (OturumModule'ün tek dışa verdiği) ve KimlikYetkiVerisi (KimlikYetkiVerisiModule'ün tek dışa
// verdiği); sözleşmelere kök modülde bağlanır (TS-002 "Yapı"). Çekirdek parçalar yalnız alt
// modüllere açıktır.
@Module({
  imports: [
    KimlikCekirdekModule,
    KimlikYetkiVerisiModule,
    ParolaModule,
    OturumModule,
    KullaniciModule,
    GrupModule,
    RolModule,
    UyelikModule,
    YetenekModule,
  ],
  exports: [OturumModule, KimlikYetkiVerisiModule],
})
export class KimlikModule {}
