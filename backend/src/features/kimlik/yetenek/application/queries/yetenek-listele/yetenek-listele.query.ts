// Yetenekleri listele sorgusu: GET kimlik/yetenek sorgu dizgesinin şeması ve ondan türeyen sorgu tipi
// (TS-002 AK-39; KR-014).
import { z } from 'zod';
import type { Siralama } from '../../../../../../shared/yetki/okuma-kapisi.js';

// Listenin sıralanabildiği alanlar (TS-002 AK-39: kaynağın şemasında sabit liste).
const SIRALANABILIR = ['olusturmaZamani'] as const;

// Azalan sıra için alanın başına "-" yazılır; grupId, rolId ve izinId verilirse yalnız o gruba, role ya
// da izne bağlı yetenekler gelir.
export const yetenekListeleSorgusuSemasi = z.strictObject({
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
  grupId: z.uuid().optional(),
  rolId: z.uuid().optional(),
  izinId: z.uuid().optional(),
});

export type YetenekListeleSorgusu = z.output<
  typeof yetenekListeleSorgusuSemasi
>;
