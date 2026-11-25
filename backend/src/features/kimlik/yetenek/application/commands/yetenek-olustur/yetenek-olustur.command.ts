// Yetenek yaz komutu: POST kimlik/yetenek gövdesinin şeması ve ondan türeyen komut tipi (TS-002 AK-39;
// KR-014). Gövdede şemada olmayan alan kabul edilmez; içerik alanları komutta değer nesnesi olarak durur.
// Etki ve öncelik isteğe bağlıdır (TS-008 "Yönetim, izinler ve teşhis"); aralığı varlık denetler.
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
    giremez: z.boolean().optional(),
    oncelik: z.number().int().optional(),
    ...yetenekIcerigiAlanlari,
  }),
);

export type YetenekOlusturKomutu = z.output<typeof yetenekOlusturKomutuSemasi>;
