import { z } from 'zod';

// POST kimlik/uyelik gövdesi (KR-014): kişiye bir grupta rol verilir.
export const uyelikVerSemasi = z.strictObject({
  kullaniciId: z.uuid(),
  grupId: z.uuid(),
  rolId: z.uuid(),
});

export type UyelikVerGovdesi = z.infer<typeof uyelikVerSemasi>;
