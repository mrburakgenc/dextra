import 'server-only';
import { z } from 'zod';
import { type ListeSonucu, listeyiGetir } from '../../../shared/liste/liste-istegi';
import { sayfaSemasi, siralamaSemasi } from '../../../shared/liste/sorgu';

// İzin kataloğu (TS-004 "Yönetim ekranları"): backend'in GET kimlik/izin sözleşmesi ön yüzde ayrı
// yazılır (KR-014). Geçersiz sorgu değeri varsayılana döner.

export const IzinListesiSorgusu = z.object({
  sayfa: sayfaSemasi,
  sirala: siralamaSemasi(['kaynak', 'eylem']),
});
export type IzinListesiSorgusu = z.infer<typeof IzinListesiSorgusu>;

// Kişinin göremediği kolon gelmez (undefined).
const IzinKaydi = z.object({
  id: z.string(),
  kaynak: z.string().optional(),
  eylem: z.string().optional(),
});
export type IzinKaydi = z.infer<typeof IzinKaydi>;

export function izinleriListele(
  sorgu: IzinListesiSorgusu,
): Promise<ListeSonucu<IzinKaydi>> {
  return listeyiGetir('/kimlik/izin', sorgu, IzinKaydi);
}
