import { Injectable, type OnModuleInit } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { isaretleriOku } from './isaretler.js';

// Açılış denetimi (TS-002 AK-12; KU-011): uygulamanın her ucu üç işaretten tam birini taşır.
// İşaretsiz ya da birden çok işaretli uç bulunursa uygulama açılmaz; hata ucun sınıfını ve
// yöntemini söyler. Uç, HTTP yöntemi üst verisini taşıyan denetleyici yöntemidir (@Get, @Post …).
@Injectable()
export class IsaretDenetimi implements OnModuleInit {
  constructor(
    private readonly kesif: DiscoveryService,
    private readonly tarayici: MetadataScanner,
  ) {}

  onModuleInit(): void {
    for (const { metatype } of this.kesif.getControllers()) {
      if (metatype === null) {
        continue;
      }
      const prototip = metatype.prototype as object;
      for (const ad of this.tarayici.getAllMethodNames(prototip)) {
        const isleyici = Reflect.get(prototip, ad) as object;
        if (Reflect.getMetadata(METHOD_METADATA, isleyici) === undefined) {
          continue;
        }
        const sayi = isaretleriOku(isleyici).length;
        if (sayi !== 1) {
          throw new Error(
            `${metatype.name}.${ad} ucu üç işaretten (HerkeseAcik, YalnizKendisi, Izin) tam birini taşımalı; ${String(sayi)} işaret var`,
          );
        }
      }
    }
  }
}
