import 'server-only';
import { z } from 'zod';
import { type ListeSonucu, listeyiGetir } from '../../shared/liste/liste-istegi';
import { sayfaSemasi, siralamaSemasi } from '../../shared/liste/sorgu';

// Kullanıcı listesi (TS-004 "Yönetim ekranları"): sayfa, sıralama ve pasif süzgeci adresin
// sorgusunda durur; backend'in GET kimlik/kullanici sözleşmesi ön yüzde ayrı yazılır (KR-014).

// Geçersiz değer varsayılana döner: sayfa 1, sıralama ve süzgeç yok (backend'in varsayılanı).
export const KullaniciListesiSorgusu = z.object({
  sayfa: sayfaSemasi,
  sirala: siralamaSemasi(['gorunenAd', 'kullaniciAdi', 'olusturmaZamani']),
  pasif: z.enum(['true', 'false']).optional().catch(undefined),
});
export type KullaniciListesiSorgusu = z.infer<typeof KullaniciListesiSorgusu>;

// Kayıtta yalnız kişinin görebildiği kolonlar gelir; gelmeyen kolon undefined kalır.
// Ekranda gösterilmeyen kolonlar okunmaz.
const KullaniciKaydi = z.object({
  id: z.string(),
  gorunenAd: z.string().optional(),
  kullaniciAdi: z.string().nullable().optional(),
  pasifZamani: z.string().nullable().optional(),
  olusturmaZamani: z.string().optional(),
});
export type KullaniciKaydi = z.infer<typeof KullaniciKaydi>;

export function kullanicilariListele(
  sorgu: KullaniciListesiSorgusu,
): Promise<ListeSonucu<KullaniciKaydi>> {
  return listeyiGetir('/kimlik/kullanici', sorgu, KullaniciKaydi);
}
