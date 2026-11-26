// Yetenek yenile komutu: yoldaki kimliğin ve POST kimlik/yetenek/:id/yenile gövdesinin şemaları, ikisinden
// türeyen komut tipi (TS-002 AK-39; KR-014). Gövde yalnız içeriği ve isteğe bağlı önceliği taşır; grup,
// rol, izin ve etki eski satırdan alınır (etki çevrilemez: gövdede `giremez` şemada olmayan alandır;
// KU-020).
import { z } from 'zod';
import {
  yetenekIcerigiAlanlari,
  yetenekIcerigiSiniri,
} from '../../_shared/yetenek-icerigi-alani.js';

export const yetenekYenileYoluSemasi = z.object({ id: z.uuid() });

export const yetenekYenileGovdesiSemasi = yetenekIcerigiSiniri(
  z.strictObject({
    oncelik: z.number().int().optional(),
    ...yetenekIcerigiAlanlari,
  }),
);

export type YetenekYenileYolu = z.output<typeof yetenekYenileYoluSemasi>;

export type YetenekYenileGovdesi = z.output<typeof yetenekYenileGovdesiSemasi>;

export type YetenekYenileKomutu = YetenekYenileYolu & YetenekYenileGovdesi;
