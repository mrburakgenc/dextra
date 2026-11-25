// Yetki yüzünün modele özgü tipleri (TS-007 "Yapı"): kaynak adı Prisma'nın model adıdır; süzgeç,
// seçim ve yazma verisi repository'ye o modelin Prisma tipleriyle verilir. Motor koşulları ve seçimi
// o modelin kataloğundan ve kurallarından genel tiple kurar; tip bunu ifade edemediği için genel tipten
// modele özgü tipe dönüşüm yalnız yeni yüzün giriş noktalarında yapılır (OkumaKapisi.yetki ve
// YazmaKapisi'nin deyimle başlayan işlevleri); repository tip zorlamaz.
import { Prisma } from '../../database/generated/client.js';

type Islemler<M extends Prisma.ModelName> =
  Prisma.TypeMap['model'][M]['operations'];

// Modelin koşul tipi (where).
export type SatirSuzgeci<M extends Prisma.ModelName> = NonNullable<
  Islemler<M>['findMany']['args']['where']
>;

// Modelin ilişki olmayan alanlarından seçilenler (select).
export type KolonSecimi<M extends Prisma.ModelName> = {
  readonly [A in keyof Prisma.TypeMap['model'][M]['fields']]?: true;
};

export type OlusturmaVerisi<M extends Prisma.ModelName> =
  Islemler<M>['create']['args']['data'];

export type GuncellemeVerisi<M extends Prisma.ModelName> =
  Islemler<M>['updateMany']['args']['data'];

// Kaynak adıyla çalışan eski yüzün adı model adına çevirmesi; model olmayan ad hatadır.
export function modelAdi(kaynak: string): Prisma.ModelName {
  const ad = Object.values(Prisma.ModelName).find((m) => m === kaynak);
  if (ad === undefined) {
    throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
  }
  return ad;
}
