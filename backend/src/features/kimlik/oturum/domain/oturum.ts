import { createHash } from 'node:crypto';

// Oturum sayıları (TS-002 AK-9; KR-009 varsayılanları). Proje ayarı sonra gelir.
// Oturumun mutlak bitişi girişte belirlenir ve döndürmeyle uzamaz (KR-009 Kural 6).
export const MUTLAK_OMUR_MS = 7 * 24 * 60 * 60 * 1000;
// Kişinin en çok bu kadar açık oturumu olur; aşan girişte en eskisi kapanır.
export const EN_COK_ACIK_OTURUM = 3;

// Yenileme belirtecinin ve cihaz sırrının tabloda duran özeti: SHA-256 (onaltılık). Yüksek
// entropili sırda yavaş özet gerekmez.
export function oturumSirrininOzeti(sir: string): string {
  return createHash('sha256').update(sir).digest('hex');
}
