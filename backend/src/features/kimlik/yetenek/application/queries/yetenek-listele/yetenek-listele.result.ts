// Yetenekleri listele işinin sonucu: isteyenin görebildiği kolonlarla canlı yeteneklerin bir sayfası
// (TS-002 AK-39); toplam sayı dönmez.
import type { YetenekGorunumu } from '../../../domain/repositories/i-yetenek.repository.js';

export interface YetenekListeleSonucu {
  readonly kayitlar: readonly YetenekGorunumu[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
