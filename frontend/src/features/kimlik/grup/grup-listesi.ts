import 'server-only';
import { z } from 'zod';
import { type ListeSonucu, listeyiGetir } from '../../../shared/liste/liste-istegi';
import { sayfaSemasi, siralamaSemasi } from '../../../shared/liste/sorgu';

// Grup listesi (TS-004 "Yönetim ekranları"): backend'in GET kimlik/grup sözleşmesi ön yüzde ayrı
// yazılır (KR-014). ustGrupId verilirse yalnız o grubun doğrudan altındakiler gelir. Geçersiz
// sorgu değeri varsayılana döner.

export const GrupListesiSorgusu = z.object({
  sayfa: sayfaSemasi,
  sirala: siralamaSemasi(['ad', 'olusturmaZamani']),
  ustGrupId: z.uuid().optional().catch(undefined),
});
export type GrupListesiSorgusu = z.infer<typeof GrupListesiSorgusu>;

// ustGrupId kök grupta boştur (null); kişinin göremediği kolon gelmez (undefined).
const GrupKaydi = z.object({
  id: z.string(),
  ustGrupId: z.string().nullable().optional(),
  ad: z.string().optional(),
  olusturmaZamani: z.string().optional(),
});
export type GrupKaydi = z.infer<typeof GrupKaydi>;

export function gruplariListele(
  sorgu: GrupListesiSorgusu,
): Promise<ListeSonucu<GrupKaydi>> {
  return listeyiGetir('/kimlik/grup', sorgu, GrupKaydi);
}
