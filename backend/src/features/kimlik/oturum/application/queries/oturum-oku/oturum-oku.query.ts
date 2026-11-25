// Oturumu oku sorgusu: yoldaki kimliğin şeması ve sorgu tipi (KR-014).
import { z } from 'zod';

export const oturumOkuIdSemasi = z.uuid();

export interface OturumOkuSorgusu {
  readonly id: z.output<typeof oturumOkuIdSemasi>;
}
