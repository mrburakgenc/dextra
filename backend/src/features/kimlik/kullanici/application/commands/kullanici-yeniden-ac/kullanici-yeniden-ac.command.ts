// Kullanıcıyı yeniden aç komutu: POST kimlik/kullanici/:id/yeniden-ac yolundaki kimliğin ve gövdenin
// şemaları, yoldan türeyen komut tipi (KR-014). Gövdesizdir: gövde ya hiç gelmez ya da alansız bir
// nesnedir; alan taşıyan gövde reddedilir.
import { z } from 'zod';

export const kullaniciYenidenAcYoluSemasi = z.object({ id: z.uuid() });

export const kullaniciYenidenAcGovdesiSemasi = z.strictObject({}).optional();

export type KullaniciYenidenAcKomutu = z.output<
  typeof kullaniciYenidenAcYoluSemasi
>;
