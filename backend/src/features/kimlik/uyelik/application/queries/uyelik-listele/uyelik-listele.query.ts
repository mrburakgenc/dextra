// Üyelikleri listele sorgusu: sorgu dizgesinin şeması ve ondan türeyen sorgu tipi (TS-002 AK-39;
// KR-014).
import { z } from 'zod';
import type { Siralama } from '../../../../../../shared/yetki/okuma-kapisi.js';

// Listenin sıralanabildiği alanlar (TS-002 AK-39: kaynağın şemasında sabit liste).
const SIRALANABILIR = ['olusturmaZamani'] as const;

// Azalan sıra için alanın başına "-" yazılır; kullaniciId, grupId ve rolId süzgeçleri isteğe bağlıdır
// ve verilenler "ve" ile birleşir.
export const uyelikListeleSorgusuSemasi = z.strictObject({
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

export type UyelikListeleSorgusu = z.output<typeof uyelikListeleSorgusuSemasi>;
