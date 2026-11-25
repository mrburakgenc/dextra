// Yetenekleri listele işinin sonucu: isteyenin görebildiği kolonlarla canlı yeteneklerin bir sayfası
// (TS-002 AK-39); toplam sayı dönmez.
import type { Kayit } from '../../../../../../shared/yetki/okuma-kapisi.js';

export interface YetenekListeleSonucu {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
