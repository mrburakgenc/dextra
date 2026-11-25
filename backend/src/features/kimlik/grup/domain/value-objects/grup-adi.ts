// Grup adı değer nesnesi: grup adının alan kuralı depoda yalnız burada yazılır (TS-005 Değişmez 2).
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

declare const grupAdiMarkasi: unique symbol;

// Kuraldan geçmiş ad. Marka yalnız tiptedir; düz metin GrupAdi yerine verilemez, onu yalnız grupAdi() üretir.
export type GrupAdi = string & { readonly [grupAdiMarkasi]: true };

export const GRUP_ADI_EN_AZ = 1;
export const GRUP_ADI_EN_COK = 100;

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type GrupAdiReddi = 'kisa' | 'uzun';

// Baştaki ve sondaki boşluk atılır; kalan ad 1-100 karakterdir (TS-002 AK-39).
export function grupAdi(ham: string): Sonuc<GrupAdi, GrupAdiReddi> {
  const ad = ham.trim();
  if (ad.length < GRUP_ADI_EN_AZ) {
    return ret('kisa');
  }
  if (ad.length > GRUP_ADI_EN_COK) {
    return ret('uzun');
  }
  return tamam(ad as GrupAdi);
}
