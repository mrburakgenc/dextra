// Grubun adını değiştir komutu: yoldaki kimliğin ve gövdenin şemaları, ikisinden türeyen komut tipi
// (TS-002 AK-39; KR-014). Gövde yalnız adı kabul eder; üst grup yalnız "taşı" işiyle değişir.
import { z } from 'zod';
import { grupAdiAlani } from '../../_shared/grup-adi-alani.js';

export const grupGuncelleYoluSemasi = z.object({ id: z.uuid() });

export const grupGuncelleGovdesiSemasi = z.strictObject({
  ad: grupAdiAlani,
});

export type GrupGuncelleYolu = z.output<typeof grupGuncelleYoluSemasi>;

export type GrupGuncelleGovdesi = z.output<typeof grupGuncelleGovdesiSemasi>;

export type GrupGuncelleKomutu = GrupGuncelleYolu & GrupGuncelleGovdesi;
