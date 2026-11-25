// Rol oluştur komutu: gövdenin şeması ve ondan türeyen komut tipi (TS-002 AK-39; KR-014). Şemada
// olmayan alan (kod dahil) kabul edilmez.
import { z } from 'zod';
import { rolAdiAlani } from '../../_shared/rol-adi-alani.js';

export const rolOlusturKomutuSemasi = z.strictObject({ ad: rolAdiAlani });

export type RolOlusturKomutu = z.output<typeof rolOlusturKomutuSemasi>;
