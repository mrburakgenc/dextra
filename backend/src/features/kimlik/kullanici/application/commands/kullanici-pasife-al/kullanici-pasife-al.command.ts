// Kullanıcıyı pasife al komutu: POST kimlik/kullanici/:id/pasife-al yolundaki kimliğin ve gövdenin
// şemaları, yoldan türeyen komut tipi (KR-014). Gövdesizdir: gövde ya hiç gelmez ya da alansız bir
// nesnedir; alan taşıyan gövde reddedilir.
import { z } from 'zod';

export const kullaniciPasifeAlYoluSemasi = z.object({ id: z.uuid() });

export const kullaniciPasifeAlGovdesiSemasi = z.strictObject({}).optional();

export type KullaniciPasifeAlKomutu = z.output<
  typeof kullaniciPasifeAlYoluSemasi
>;
