import { Module } from '@nestjs/common';
import { KimlikCekirdekModule } from './_shared/kimlik-cekirdek.module.js';
import { GrupModule } from './grup/grup.module.js';
import { KullaniciModule } from './kullanici/kullanici.module.js';
import { OturumModule } from './oturum/oturum.module.js';
import { ParolaModule } from './parola/parola.module.js';
import { RolModule } from './rol/rol.module.js';
import { UyelikModule } from './uyelik/uyelik.module.js';
import { YetenekModule } from './yetenek/yetenek.module.js';

// Kimlik feature'ı. Her alt özellik kendi modülünü taşır; bu modül yalnız onları içe aktarır (TS-002
// AK-30). Sözleşmeleri uygulayan sınıflar (OturumDenetimiHandler, KimlikYetkiVerisi) onları sağlayan
// modüllerin dışa verilmesiyle kök modüle ulaşır; sözleşmelere orada bağlanır (TS-002 "Yapı").
@Module({
  imports: [
    KimlikCekirdekModule,
    ParolaModule,
    OturumModule,
    KullaniciModule,
    GrupModule,
    RolModule,
    UyelikModule,
    YetenekModule,
  ],
  exports: [OturumModule, KimlikCekirdekModule],
})
export class KimlikModule {}
