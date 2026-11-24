import { z } from 'zod';

// Parola ile giriş yönteminin girdisi (KR-014). Parola kuralı burada uygulanmaz: kurala uymayan bir
// parola doğru olamaz ve yanlış parolayla aynı tek tip cevabı alır.
export const parolaGirisSemasi = z.object({
  kullaniciAdi: z.string().min(1),
  parola: z.string().min(1),
});

export type ParolaGirisGovdesi = z.infer<typeof parolaGirisSemasi>;
