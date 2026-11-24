import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface GrupListeleSorgusu {
  readonly sayfa: number;
  readonly boyut: number;
  readonly siralama?: Siralama;
  readonly ustGrupId?: string;
}

// Yönetim listelerinin cevabı (TS-002 AK-39); toplam sayı dönmez.
export interface GrupListesi {
  readonly kayitlar: readonly Kayit[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}
