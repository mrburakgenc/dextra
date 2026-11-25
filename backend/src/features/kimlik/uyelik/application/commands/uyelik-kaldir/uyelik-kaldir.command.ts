// Üyelik kaldır komutu: yoldaki kimliğin şeması ve ondan türeyen komut tipi (KR-014).
import { z } from 'zod';

export const uyelikKaldirKomutuSemasi = z.object({ id: z.uuid() });

export type UyelikKaldirKomutu = z.output<typeof uyelikKaldirKomutuSemasi>;
