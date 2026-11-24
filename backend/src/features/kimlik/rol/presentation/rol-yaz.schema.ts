import { z } from 'zod';

// Rol oluşturma ve adını değiştirme gövdesi (TS-002 AK-39; KR-014): ad baştaki ve sondaki boşluk
// atıldıktan sonra 1-100 karakterdir. Şemada olmayan alan (kod dahil) kabul edilmez.
export const rolGovdesiSemasi = z.strictObject({
  ad: z.string().trim().min(1).max(100),
});

export type RolGovdesi = z.infer<typeof rolGovdesiSemasi>;
