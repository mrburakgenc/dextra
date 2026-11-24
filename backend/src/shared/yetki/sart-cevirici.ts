import type { Islec, SabitDeger } from '../kimlik/yetki-verisi.contract.js';

// Yer tutucuları çözülmüş şart öğesi.
export interface CozulmusSartOgesi {
  readonly alan: string;
  readonly islec: Islec;
  readonly deger: SabitDeger | readonly SabitDeger[];
}

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
// Yalnız kaydın kendi kolonuna bakan şart çevrilir; bilinmeyen alan şartı çevrilmez kılar.
export function sartiCevir(
  sart: readonly CozulmusSartOgesi[],
  alanlar: readonly string[],
): CeviriSonucu {
  const kosullar: PrismaKosulu[] = [];
  for (const oge of sart) {
    if (!alanlar.includes(oge.alan)) {
      return { neden: `bilinmeyen alan: ${oge.alan}` };
    }
    if (LISTE_ISLECLERI.includes(oge.islec) !== Array.isArray(oge.deger)) {
      return { neden: `işleç ile değerin biçimi uymuyor: ${oge.alan}` };
    }
    kosullar.push({ [oge.alan]: { [PRISMA_ISLECI[oge.islec]]: oge.deger } });
  }
  return { kosul: { AND: kosullar } };
}
