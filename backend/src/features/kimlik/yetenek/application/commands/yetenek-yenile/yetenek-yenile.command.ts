// Yetenek yenile komutu: yoldaki kimliğin ve POST kimlik/yetenek/:id/yenile gövdesinin şemaları, ikisinden
// türeyen komut tipi (TS-002 AK-39; KR-014). Gövde yalnız içeriği taşır; grup, rol ve izin eski satırdan
// alınır.
import { z } from 'zod';
import {
  yetenekIcerigiAlanlari,
  yetenekIcerigiSiniri,
} from '../../_shared/yetenek-icerigi-alani.js';

export const yetenekYenileYoluSemasi = z.object({ id: z.uuid() });

export const yetenekYenileGovdesiSemasi = yetenekIcerigiSiniri(
  z.strictObject(yetenekIcerigiAlanlari),
);

export type YetenekYenileYolu = z.output<typeof yetenekYenileYoluSemasi>;

export type YetenekYenileGovdesi = z.output<typeof yetenekYenileGovdesiSemasi>;

export type YetenekYenileKomutu = YetenekYenileYolu & YetenekYenileGovdesi;
