// Yetenek yaz komutu: POST kimlik/yetenek gövdesinin şeması ve ondan türeyen komut tipi (TS-002 AK-39;
// KR-014). Gövdede şemada olmayan alan kabul edilmez; içerik alanları komutta değer nesnesi olarak durur.
import { z } from 'zod';
import {
  yetenekIcerigiAlanlari,
  yetenekIcerigiSiniri,
} from '../../_shared/yetenek-icerigi-alani.js';

export const yetenekOlusturKomutuSemasi = yetenekIcerigiSiniri(
  z.strictObject({
    grupId: z.uuid(),
    rolId: z.uuid(),
    izinId: z.uuid(),
    ...yetenekIcerigiAlanlari,
  }),
);

export type YetenekOlusturKomutu = z.output<typeof yetenekOlusturKomutuSemasi>;
