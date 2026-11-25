import { Global, Module } from '@nestjs/common';

// Uygulamanın istek dinlemeden bir komut olarak açıldığının işareti (TS-002 AK-25). Varsa olay ve
// iz aktarımı ile temizlik döngüleri başlamaz, kuyruk dinleyicisi açılmaz; yoksa (HTTP uygulaması)
// davranış değişmez.
export const KOMUT_BAGLAMI = Symbol('KOMUT_BAGLAMI');

// Komutlar (tohum, kurulum) kök modüllerine bu modülü ekler. Global'dir: işareti okuyan modüller
// onu içe aktarmadan isteğe bağlı olarak enjekte eder.
@Global()
@Module({
  providers: [{ provide: KOMUT_BAGLAMI, useValue: true }],
  exports: [KOMUT_BAGLAMI],
})
export class KomutBaglamiModule {}
