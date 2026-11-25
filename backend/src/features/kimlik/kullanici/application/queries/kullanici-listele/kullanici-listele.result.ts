// Kullanıcıları listele işinin sonucu (TS-002 AK-39): isteyenin görebildiği kolonlarla kişilerin bir
// sayfası; toplam sayı dönmez.
import type { Kayit } from '../../../../../../shared/yetki/domain/okuma-tipleri.js';

export interface KullaniciListeleSonucu {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
