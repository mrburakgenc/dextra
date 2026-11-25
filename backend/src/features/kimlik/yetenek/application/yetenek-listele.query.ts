import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface YetenekListeleSorgusu {
  readonly sayfa: number;
  readonly boyut: number;
  readonly siralama?: Siralama;
  readonly grupId?: string;
  readonly rolId?: string;
  readonly izinId?: string;
}

// Yönetim listelerinin cevabı (TS-002 AK-39); toplam sayı dönmez.
export interface YetenekListesi {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
