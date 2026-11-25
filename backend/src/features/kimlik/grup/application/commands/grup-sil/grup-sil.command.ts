// Grubu sil komutu: yoldaki kimliğin şeması ve ondan türeyen komut tipi (KR-014).
import { z } from 'zod';

export const grupSilKomutuSemasi = z.object({ id: z.uuid() });

export type GrupSilKomutu = z.output<typeof grupSilKomutuSemasi>;
