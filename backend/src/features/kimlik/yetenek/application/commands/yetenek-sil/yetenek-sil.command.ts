// Yetenek sil komutu: yoldaki kimliğin şeması ve ondan türeyen komut tipi (KR-014).
import { z } from 'zod';

export const yetenekSilKomutuSemasi = z.object({ id: z.uuid() });

export type YetenekSilKomutu = z.output<typeof yetenekSilKomutuSemasi>;
