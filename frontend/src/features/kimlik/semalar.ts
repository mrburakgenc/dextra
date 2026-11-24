import { z } from 'zod';

// Kimlik ekranlarının Zod şemaları (KR-014: ön yüzün kendi şeması; backend'den içe aktarılmaz).
// Biçimler backend sözleşmesindeki gibidir (TS-004 "İlk ekranların sözleşmesi"); son sözü
// backend söyler.

export const GirisSemasi = z.object({
  kullaniciAdi: z
    .string({ error: 'Kullanıcı adı boş olamaz' })
    .min(1, 'Kullanıcı adı boş olamaz'),
  parola: z
    .string({ error: 'Parola boş olamaz' })
    .min(1, 'Parola boş olamaz'),
});

// Parola uzunluğu Unicode kod noktasıyla sayılır; string.length UTF-16 birimi saydığı için
// Zod'un min ve max denetimi kullanılmaz.
const PAROLA_EN_AZ = 15;
const PAROLA_EN_COK = 128;

function kodNoktasiSayisi(metin: string): number {
  return Array.from(metin).length;
}

export const ParolaBelirleSemasi = z
  .object({
    kod: z
      .string({ error: 'Bağlantıda kod yok' })
      .min(1, 'Bağlantıda kod yok'),
    parola: z
      .string({ error: 'Parola boş olamaz' })
      .refine((p) => kodNoktasiSayisi(p) >= PAROLA_EN_AZ, {
        error: `Parola en az ${String(PAROLA_EN_AZ)} karakter olmalı`,
      })
      .refine((p) => kodNoktasiSayisi(p) <= PAROLA_EN_COK, {
        error: `Parola en çok ${String(PAROLA_EN_COK)} karakter olabilir`,
      }),
    parolaTekrar: z.string({ error: 'Parola tekrarı boş olamaz' }),
  })
  .refine((d) => d.parola === d.parolaTekrar, {
    error: 'Parolalar birbirini tutmuyor',
    path: ['parolaTekrar'],
  });

// Zod hatasından her alanın ilk iletisi.
export function semaAlanHatalari(hata: z.ZodError): Record<string, string> {
  const alanlar: Record<string, string> = {};
  for (const sorun of hata.issues) {
    const alan = sorun.path[0];
    if (typeof alan === 'string') {
      alanlar[alan] ??= sorun.message;
    }
  }
  return alanlar;
}
