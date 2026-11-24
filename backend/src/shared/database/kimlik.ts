import { randomUUIDv7 } from 'node:crypto';

// Kayıt kimliklerinin tek üreticisi: zaman sıralı UUID v7 (KR-011 Seçim 8). Kolonların
// veritabanı varsayılanı yoktur; kimlik satır yazılmadan önce burada üretilir.
// Aynı milisaniyede üretilen kimlikler arasında sıra güvencesi yoktur.
export function yeniKimlik(): string {
  return randomUUIDv7();
}
