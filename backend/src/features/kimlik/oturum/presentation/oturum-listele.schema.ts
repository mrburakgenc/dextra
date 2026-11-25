import { z } from 'zod';
import type { Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

// Listenin sıralanabildiği alanlar (TS-002 AK-39 ve AK-51: kaynağın şemasında sabit liste).
const SIRALANABILIR = ['baslangicZamani', 'sonDondurmeZamani'] as const;

// GET kimlik/oturum sorgusu (KR-014). Azalan sıra için alanın başına "-" yazılır; varsayılan
// başlangıç zamanı azalandır. acik süzgeci "true" ya da "false" alır.
export const oturumListeleSemasi = z.strictObject({
  sayfa: z.coerce.number().int().min(1).default(1),
  boyut: z.coerce.number().int().min(1).max(100).default(20),
  sirala: z
    .enum([...SIRALANABILIR, ...SIRALANABILIR.map((alan) => `-${alan}`)])
    .default('-baslangicZamani')
    .transform((deger): Siralama =>
      deger.startsWith('-')
        ? { alan: deger.slice(1), yon: 'azalan' }
        : { alan: deger, yon: 'artan' },
    ),
  kullaniciId: z.uuid().optional(),
  acik: z
    .enum(['true', 'false'])
    .transform((deger) => deger === 'true')
    .optional(),
});

export type OturumListeleParametreleri = z.infer<typeof oturumListeleSemasi>;
