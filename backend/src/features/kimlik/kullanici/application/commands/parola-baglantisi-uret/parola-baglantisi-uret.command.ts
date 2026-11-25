// Parola bağlantısı üret komutu: POST kimlik/kullanici/:id/parola-baglantisi yolundaki kimliğin ve
// gövdenin şemaları, yoldan türeyen komut tipi (KR-014). Gövdesizdir: gövde ya hiç gelmez ya da
// alansız bir nesnedir; alan taşıyan gövde reddedilir.
import { z } from 'zod';

export const parolaBaglantisiUretYoluSemasi = z.object({ id: z.uuid() });

export const parolaBaglantisiUretGovdesiSemasi = z.strictObject({}).optional();

export type ParolaBaglantisiUretKomutu = z.output<
  typeof parolaBaglantisiUretYoluSemasi
>;
