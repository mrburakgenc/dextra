import 'server-only';
import { z } from 'zod';
import { type ListeSonucu, listeyiGetir } from '../../../shared/liste/liste-istegi';
import { sayfaSemasi, siralamaSemasi } from '../../../shared/liste/sorgu';

// Rol listesi (TS-004 "Yönetim ekranları"): backend'in GET kimlik/rol sözleşmesi ön yüzde ayrı
// yazılır (KR-014). Geçersiz sorgu değeri varsayılana döner.

export const RolListesiSorgusu = z.object({
  sayfa: sayfaSemasi,
  sirala: siralamaSemasi(['ad', 'kod']),
});
export type RolListesiSorgusu = z.infer<typeof RolListesiSorgusu>;

// kod yalnız sistem rollerinde doludur; kişinin göremediği kolon gelmez (undefined).
export const RolKaydi = z.object({
  id: z.string(),
  kod: z.string().nullable().optional(),
  ad: z.string().optional(),
});
export type RolKaydi = z.infer<typeof RolKaydi>;

export function rolleriListele(
  sorgu: RolListesiSorgusu,
): Promise<ListeSonucu<RolKaydi>> {
  return listeyiGetir('/kimlik/rol', sorgu, RolKaydi);
}
