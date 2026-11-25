// Görünen ad değer nesnesi: görünen adın alan kuralı depoda yalnız burada yazılır (TS-005 Değişmez 2).
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

declare const gorunenAdMarkasi: unique symbol;

// Kuraldan geçmiş ad. Marka yalnız tiptedir; düz metin GorunenAd yerine verilemez, onu yalnız
// gorunenAd() üretir.
export type GorunenAd = string & { readonly [gorunenAdMarkasi]: true };

export const GORUNEN_AD_EN_AZ = 1;
export const GORUNEN_AD_EN_COK = 200;

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type GorunenAdReddi = 'kisa' | 'uzun';

// Baştaki ve sondaki boşluk atılır; kalan ad 1-200 karakterdir (TS-002 AK-39).
export function gorunenAd(ham: string): Sonuc<GorunenAd, GorunenAdReddi> {
  const ad = ham.trim();
  if (ad.length < GORUNEN_AD_EN_AZ) {
    return ret('kisa');
  }
  if (ad.length > GORUNEN_AD_EN_COK) {
    return ret('uzun');
  }
  return tamam(ad as GorunenAd);
}
