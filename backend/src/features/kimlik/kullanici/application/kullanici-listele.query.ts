import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface KullaniciListeleSorgusu {
  readonly sayfa: number;
  readonly boyut: number;
  readonly siralama?: Siralama;
  readonly pasif?: boolean;
}

// Yönetim listelerinin cevabı (TS-002 AK-39); toplam sayı dönmez.
export interface KullaniciListesi {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
