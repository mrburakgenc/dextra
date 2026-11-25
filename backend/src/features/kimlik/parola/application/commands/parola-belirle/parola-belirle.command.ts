// Bağlantıyla parola belirle komutu: gövdenin şeması ve ondan türeyen komut tipi (KR-014). Kodun
// biçimi denetlenmez: geçersiz kod, var olmayan kodla aynı tek tip hatayı alır.
import { z } from 'zod';
import { parolaAlani } from '../../_shared/parola-alani.js';

export const parolaBelirleKomutuSemasi = z.object({
  kod: z.string().min(1),
  parola: parolaAlani,
});

export type ParolaBelirleKomutu = z.output<typeof parolaBelirleKomutuSemasi>;
