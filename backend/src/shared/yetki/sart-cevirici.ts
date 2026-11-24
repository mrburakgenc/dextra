import type { Islec, SabitDeger } from '../kimlik/yetki-verisi.contract.js';

// Yer tutucuları çözülmüş şart öğesi.
export interface CozulmusSartOgesi {
  readonly alan: string;
  readonly islec: Islec;
  readonly deger: SabitDeger | readonly SabitDeger[];
}

// Değer almayan işleçler (TS-002 AK-42): alanın boş ya da dolu olması. Yalnız çağıranın koşulunda
// kullanılır; saklanan şartın dili değildir (Islec) ve sartiCevir onları çevirmez.
export type DegersizIslec = 'bos' | 'dolu';

// Çağıranın koşulunun bir öğesi.
export type KosulOgesi =
  CozulmusSartOgesi | { readonly alan: string; readonly islec: DegersizIslec };

export type PrismaKosulu = Record<string, unknown>;

export type CeviriSonucu =
  { readonly kosul: PrismaKosulu } | { readonly neden: string };

const PRISMA_ISLECI: Record<Islec, string> = {
  esit: 'equals',
  esit_degil: 'not',
  listede: 'in',
  listede_degil: 'notIn',
  kucuk: 'lt',
  kucuk_esit: 'lte',
  buyuk: 'gt',
  buyuk_esit: 'gte',
};

const LISTE_ISLECLERI: readonly Islec[] = ['listede', 'listede_degil'];

// Şartı Prisma sorgu koşuluna çevirir; öğeler "ve" ile bağlanır.
// Yalnız kaydın kendi kolonuna bakan şart çevrilir; bilinmeyen alan ya da saklanan şartın dilinde
// olmayan işleç (değersiz işleçler dahil) şartı çevrilmez kılar.
export function sartiCevir(
  sart: readonly CozulmusSartOgesi[],
  alanlar: readonly string[],
): CeviriSonucu {
  const kosullar: PrismaKosulu[] = [];
  for (const oge of sart) {
    if (!alanlar.includes(oge.alan)) {
      return { neden: `bilinmeyen alan: ${oge.alan}` };
    }
    if (!Object.hasOwn(PRISMA_ISLECI, oge.islec)) {
      return { neden: `bilinmeyen işleç: ${oge.islec}` };
    }
    if (LISTE_ISLECLERI.includes(oge.islec) !== Array.isArray(oge.deger)) {
      return { neden: `işleç ile değerin biçimi uymuyor: ${oge.alan}` };
    }
    kosullar.push({ [oge.alan]: { [PRISMA_ISLECI[oge.islec]]: oge.deger } });
  }
  return { kosul: { AND: kosullar } };
}

// Çağıranın koşulunu çevirir: değersiz işleçli öğe boş ya da dolu sınamasıdır (Prisma "equals: null"u
// IS NULL, "not: null"u IS NOT NULL yapar), öbür öğeler sartiCevir ile çevrilir.
export function kosuluCevir(
  kosul: readonly KosulOgesi[],
  alanlar: readonly string[],
): CeviriSonucu {
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
      default:
        degerli.push(oge);
    }
  }
  const ceviri = sartiCevir(degerli, alanlar);
  return 'neden' in ceviri
    ? ceviri
    : { kosul: { AND: [...kosullar, ceviri.kosul] } };
}
