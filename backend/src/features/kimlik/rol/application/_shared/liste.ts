// Rol alt özelliğinin liste sorgularına ortak parçalar: sorgu şeması, sorgu ve cevap tipleri, sayfalama
// (TS-002 AK-39; KR-014). Sayfa 1'den başlar; toplam sayı dönmez.
import { z } from 'zod';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { Sayfa } from '../../domain/repositories/i-rol.repository.js';

export interface ListeSorgusu {
  readonly sayfa: number;
  readonly boyut: number;
  readonly siralama: readonly Siralama[];
}

export interface ListeCevabi<K> {
  readonly kayitlar: readonly K[];
  readonly sayfa: number;
  readonly boyut: number;
  readonly sonrakiVar: boolean;
}

// Boyut en çok 100 (varsayılan 20); sirala kaynağın sabit listesinden bir alan, azalan için başında "-".
export function listeSemasi(siralamalar: readonly [string, ...string[]]) {
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

// Sonraki sayfanın varlığı, boyuttan bir fazla kayıt istenerek anlaşılır; fazla kayıt cevaba girmez.
export async function sayfala<K>(
  { sayfa, boyut, siralama }: ListeSorgusu,
  oku: (siralama: readonly Siralama[], sayfa: Sayfa) => Promise<K[]>,
): Promise<ListeCevabi<K>> {
  const kayitlar = await oku(siralama, {
    atla: (sayfa - 1) * boyut,
    al: boyut + 1,
  });
  return {
    kayitlar: kayitlar.slice(0, boyut),
    sayfa,
    boyut,
    sonrakiVar: kayitlar.length > boyut,
  };
}
