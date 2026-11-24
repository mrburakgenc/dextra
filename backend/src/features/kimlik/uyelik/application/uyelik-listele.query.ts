import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface UyelikListeleSorgusu {
  readonly sayfa: number;
  readonly boyut: number;
  readonly siralama?: Siralama;
  readonly kullaniciId?: string;
  readonly grupId?: string;
  readonly rolId?: string;
}

// Yönetim listelerinin cevabı (TS-002 AK-39); toplam sayı dönmez.
export interface UyelikListesi {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
