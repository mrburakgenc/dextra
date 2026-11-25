// Kullanıcı adı değer nesnesi: kullanıcı adının alan kuralı depoda yalnız burada yazılır (TS-005
// Değişmez 2).
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

declare const kullaniciAdiMarkasi: unique symbol;

// Kuraldan geçmiş ad. Marka yalnız tiptedir; düz metin KullaniciAdi yerine verilemez, onu yalnız
// kullaniciAdi() üretir.
export type KullaniciAdi = string & { readonly [kullaniciAdiMarkasi]: true };

// Küçük harfe çevrilmiş ad 3-64 karakterdir ve yalnız küçük harf, rakam, nokta, tire ve alt çizgi
// taşır.
export const KULLANICI_ADI_DESENI = /^[a-z0-9._-]{3,64}$/;

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type KullaniciAdiReddi = 'desene_uymuyor';

// Ad küçük harfe çevrilir, sonra desene uymalıdır (TS-002 AK-39).
export function kullaniciAdi(
  ham: string,
): Sonuc<KullaniciAdi, KullaniciAdiReddi> {
  const ad = ham.toLowerCase();
  if (!KULLANICI_ADI_DESENI.test(ad)) {
    return ret('desene_uymuyor');
  }
  return tamam(ad as KullaniciAdi);
}
