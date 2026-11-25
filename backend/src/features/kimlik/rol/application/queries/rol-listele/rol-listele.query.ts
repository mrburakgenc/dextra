// Rolleri listele sorgusu: sorgu dizgesinin şeması ve ondan türeyen sorgu tipi (TS-002 AK-39; KR-014).
import type { z } from 'zod';
import { listeSemasi } from '../../_shared/liste.js';

export const rolListeleSorgusuSemasi = listeSemasi([
  'ad',
  '-ad',
  'kod',
  '-kod',
]);

export type RolListeleSorgusu = z.output<typeof rolListeleSorgusuSemasi>;
