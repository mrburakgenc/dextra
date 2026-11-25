// Kullanıcıları listele işinin sonucu (TS-002 AK-39): isteyenin görebildiği kolonlarla kişilerin bir
// sayfası; toplam sayı dönmez.
import type { KullaniciGorunumu } from '../../../domain/repositories/i-kullanici.repository.js';

export interface KullaniciListeleSonucu {
  readonly kayitlar: readonly KullaniciGorunumu[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
