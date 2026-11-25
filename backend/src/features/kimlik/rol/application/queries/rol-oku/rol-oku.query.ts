// Rolü oku sorgusu: yoldaki kimliğin şeması ve ondan türeyen sorgu tipi (KR-014).
import { z } from 'zod';

export const rolOkuSorgusuSemasi = z.object({ id: z.uuid() });

export type RolOkuSorgusu = z.output<typeof rolOkuSorgusuSemasi>;
