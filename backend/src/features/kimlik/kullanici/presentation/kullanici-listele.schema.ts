import { z } from 'zod';
import type { Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

// Listenin sıralanabildiği alanlar (TS-002 AK-39: kaynağın şemasında sabit liste).
const SIRALANABILIR = ['gorunenAd', 'kullaniciAdi', 'olusturmaZamani'] as const;

// GET kimlik/kullanici sorgusu (KR-014). Azalan sıra için alanın başına "-" yazılır; pasif süzgeci
// "true" ya da "false" alır.
export const kullaniciListeleSemasi = z.strictObject({
  sayfa: z.coerce.number().int().min(1).default(1),
  boyut: z.coerce.number().int().min(1).max(100).default(20),
  sirala: z
    .enum([...SIRALANABILIR, ...SIRALANABILIR.map((alan) => `-${alan}`)])
    .transform((deger): Siralama =>
      deger.startsWith('-')
        ? { alan: deger.slice(1), yon: 'azalan' }
        : { alan: deger, yon: 'artan' },
    )
    .optional(),
  pasif: z
    .enum(['true', 'false'])
    .transform((deger) => deger === 'true')
    .optional(),
});

export type KullaniciListeleParametreleri = z.infer<
  typeof kullaniciListeleSemasi
>;
