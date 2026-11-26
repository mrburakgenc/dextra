// Göçten önce yasak taraması (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-36; KU-017): `pnpm -C
// backend yasak-tarama` canlı yasak satırlarına bozuk yasağın tek tanımını koşan kodun kataloğuyla
// uygular ve hiçbir şey yazmaz. Bozulacak yasak yoksa 0 ile çıkar; varsa her birini (yetenek kimliği,
// kaynak, eylem, neden) yazar ve 2 ile çıkar; tarama hata verirse 1 ile çıkar. Yetenek tablosu ya da
// tabloda iki kolon (giremez, oncelik) henüz yoksa taranacak yasak yoktur (TS-008 AU-38).
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { YasakTaramasi } from './features/kimlik/_shared/application/yasak-taramasi.js';
import { YasakTaramaModule } from './features/kimlik/_shared/yasak-tarama.module.js';
import { KomutBaglamiModule } from './shared/messaging/komut-baglami.module.js';

// Uygulama komut bağlamında açılır: aktarım döngüleri ve kuyruk dinleyicileri başlamaz (TS-002 AK-25).
@Module({ imports: [AppModule, KomutBaglamiModule, YasakTaramaModule] })
class YasakTaramaKomutuModulu {}

// abortOnError: false — açılış hatası süreci process.abort ile öldürmez, aşağıdaki catch'e ulaşır
// (tohum komutundaki gibi yalnız kullanılan alan seçilerek verilir).
type BaglamSecenekleri = NonNullable<
  Parameters<typeof NestFactory.createApplicationContext>[1]
>;
const secenekler: Pick<BaglamSecenekleri, 'abortOnError'> = {
  abortOnError: false,
};
const BOZULACAK_YASAK_VAR = 2;

try {
  const baglam = await NestFactory.createApplicationContext(
    YasakTaramaKomutuModulu,
    secenekler,
  );
  try {
    const sonuc = await baglam.get(YasakTaramasi).tara();
    if (sonuc === undefined) {
      process.stdout.write(
        'Taranacak yasak yok: yetenek tablosu ya da tablonun giremez ve oncelik kolonları henüz yok\n',
      );
    } else if (sonuc.tarananSayisi === 0) {
      process.stdout.write('Taranacak yasak yok\n');
    } else if (sonuc.bozulacaklar.length === 0) {
      process.stdout.write(
        `Bozulacak yasak yok (${String(sonuc.tarananSayisi)} yasak tarandı)\n`,
      );
    } else {
      process.stdout.write(
        `Bozulacak yasak: ${String(sonuc.bozulacaklar.length)} (${String(sonuc.tarananSayisi)} yasak tarandı)\n`,
      );
      for (const { yetenekId, kaynak, eylem, neden } of sonuc.bozulacaklar) {
        process.stdout.write(
          `  yetenek=${yetenekId} kaynak=${kaynak} eylem=${eylem} neden=${neden}\n`,
        );
      }
      process.exitCode = BOZULACAK_YASAK_VAR;
    }
  } finally {
    await baglam.close();
  }
} catch (hata) {
  process.stderr.write(
    `Yasak taraması başarısız: ${hata instanceof Error ? hata.message : String(hata)}\n`,
  );
  process.exitCode = 1;
}
