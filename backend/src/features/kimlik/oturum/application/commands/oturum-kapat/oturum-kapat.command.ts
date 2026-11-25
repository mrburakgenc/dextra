// Oturum kapat komutu: yoldaki kimliğin ve gövdenin şemaları, komut tipi (KR-014). Gövdesizdir; alan
// taşıyan gövde reddedilir.
import { z } from 'zod';

export const oturumKapatIdSemasi = z.uuid();

export const oturumKapatGovdesiSemasi = z.strictObject({}).optional();

export interface OturumKapatKomutu {
  readonly id: z.output<typeof oturumKapatIdSemasi>;
}
