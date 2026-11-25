// Kullanıcıyı oku sorgusu: GET kimlik/kullanici/:id yolundaki kimliğin şeması ve ondan türeyen sorgu
// tipi (KR-014).
import { z } from 'zod';

export const kullaniciOkuSorgusuSemasi = z.object({ id: z.uuid() });

export type KullaniciOkuSorgusu = z.output<typeof kullaniciOkuSorgusuSemasi>;
