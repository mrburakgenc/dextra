import { z } from 'zod';
import type { Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

// Listenin sıralanabildiği alanlar (TS-002 AK-39: kaynağın şemasında sabit liste).
const SIRALANABILIR = ['olusturmaZamani'] as const;

// GET kimlik/uyelik sorgusu (KR-014). Azalan sıra için alanın başına "-" yazılır; kullaniciId, grupId
// ve rolId süzgeçleri isteğe bağlıdır ve verilenler "ve" ile birleşir.
export const uyelikListeleSemasi = z.strictObject({
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
  kullaniciId: z.uuid().optional(),
  grupId: z.uuid().optional(),
  rolId: z.uuid().optional(),
});

export type UyelikListeleParametreleri = z.infer<typeof uyelikListeleSemasi>;
