import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { isaretleriOku } from '../application/isaretler.js';
import { YALNIZ_KENDISI_LISTESI } from '../domain/yalniz-kendisi-listesi.js';

// Açılış denetimi (TS-002 AK-12; KU-011): uygulamanın her ucu üç işaretten tam birini taşır.
// İşaretsiz ya da birden çok işaretli uç bulunursa uygulama açılmaz; hata ucun sınıfını ve
// yöntemini söyler. Uç, HTTP yöntemi üst verisini taşıyan denetleyici yöntemidir (@Get, @Post …).
// Yalnız kendisi işaretli uç sayılı listede değilse de uygulama açılmaz (AK-33).
@Injectable()
export class IsaretDenetimi implements OnModuleInit {
  constructor(
    private readonly kesif: DiscoveryService,
    private readonly tarayici: MetadataScanner,
    @Inject(YALNIZ_KENDISI_LISTESI)
    private readonly yalnizKendisiListesi: readonly string[],
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
        const isaretler = isaretleriOku(isleyici);
        const sayi = isaretler.length;
        if (sayi !== 1) {
          throw new Error(
            `${metatype.name}.${ad} ucu üç işaretten (HerkeseAcik, YalnizKendisi, Izin) tam birini taşımalı; ${String(sayi)} işaret var`,
          );
        }
        const uc = `${metatype.name}.${ad}`;
        if (
          isaretler[0]?.tur === 'yalniz_kendisi' &&
          !this.yalnizKendisiListesi.includes(uc)
        ) {
          throw new Error(
            `${uc} ucu YalnizKendisi işareti taşıyor ama yalnız kendisi listesinde yok`,
          );
        }
      }
    }
  }
}
