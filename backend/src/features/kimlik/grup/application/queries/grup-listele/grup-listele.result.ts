// Grupları listele işinin sonucu: isteyenin görebildiği kolonlarla canlı grupların bir sayfası
// (TS-002 AK-39); toplam sayı dönmez.
import type { Kayit } from '../../../../../../shared/yetki/domain/okuma-tipleri.js';

export interface GrupListeleSonucu {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
