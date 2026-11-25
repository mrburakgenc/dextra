import { z } from 'zod';
import { parolaSemasi } from '../domain/parola-kurali.js';

// Parola değiştirme ucunun gövdesi (KR-014; TS-002 AK-50). Kişi oturumdan gelir; gövdede kişi seçen
// alan yoktur ve fazla alan reddedilir. Eski parolaya parola kuralı uygulanmaz (giriş şemasındaki gibi);
// kurala uymayan eski parola doğrulamada yanlış çıkar.
export const parolaDegistirSemasi = z.strictObject({
  eskiParola: z.string().min(1),
  yeniParola: parolaSemasi,
});

export type ParolaDegistirGovdesi = z.infer<typeof parolaDegistirSemasi>;
