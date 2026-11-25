// Kurulum komutu (TS-002 AK-15; KR-009 Seçim 9): `pnpm -C backend kurulum` ilk SuperAdmin için parola
// bağlantısı üretir ve kodu yalnız standart çıktıya bir kez yazar; kod günlüğe ve veritabanına düz
// hâliyle yazılmaz. Komut yeniden koşarsa yeni bağlantı eskisini geçersiz kılar. Başarıda 0, hatada 1
// ile çıkar.
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { BAGLANTI_OMRU_MS } from './features/kimlik/_shared/application/parola-baglantisi.js';
import { KurulumBaglantisiHandler } from './features/kimlik/parola/application/commands/kurulum-baglantisi/kurulum-baglantisi.handler.js';
import { KomutBaglamiModule } from './shared/messaging/komut-baglami.js';

// Uygulama komut bağlamında açılır: aktarım döngüleri ve kuyruk dinleyicileri başlamaz (TS-002 AK-25).
@Module({ imports: [AppModule, KomutBaglamiModule] })
class KurulumKomutuModulu {}

// abortOnError: false — açılış hatası süreci process.abort ile öldürmez, aşağıdaki catch'e ulaşır
// (tohum komutundaki gibi yalnız kullanılan alan seçilerek verilir).
type BaglamSecenekleri = NonNullable<
  Parameters<typeof NestFactory.createApplicationContext>[1]
>;
const secenekler: Pick<BaglamSecenekleri, 'abortOnError'> = {
  abortOnError: false,
};
const SAAT_MS = 60 * 60 * 1000;

try {
  const baglam = await NestFactory.createApplicationContext(
    KurulumKomutuModulu,
    secenekler,
  );
  try {
    const kod = await baglam.get(KurulumBaglantisiHandler).calistir();
    process.stdout.write(
      `İlk SuperAdmin için parola bağlantısı kodu (${String(BAGLANTI_OMRU_MS / SAAT_MS)} saat geçerli; yeniden gösterilmez):\n${kod}\n`,
    );
  } finally {
    await baglam.close();
  }
} catch (hata) {
  process.stderr.write(
    `Kurulum başarısız: ${hata instanceof Error ? hata.message : String(hata)}\n`,
  );
  process.exitCode = 1;
}
