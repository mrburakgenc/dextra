// Rol adını değiştir komutu: yoldaki kimliğin ve gövdenin şemaları, ikisinden türeyen komut tipi
// (TS-002 AK-39; KR-014). Gövdede şemada olmayan alan (kod dahil) kabul edilmez.
import { z } from 'zod';
import { rolAdiAlani } from '../../_shared/rol-adi-alani.js';

export const rolAdiniDegistirYoluSemasi = z.object({ id: z.uuid() });

export const rolAdiniDegistirGovdesiSemasi = z.strictObject({
  ad: rolAdiAlani,
});

export type RolAdiniDegistirYolu = z.output<typeof rolAdiniDegistirYoluSemasi>;

export type RolAdiniDegistirGovdesi = z.output<
  typeof rolAdiniDegistirGovdesiSemasi
>;

export type RolAdiniDegistirKomutu = RolAdiniDegistirYolu &
  RolAdiniDegistirGovdesi;
