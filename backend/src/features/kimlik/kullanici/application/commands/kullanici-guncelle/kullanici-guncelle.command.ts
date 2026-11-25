// Kullanıcı güncelle komutu: PATCH kimlik/kullanici/:id yolundaki kimliğin ve gövdenin şemaları,
// ikisinden türeyen komut tipi (KR-014; TS-002 AK-39 ve "Veri modeli"). Gövdede yalnız görünen ad
// kabul edilir; kuralını değer nesnesi verir. Kullanıcı adı ve telefon giriş bilgisidir (kendi işi
// vardır); sistemin yazdığı kolonlar istekle yazılmaz. Şemada olmayan her alan reddedilir.
import { z } from 'zod';
import { gorunenAdAlani } from '../../_shared/gorunen-ad-alani.js';

export const kullaniciGuncelleYoluSemasi = z.object({ id: z.uuid() });

export const kullaniciGuncelleGovdesiSemasi = z.strictObject({
  gorunenAd: gorunenAdAlani,
});

export type KullaniciGuncelleYolu = z.output<
  typeof kullaniciGuncelleYoluSemasi
>;

export type KullaniciGuncelleGovdesi = z.output<
  typeof kullaniciGuncelleGovdesiSemasi
>;

export type KullaniciGuncelleKomutu = KullaniciGuncelleYolu &
  KullaniciGuncelleGovdesi;
