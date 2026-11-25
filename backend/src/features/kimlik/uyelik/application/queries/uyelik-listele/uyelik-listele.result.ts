// Üyelikleri listele işinin sonucu: isteyenin görebildiği kolonlarla canlı üyeliklerin bir sayfası
// (TS-002 AK-39); toplam sayı dönmez.
import type { UyelikGorunumu } from '../../../domain/repositories/i-uyelik.repository.js';

export interface UyelikListeleSonucu {
  readonly kayitlar: readonly UyelikGorunumu[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
