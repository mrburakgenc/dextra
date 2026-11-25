// Eski yüzün çağıranın koşulunu çeviren parçası (TS-007 "Adlar, denetim ve geçiş"): eski yüzle birlikte
// kaynak kodundan çıktı; üretimde çağıranı yoktur.
import {
  type CeviriSonucu,
  type CozulmusSartOgesi,
  type PrismaKosulu,
  sartiCevir,
  tipiSina,
} from '../../src/shared/yetki/application/sart-cevirici.js';
import type { AlanTipi } from '../../src/shared/yetki/domain/alan-tipi.js';

// Değer almayan işleçler (TS-002 AK-42): alanın boş ya da dolu olması. Yalnız çağıranın koşulunda
// kullanılır; saklanan şartın dili değildir (Islec) ve sartiCevir onları çevirmez.
export type DegersizIslec = 'bos' | 'dolu';

// Çağıranın koşulunun bir öğesi.
export type KosulOgesi =
  CozulmusSartOgesi | { readonly alan: string; readonly islec: DegersizIslec };

export type KosulCevirisi = CeviriSonucu | { readonly uyumsuz: string };

// Çağıranın koşulunu çevirir: değersiz işleçli öğe boş ya da dolu sınamasıdır (Prisma "equals: null"u
// IS NULL, "not: null"u IS NOT NULL yapar), öbür öğeler tipiSina'dan geçip sartiCevir ile çevrilir.
export function kosuluCevir(
  kosul: readonly KosulOgesi[],
  tipler: Readonly<Record<string, AlanTipi>>,
): KosulCevirisi {
  const alanlar = Object.keys(tipler);
  const kosullar: PrismaKosulu[] = [];
  const degerli: CozulmusSartOgesi[] = [];
  for (const oge of kosul) {
    switch (oge.islec) {
      case 'bos':
      case 'dolu':
        if (!alanlar.includes(oge.alan)) {
          return { neden: `bilinmeyen alan: ${oge.alan}` };
        }
        kosullar.push({
          [oge.alan]: oge.islec === 'bos' ? { equals: null } : { not: null },
        });
        break;
      default: {
        const bulgu = tipiSina(oge, tipler);
        if (bulgu !== undefined) {
          return bulgu;
        }
        degerli.push(oge);
      }
    }
  }
  const ceviri = sartiCevir(degerli, alanlar);
  return 'neden' in ceviri
    ? ceviri
    : { kosul: { AND: [...kosullar, ceviri.kosul] } };
}
