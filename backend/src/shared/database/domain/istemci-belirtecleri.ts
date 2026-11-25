// Ham Prisma istemcilerinin belirteçleri. Ayrı dosyadadır: feature bu dosyayı içe aktaramaz
// (eslint.config.mjs); veri erişimi yalnız Unit of Work'ün iki kapısından geçer (KR-011).

// Asıl veritabanının (dextra) istemcisi bu belirteçle enjekte edilir.
export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

// İz veritabanının (dextra_iz) istemcisi bu belirteçle enjekte edilir; yalnız ortak altyapı kodu kullanır (KR-013).
export const IZ_PRISMA_CLIENT = Symbol('IZ_PRISMA_CLIENT');
