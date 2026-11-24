import { Prisma } from '../database/generated/client.js';

// Kaynak türünün adından o türün alan adlarına; bilinmeyen tür için undefined.
export interface KaynakKatalogu {
  alanlar(tur: string): readonly string[] | undefined;
}

export const KAYNAK_KATALOGU = Symbol('KaynakKatalogu');

// Verilen Prisma modellerinden katalog: kaynak model adıdır ve alanları modelin ilişki olmayan
// alanlarıdır (KR-008 Seçim 21 ve 33). Listede olmayan model kaynak değildir.
export function prismaKaynakKatalogu(
  kaynaklar: readonly Prisma.ModelName[],
): KaynakKatalogu {
  const alanlar = new Map<string, readonly string[]>(
    kaynaklar.map((kaynak) => [
      kaynak,
      Object.values(Prisma[`${kaynak}ScalarFieldEnum`]),
    ]),
  );
  return { alanlar: (tur) => alanlar.get(tur) };
}
