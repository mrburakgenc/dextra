// Görünen ad gövde alanının Zod şeması: biçimi (metin) Zod denetler, kuralı değer nesnesi verir; ret,
// alanın yoluyla dogrulama_hatasi olur (TS-005 "Komut ve sorgu", Seçenekler 4).
import { z } from 'zod';
import {
  GORUNEN_AD_EN_AZ,
  GORUNEN_AD_EN_COK,
  type GorunenAdReddi,
  gorunenAd,
} from '../../domain/value-objects/gorunen-ad.js';

// Her ret kodu Zod'un kendi uzunluk sorununa çevrilir; böylece cevaptaki neden metni, kuralın şemada
// yazıldığı zamanki Zod iletisiyle aynı kalır (HTTP sözleşmesi değişmez). Eşlemesi olmayan ret kodu
// derlenmez.
const SORUNLAR: Record<GorunenAdReddi, (ham: string) => z.core.$ZodRawIssue> = {
  kisa: (ham) => ({
    code: 'too_small',
    origin: 'string',
    minimum: GORUNEN_AD_EN_AZ,
    inclusive: true,
    input: ham,
  }),
  uzun: (ham) => ({
    code: 'too_big',
    origin: 'string',
    maximum: GORUNEN_AD_EN_COK,
    inclusive: true,
    input: ham,
  }),
};

export const gorunenAdAlani = z.string().transform((ham, baglam) => {
  const sonuc = gorunenAd(ham);
  if (sonuc.tur === 'tamam') {
    return sonuc.deger;
  }
  baglam.issues.push(SORUNLAR[sonuc.neden](ham));
  return z.NEVER;
});
