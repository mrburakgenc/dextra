import { z } from 'zod';

// PATCH kimlik/kullanici/:id gövdesi (KR-014; TS-002 AK-39 ve "Veri modeli"). Yalnız görünen ad
// kabul edilir: baştaki ve sondaki boşluğu atılır, sonra 1-200 karakter olmalıdır. Kullanıcı adı ve
// telefon giriş bilgisidir (kendi işi vardır); sistemin yazdığı kolonlar istekle yazılmaz. Şemada
// olmayan her alan reddedilir.
export const kullaniciGuncelleSemasi = z.strictObject({
  gorunenAd: z.string().trim().min(1).max(200),
});

export type KullaniciGuncelleGovdesi = z.infer<typeof kullaniciGuncelleSemasi>;
