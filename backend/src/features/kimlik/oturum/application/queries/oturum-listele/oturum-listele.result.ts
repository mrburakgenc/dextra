// Oturumları listele işinin sonucu: yönetim listelerinin cevabı (TS-002 AK-39) ve isteği yapan
// oturumun kimliği (AK-51); toplam sayı dönmez.
import type { Kayit } from '../../../../../../shared/yetki/okuma-kapisi.js';

export interface OturumListeleSonucu {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
  readonly buOturumId: string;
}
