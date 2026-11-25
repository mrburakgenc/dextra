// Parola değer nesnesi: parolanın alan kuralı depoda yalnız burada yazılır (TS-005 Değişmez 2).
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

declare const parolaMarkasi: unique symbol;

// Kuraldan geçmiş parola. Marka yalnız tiptedir; düz metin Parola yerine verilemez, onu yalnız parola() üretir.
export type Parola = string & { readonly [parolaMarkasi]: true };

// Parola kuralı (KR-009 Seçim 11; TS-002 AK-4): uzunluk Unicode kod noktasıyla sayılır; başka kural
// (büyük harf, rakam, işaret) yoktur. Üst sınır, çok uzun parolayla özetleme yükü bindirmeyi keser.
export const PAROLA_EN_AZ_KOD_NOKTASI = 15;
export const PAROLA_EN_COK_KOD_NOKTASI = 128;

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type ParolaReddi = 'kisa' | 'uzun';

// Dizgenin yineleyicisi kod noktası verir: iki kod biriminden oluşan bir karakter tek sayılır
// (dizgenin length'i kod birimi sayar).
function kodNoktasiSayisi(metin: string): number {
  return Array.from(metin).length;
}

// Parola kırpılmaz; kalan her şey olduğu gibi parola olur.
export function parola(ham: string): Sonuc<Parola, ParolaReddi> {
  const uzunluk = kodNoktasiSayisi(ham);
  if (uzunluk < PAROLA_EN_AZ_KOD_NOKTASI) {
    return ret('kisa');
  }
  if (uzunluk > PAROLA_EN_COK_KOD_NOKTASI) {
    return ret('uzun');
  }
  return tamam(ham as Parola);
}
