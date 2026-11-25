import { Prisma } from '../database/generated/client.js';
import { ALAN_TIPLERI, type AlanTipi } from './alan-tipleri.js';

// Kaynak türünün adından o türün alan adlarına ve alanlarının tiplerine (TS-002 AK-44); bilinmeyen
// tür için undefined.
export interface KaynakKatalogu {
  alanlar(tur: string): readonly string[] | undefined;
  alanTipleri(tur: string): Readonly<Record<string, AlanTipi>> | undefined;
}

// Yazma kapısının kataloğu: alanlara ek olarak yalnız sistemin yazdığı alanları bilir; onlar istek
// gövdesinden kabul edilmez (KR-008 Seçim 34; TS-002 "Veri modeli", çürütme 17). Bilinmeyen tür için
// boş.
export interface YazmaKatalogu extends KaynakKatalogu {
  sistemAlanlari(tur: string): readonly string[];
}

export const KAYNAK_KATALOGU = Symbol('KaynakKatalogu');

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
