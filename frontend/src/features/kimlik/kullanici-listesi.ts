import 'server-only';
import { z } from 'zod';
import type { BackendHatasi } from '../../shared/backend/hata';
import { backendIstegi } from '../../shared/backend/istek';

// Kullanıcı listesi (TS-004 "Yönetim ekranları"): sayfa, sıralama ve pasif süzgeci adresin
// sorgusunda durur; backend'in GET kimlik/kullanici sözleşmesi ön yüzde ayrı yazılır (KR-014).

// Azalan sıra için kolonun başına '-' yazılır.
const SIRALAMALAR = [
  'gorunenAd',
  '-gorunenAd',
  'kullaniciAdi',
  '-kullaniciAdi',
  'olusturmaZamani',
  '-olusturmaZamani',
] as const;

// Geçersiz değer varsayılana döner: sayfa 1, sıralama ve süzgeç yok (backend'in varsayılanı).
export const KullaniciListesiSorgusu = z.object({
  sayfa: z.coerce.number().int().min(1).catch(1),
  sirala: z.enum(SIRALAMALAR).optional().catch(undefined),
  pasif: z.enum(['true', 'false']).optional().catch(undefined),
});
export type KullaniciListesiSorgusu = z.infer<typeof KullaniciListesiSorgusu>;

// Kayıtta yalnız kişinin görebildiği kolonlar gelir; gelmeyen kolon undefined kalır.
// Ekranda gösterilmeyen kolonlar okunmaz.
const KullaniciListesiCevabi = z.object({
  kayitlar: z.array(
    z.object({
      id: z.string(),
      gorunenAd: z.string().optional(),
      kullaniciAdi: z.string().nullable().optional(),
      pasifZamani: z.string().nullable().optional(),
      olusturmaZamani: z.string().optional(),
    }),
  ),
  sayfa: z.number(),
  sonrakiVar: z.boolean(),
});
export type KullaniciListesi = z.infer<typeof KullaniciListesiCevabi>;

export type KullaniciListesiSonucu =
  | { readonly basarili: true; readonly liste: KullaniciListesi }
  | { readonly basarili: false; readonly hata: BackendHatasi };

// Sorgunun dolu alanları adres sorgusuna yazılır; sıra sabittir (sayfa, sirala, pasif).
export function sorguMetni(sorgu: Partial<KullaniciListesiSorgusu>): string {
  const parametreler = new URLSearchParams();
  if (sorgu.sayfa !== undefined) {
    parametreler.set('sayfa', String(sorgu.sayfa));
  }
  if (sorgu.sirala !== undefined) {
    parametreler.set('sirala', sorgu.sirala);
  }
  if (sorgu.pasif !== undefined) {
    parametreler.set('pasif', sorgu.pasif);
  }
  const metin = parametreler.toString();
  return metin === '' ? '' : `?${metin}`;
}

export async function kullanicilariListele(
  sorgu: KullaniciListesiSorgusu,
): Promise<KullaniciListesiSonucu> {
  const sonuc = await backendIstegi({
    yol: `/kimlik/kullanici${sorguMetni(sorgu)}`,
    yontem: 'GET',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return sonuc;
  }
  return { basarili: true, liste: KullaniciListesiCevabi.parse(sonuc.govde) };
}
