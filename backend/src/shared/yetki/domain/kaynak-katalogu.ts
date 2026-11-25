import type { AlanTipi } from './alan-tipi.js';

// Kaynak türünün adından o türün alan adlarına ve alanlarının tiplerine (TS-002 AK-44); bilinmeyen
// tür için undefined.
export interface KaynakKatalogu {
  alanlar(tur: string): readonly string[] | undefined;
  alanTipleri(tur: string): Readonly<Record<string, AlanTipi>> | undefined;
}

// Yazma kapısının kataloğu: alanlara ek olarak yalnız sistemin yazdığı alanları bilir; onlar istek
// gövdesinden kabul edilmez (KR-008 Seçim 34; TS-002 "Veri modeli", çürütme 17). Bilinmeyen tür için
// boş.
export interface YazmaKatalogu extends KaynakKatalogu {
  sistemAlanlari(tur: string): readonly string[];
}

export const KAYNAK_KATALOGU = Symbol('KaynakKatalogu');
