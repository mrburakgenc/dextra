// İçerik listesi değer nesnesi: yetenek satırındaki listelerin (şart, kolon listesi, şart öğesinin liste
// değeri) alan kuralı depoda yalnız burada yazılır (TS-005 Değişmez 2).
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

declare const icerikListesiMarkasi: unique symbol;

// Kuraldan geçmiş liste. Marka yalnız tiptedir; düz dizi IcerikListesi yerine verilemez, onu yalnız
// icerikListesi() üretir.
export type IcerikListesi<T> = readonly T[] & {
  readonly [icerikListesiMarkasi]: true;
};

export const ICERIK_LISTESI_EN_AZ = 1;

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type IcerikListesiReddi = 'bos';

// Boş liste yazılamaz: içerik yoksa liste değil null yazılır; şart değeri olarak boş liste
// ('listede_degil []') bütün kayıtları açardı (KR-008 Seçim 5 ve 11).
export function icerikListesi<T>(
  liste: readonly T[],
): Sonuc<IcerikListesi<T>, IcerikListesiReddi> {
  if (liste.length < ICERIK_LISTESI_EN_AZ) {
    return ret('bos');
  }
  return tamam(liste as IcerikListesi<T>);
}
