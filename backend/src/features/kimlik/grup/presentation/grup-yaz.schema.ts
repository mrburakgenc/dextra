import { z } from 'zod';

// Grubun adı: baştaki ve sondaki boşluk atılır, kalan 1-100 karakterdir.
const grupAdi = z.string().trim().min(1).max(100);

// POST kimlik/grup gövdesi (KR-014). Üst grup zorunludur: kök grup tektir, bu uçla açılamaz.
export const grupOlusturSemasi = z.strictObject({
  ad: grupAdi,
  ustGrupId: z.uuid(),
});

// PATCH kimlik/grup/:id gövdesi. Yalnız ad kabul edilir; üst grup yalnız "taşı" işiyle değişir.
export const grupGuncelleSemasi = z.strictObject({
  ad: grupAdi,
});

// POST kimlik/grup/:id/tasi gövdesi: yalnız yeni üst grup.
export const grupTasiSemasi = z.strictObject({
  ustGrupId: z.uuid(),
});

export type GrupTasiGovdesi = z.infer<typeof grupTasiSemasi>;
export type GrupOlusturGovdesi = z.infer<typeof grupOlusturSemasi>;
export type GrupGuncelleGovdesi = z.infer<typeof grupGuncelleSemasi>;
