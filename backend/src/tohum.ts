// Tohum göçü komutu (TS-002 AK-1): `pnpm -C backend tohum` bekleyen göçleri uygular,
// `pnpm -C backend tohum:kuru` uygular, geri alır ve uygulanacakları yazar. Başarıda 0, hatada 1
// ile çıkar.
import { inspect } from 'node:util';
import { AppModule } from './app.module.js';
import { tohumKomutu } from './shared/tohum/tohum-komutu.js';

const kuru = process.argv.includes('--kuru');
try {
  const adlar = await tohumKomutu(AppModule, kuru);
  const baslik = kuru ? 'Uygulanacak tohum göçleri' : 'Uygulanan tohum göçleri';
  process.stdout.write(
    `${baslik}: ${adlar.length === 0 ? '(yok)' : adlar.join(', ')}\n`,
  );
} catch (hata) {
  // inspect, hatanın nedenini (cause; göçün kendi hatası) de yazar.
  process.stderr.write(`Tohum göçü başarısız: ${inspect(hata)}\n`);
  process.exitCode = 1;
}
