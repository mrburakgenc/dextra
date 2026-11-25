// Parola ile giriş komutu: giriş yönteminin girdisinin şeması ve ondan türeyen tip (KR-014). Parola
// kuralı burada uygulanmaz: kurala uymayan bir parola doğru olamaz ve yanlış parolayla aynı tek tip
// cevabı alır.
import { z } from 'zod';

export const parolaGirisSemasi = z.object({
  kullaniciAdi: z.string().min(1),
  parola: z.string().min(1),
});

export type ParolaGirisGovdesi = z.infer<typeof parolaGirisSemasi>;
