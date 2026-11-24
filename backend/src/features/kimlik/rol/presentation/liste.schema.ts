import { z } from 'zod';
import type { ListeSorgusu } from '../application/liste.query.js';

// Liste sorgusu (TS-002 AK-39; KR-014): sayfa 1'den, boyut en çok 100 (varsayılan 20), sirala
// kaynağın sabit listesinden bir alan; azalan için başında "-".
function listeSemasi(siralamalar: readonly [string, ...string[]]) {
  return z
    .object({
      sayfa: z.coerce.number().int().min(1).default(1),
      boyut: z.coerce.number().int().min(1).max(100).default(20),
      sirala: z.enum(siralamalar).optional(),
    })
    .transform(({ sayfa, boyut, sirala }): ListeSorgusu => ({
      sayfa,
      boyut,
      siralama:
        sirala === undefined
          ? []
          : sirala.startsWith('-')
            ? [{ alan: sirala.slice(1), yon: 'azalan' }]
            : [{ alan: sirala, yon: 'artan' }],
    }));
}

export const rolListeSemasi = listeSemasi(['ad', '-ad', 'kod', '-kod']);

export const izinListeSemasi = listeSemasi([
  'kaynak',
  '-kaynak',
  'eylem',
  '-eylem',
]);
