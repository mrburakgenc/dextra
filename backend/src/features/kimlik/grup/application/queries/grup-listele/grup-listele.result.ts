// Grupları listele işinin sonucu: isteyenin görebildiği kolonlarla canlı grupların bir sayfası
// (TS-002 AK-39); toplam sayı dönmez.
import type { GrupGorunumu } from '../../../domain/repositories/i-grup.repository.js';

export interface GrupListeleSonucu {
  readonly kayitlar: readonly GrupGorunumu[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
