// Grubu taşı komutu: yoldaki kimliğin ve gövdenin şemaları, ikisinden türeyen komut tipi (TS-002
// AK-39; KR-014). Gövde yalnız yeni üst grubu taşır.
import { z } from 'zod';

export const grupTasiYoluSemasi = z.object({ id: z.uuid() });

export const grupTasiGovdesiSemasi = z.strictObject({
  ustGrupId: z.uuid(),
});

export type GrupTasiYolu = z.output<typeof grupTasiYoluSemasi>;

export type GrupTasiGovdesi = z.output<typeof grupTasiGovdesiSemasi>;

export type GrupTasiKomutu = GrupTasiYolu & GrupTasiGovdesi;
