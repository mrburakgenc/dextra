import { z } from 'zod';

// Parola kuralı (KR-009 Seçim 11; TS-002 AK-4): uzunluk Unicode kod noktasıyla sayılır; başka kural
// (büyük harf, rakam, işaret) yoktur. Üst sınır, çok uzun parolayla özetleme yükü bindirmeyi keser.
export const PAROLA_EN_AZ_KOD_NOKTASI = 15;
export const PAROLA_EN_COK_KOD_NOKTASI = 128;

// Dizgenin yineleyicisi kod noktası verir: iki kod biriminden oluşan bir karakter tek sayılır.
// Zod'un min ve max denetimleri kod birimi saydığı için kullanılmaz.
function kodNoktasiSayisi(metin: string): number {
  return Array.from(metin).length;
}

export const parolaSemasi = z
  .string()
  .refine(
    (parola) => kodNoktasiSayisi(parola) >= PAROLA_EN_AZ_KOD_NOKTASI,
    `Parola en az ${String(PAROLA_EN_AZ_KOD_NOKTASI)} karakter olmalı`,
  )
  .refine(
    (parola) => kodNoktasiSayisi(parola) <= PAROLA_EN_COK_KOD_NOKTASI,
    `Parola en çok ${String(PAROLA_EN_COK_KOD_NOKTASI)} karakter olabilir`,
  );
