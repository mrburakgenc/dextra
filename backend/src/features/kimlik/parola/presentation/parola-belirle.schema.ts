import { z } from 'zod';
import { parolaSemasi } from '../domain/parola-kurali.js';

// Bağlantıyla parola belirleme ucunun gövdesi (KR-014). Kodun biçimi denetlenmez: geçersiz kod,
// var olmayan kodla aynı tek tip hatayı alır.
export const parolaBelirleSemasi = z.object({
  kod: z.string().min(1),
  parola: parolaSemasi,
});

export type ParolaBelirleGovdesi = z.infer<typeof parolaBelirleSemasi>;
