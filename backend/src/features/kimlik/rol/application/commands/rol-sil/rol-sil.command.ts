// Rol sil komutu: yoldaki kimliğin şeması ve ondan türeyen komut tipi (KR-014).
import { z } from 'zod';

export const rolSilKomutuSemasi = z.object({ id: z.uuid() });

export type RolSilKomutu = z.output<typeof rolSilKomutuSemasi>;
