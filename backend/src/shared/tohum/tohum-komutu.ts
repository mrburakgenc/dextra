import { Module, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TohumKosucusu } from './tohum-kosucusu.js';
import { TohumModule } from './tohum.module.js';

// abortOnError: false — açılış hatası süreci process.abort ile öldürmez, çağırana ulaşır. Nest'in
// seçenek tipi yalnız tip olarak dışa açık bir sınıftır; sınıf tipli yere nesne sabiti verilemediği
// için (lint: no-unsafe-class-instance-assignment) yalnız kullanılan alan seçilerek verilir.
type BaglamSecenekleri = NonNullable<
  Parameters<typeof NestFactory.createApplicationContext>[1]
>;
const secenekler: Pick<BaglamSecenekleri, 'abortOnError'> = {
  abortOnError: false,
};

// Tohum komutunun işi: verilen kök modülü tohum modülüyle birlikte istek dinlemeden açar, koşucuyu
// (kuru ise kuru koşuyu) çalıştırır ve bağlamı kapatır. Uygulanan ya da uygulanacak göçlerin
// adlarını döner; hata çağırana ulaşır. Kök modül parametredir, çünkü ortak kod uygulamanın kök
// modülünü içe aktaramaz (eslint.config.mjs).
export async function tohumKomutu(
  kokModul: Type,
  kuru: boolean,
): Promise<string[]> {
  @Module({ imports: [kokModul, TohumModule] })
  class TohumKomutuModulu {}

  const baglam = await NestFactory.createApplicationContext(
    TohumKomutuModulu,
    secenekler,
  );
  try {
    const kosucu = baglam.get(TohumKosucusu);
    return await (kuru ? kosucu.kuruKos() : kosucu.kos());
  } finally {
    await baglam.close();
  }
}
