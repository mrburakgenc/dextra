// Grubu oku sorgusu: yoldaki kimliğin şeması ve ondan türeyen sorgu tipi (KR-014).
import { z } from 'zod';

export const grupOkuSorgusuSemasi = z.object({ id: z.uuid() });

export type GrupOkuSorgusu = z.output<typeof grupOkuSorgusuSemasi>;
