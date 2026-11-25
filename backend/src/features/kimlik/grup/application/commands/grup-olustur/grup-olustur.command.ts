// Grup oluştur komutu: gövdenin şeması ve ondan türeyen komut tipi (TS-002 AK-39; KR-014). Üst grup
// zorunludur: kök grup tektir, bu uçla açılamaz. Şemada olmayan alan kabul edilmez.
import { z } from 'zod';
import { grupAdiAlani } from '../../_shared/grup-adi-alani.js';

export const grupOlusturKomutuSemasi = z.strictObject({
  ad: grupAdiAlani,
  ustGrupId: z.uuid(),
});

export type GrupOlusturKomutu = z.output<typeof grupOlusturKomutuSemasi>;
