import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { BelirtecServisi } from './belirtec.js';
import { IsaretDenetimi } from './isaret-denetimi.js';
import { IstemciAdresiDogrulayici } from './istemci-adresi-imzasi.js';

// Kimlik guard'ının ortak parçaları (TS-002 AK-6, AK-8, AK-12). Belirteç anahtarları ve aracı katman
// sırrı ortamdan, uygulama kurulurken okunur: eksik anahtar, eksik ya da 32 karakterden kısa sır
// uygulamayı açtırmaz. İşaret denetimi açılışta bütün uçlara bakar. Guard'ın kendisi kök modülde
// bağlanır, çünkü OturumDenetimi sözleşmesinin uygulaması orada bağlanır (shared feature'ı içe
// aktarmaz).
@Module({
  imports: [DiscoveryModule],
  providers: [
    {
      provide: BelirtecServisi,
      useFactory: () => new BelirtecServisi(process.env),
    },
    {
      provide: IstemciAdresiDogrulayici,
      useFactory: () => new IstemciAdresiDogrulayici(process.env),
    },
    IsaretDenetimi,
  ],
  exports: [BelirtecServisi, IstemciAdresiDogrulayici],
})
export class GuvenlikModule {}
