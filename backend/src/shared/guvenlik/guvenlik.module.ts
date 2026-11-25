import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { BelirtecServisi } from './application/belirtec.js';
import { IstemciAdresiDogrulayici } from './application/istemci-adresi-imzasi.js';
import {
  YALNIZ_KENDISI_LISTESI,
  YALNIZ_KENDISI_UCLARI,
} from './domain/yalniz-kendisi-listesi.js';
import { IsaretDenetimi } from './infrastructure/isaret-denetimi.js';

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
    { provide: YALNIZ_KENDISI_LISTESI, useValue: YALNIZ_KENDISI_UCLARI },
    IsaretDenetimi,
  ],
  exports: [BelirtecServisi, IstemciAdresiDogrulayici],
})
export class GuvenlikModule {}
