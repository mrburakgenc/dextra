import { Prisma } from '../../database/generated/client.js';
import type { AlanTipi } from '../domain/alan-tipi.js';
import type { YazmaKatalogu } from '../domain/kaynak-katalogu.js';
import { ALAN_TIPLERI } from './alan-tipleri.js';

// Her kaynakta sistemin yazdığı alanlar (KR-008 Seçim 34): kimlik ile oluşturma, güncelleme ve
// silinme zamanı. Modelde olmayan ad o kaynakta yok sayılır.
const ORTAK_SISTEM_ALANLARI = [
  'id',
  'olusturmaZamani',
  'guncellemeZamani',
  'silinmeZamani',
];

export type AlanAdi<M extends Prisma.ModelName> =
  (typeof Prisma)[`${M}ScalarFieldEnum`][keyof (typeof Prisma)[`${M}ScalarFieldEnum`]];

// Kaynağa özgü sistem alanları; anahtar model adı, değer o modelin alan adlarıdır.
export type SistemAlanlari = {
  readonly [M in Prisma.ModelName]?: readonly AlanAdi<M>[];
};

// Verilen Prisma modellerinden katalog: kaynak model adıdır ve alanları modelin ilişki olmayan
// alanlarıdır (KR-008 Seçim 21 ve 33). Listede olmayan model kaynak değildir. Sistem alanları ortak
// adlar ile verilen kaynağa özgü alanlardır. Alan tipleri ALAN_TIPLERI tablosundan okunur.
export function prismaKaynakKatalogu(
  kaynaklar: readonly Prisma.ModelName[],
  sistemAlanlari: SistemAlanlari = {},
): YazmaKatalogu {
  const alanlar = new Map<string, readonly string[]>(
    kaynaklar.map((kaynak) => [
      kaynak,
      Object.values(Prisma[`${kaynak}ScalarFieldEnum`]),
    ]),
  );
  const sistem = new Map<string, readonly string[]>(
    kaynaklar.map((kaynak) => [
      kaynak,
      [
        ...ORTAK_SISTEM_ALANLARI.filter((alan) =>
          alanlar.get(kaynak)?.includes(alan),
        ),
        ...(sistemAlanlari[kaynak] ?? []),
      ],
    ]),
  );
  const tipler = new Map<string, Readonly<Record<string, AlanTipi>>>(
    kaynaklar.map((kaynak) => [kaynak, ALAN_TIPLERI[kaynak]]),
  );
  return {
    alanlar: (tur) => alanlar.get(tur),
    alanTipleri: (tur) => tipler.get(tur),
    sistemAlanlari: (tur) => sistem.get(tur) ?? [],
  };
}
