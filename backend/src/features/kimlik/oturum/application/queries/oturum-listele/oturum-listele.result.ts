// Oturumları listele işinin sonucu: yönetim listelerinin cevabı (TS-002 AK-39) ve isteği yapan
// oturumun kimliği (AK-51); toplam sayı dönmez.
import type { OturumGorunumu } from '../../../domain/repositories/i-oturum-yonetim.repository.js';

export interface OturumListeleSonucu {
  readonly kayitlar: readonly OturumGorunumu[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
  readonly buOturumId: string;
}
