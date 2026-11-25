// İzinleri listele sorgusu: sorgu dizgesinin şeması ve ondan türeyen sorgu tipi (TS-002 AK-39; KR-014).
import type { z } from 'zod';
import { listeSemasi } from '../../_shared/liste.js';

export const izinListeleSorgusuSemasi = listeSemasi([
  'kaynak',
  '-kaynak',
  'eylem',
  '-eylem',
]);

export type IzinListeleSorgusu = z.output<typeof izinListeleSorgusuSemasi>;
