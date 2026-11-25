// Rol adı değer nesnesi: rol adının alan kuralı depoda yalnız burada yazılır (TS-005 Değişmez 2).
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

declare const rolAdiMarkasi: unique symbol;

// Kuraldan geçmiş ad. Marka yalnız tiptedir; düz metin RolAdi yerine verilemez, onu yalnız rolAdi() üretir.
export type RolAdi = string & { readonly [rolAdiMarkasi]: true };

export const ROL_ADI_EN_AZ = 1;
export const ROL_ADI_EN_COK = 100;

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type RolAdiReddi = 'kisa' | 'uzun';

// Baştaki ve sondaki boşluk atılır; kalan ad 1-100 karakterdir (TS-002 AK-39).
export function rolAdi(ham: string): Sonuc<RolAdi, RolAdiReddi> {
  const ad = ham.trim();
  if (ad.length < ROL_ADI_EN_AZ) {
    return ret('kisa');
  }
  if (ad.length > ROL_ADI_EN_COK) {
    return ret('uzun');
  }
  return tamam(ad as RolAdi);
}
