// Üyeliği oku sorgusu: yoldaki kimliğin şeması ve ondan türeyen sorgu tipi (KR-014).
import { z } from 'zod';

export const uyelikOkuSorgusuSemasi = z.object({ id: z.uuid() });

export type UyelikOkuSorgusu = z.output<typeof uyelikOkuSorgusuSemasi>;
