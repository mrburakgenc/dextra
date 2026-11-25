// Üyelik ver komutu: gövdenin şeması ve ondan türeyen komut tipi (TS-002 AK-39; KR-014): kişiye bir
// grupta rol verilir. Şemada olmayan alan kabul edilmez.
import { z } from 'zod';

export const uyelikVerKomutuSemasi = z.strictObject({
  kullaniciId: z.uuid(),
  grupId: z.uuid(),
  rolId: z.uuid(),
});

export type UyelikVerKomutu = z.output<typeof uyelikVerKomutuSemasi>;
