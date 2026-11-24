import { z } from 'zod';
import type { Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

// Listenin sıralanabildiği alanlar (TS-002 AK-39: kaynağın şemasında sabit liste).
const SIRALANABILIR = ['ad', 'olusturmaZamani'] as const;

// GET kimlik/grup sorgusu (KR-014). Azalan sıra için alanın başına "-" yazılır; ustGrupId verilirse
// yalnız o grubun doğrudan altındakiler gelir.
export const grupListeleSemasi = z.strictObject({
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
  ustGrupId: z.uuid().optional(),
});

export type GrupListeleParametreleri = z.infer<typeof grupListeleSemasi>;
