import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface OturumListeleSorgusu {
  readonly sayfa: number;
  readonly boyut: number;
  readonly siralama: Siralama;
  readonly kullaniciId?: string;
  readonly acik?: boolean;
}

// Yönetim listelerinin cevabı (TS-002 AK-39) ve isteği yapan oturumun kimliği (AK-51); toplam sayı
// dönmez.
export interface OturumListesi {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
  readonly buOturumId: string;
}
