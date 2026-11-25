// Yeteneği oku sorgusu: yoldaki kimliğin şeması ve ondan türeyen sorgu tipi (KR-014).
import { z } from 'zod';

export const yetenekOkuSorgusuSemasi = z.object({ id: z.uuid() });

export type YetenekOkuSorgusu = z.output<typeof yetenekOkuSorgusuSemasi>;
