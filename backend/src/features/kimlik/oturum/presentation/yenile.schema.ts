import { z } from 'zod';

// Yenileme isteğinin gövdesi (TS-002 AK-49 madde 1; KR-014).
export const yenileSemasi = z.strictObject({
  yenilemeBelirteci: z.string().min(1),
  cihazSirri: z.string().min(1),
});

export type YenileGovdesi = z.infer<typeof yenileSemasi>;
