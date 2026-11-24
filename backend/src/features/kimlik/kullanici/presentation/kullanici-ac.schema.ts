import { z } from 'zod';

// POST kimlik/kullanici gövdesi (KR-014; TS-002 AK-39). Kullanıcı adı küçük harfe çevrilir, sonra
// 3-64 karakter ve yalnız küçük harf, rakam, nokta, tire ve alt çizgi olmalıdır. Görünen adın baştaki
// ve sondaki boşluğu atılır, sonra 1-200 karakter olmalıdır. Telefon kabul edilmez (yazım kanonu
// kararlaştırılmadı); sistem aktörü ve öbür alanlar şemada olmadığı için reddedilir.
export const kullaniciAcSemasi = z.strictObject({
  kullaniciAdi: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,64}$/),
  gorunenAd: z.string().trim().min(1).max(200),
});

export type KullaniciAcGovdesi = z.infer<typeof kullaniciAcSemasi>;
