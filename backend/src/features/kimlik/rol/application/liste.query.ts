import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

// Yönetim listelerinin sorgusu ve cevabı (TS-002 AK-39). Sayfa 1'den başlar; toplam sayı dönmez.
export interface ListeSorgusu {
  readonly sayfa: number;
  readonly boyut: number;
  readonly siralama: readonly Siralama[];
}

export interface ListeCevabi {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
