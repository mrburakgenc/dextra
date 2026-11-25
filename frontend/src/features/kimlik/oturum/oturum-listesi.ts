import 'server-only';
import { z } from 'zod';
import type { BackendHatasi } from '../../../shared/backend/hata';
import { backendIstegi } from '../../../shared/backend/istek';
import type { Liste } from '../../../shared/liste/liste-istegi';
import { sayfaSemasi, siralamaSemasi, sorguMetni } from '../../../shared/liste/sorgu';

// Oturum listesi (TS-004 "Parola değiştirme ve oturumlar ekranları"): görünüm, sayfa, sıralama ve
// kişi süzgeci adresin sorgusunda durur; backend'in GET kimlik/oturum sözleşmesi ön yüzde ayrı
// yazılır (KR-014).

// Geçersiz değer varsayılana döner: sayfa 1, başlangıç zamanı azalan, açık oturumlar; kimlik
// biçiminde olmayan kullaniciId süzgeci yok sayılır.
export const OturumListesiSorgusu = z.object({
  sayfa: sayfaSemasi,
  sirala: siralamaSemasi(['baslangicZamani', 'sonDondurmeZamani']).transform(
    (sirala) => sirala ?? '-baslangicZamani',
  ),
  acik: z.enum(['true', 'false']).catch('true'),
  kullaniciId: z.uuid().optional().catch(undefined),
});
export type OturumListesiSorgusu = z.infer<typeof OturumListesiSorgusu>;

// Kayıtta yalnız kişinin görebildiği kolonlar gelir; gelmeyen kolon undefined kalır. Ekranda
// gösterilmeyen kolonlar okunmaz.
const OturumKaydi = z.object({
  id: z.string(),
  kullaniciId: z.string().optional(),
  baslangicZamani: z.string().optional(),
  sonDondurmeZamani: z.string().optional(),
  ipAdresi: z.string().optional(),
  tarayiciBilgisi: z.string().optional(),
  kapatilmaZamani: z.string().nullable().optional(),
  kapatilmaNedeni: z.string().nullable().optional(),
});
export type OturumKaydi = z.infer<typeof OturumKaydi>;

// Liste cevabı, ortak liste biçimine ek olarak isteği yapan oturumun kimliğini taşır.
const OturumListesiCevabi = z.object({
  kayitlar: z.array(OturumKaydi),
  sayfa: z.number(),
  sonrakiVar: z.boolean(),
  buOturumId: z.string(),
});

export type OturumListesiSonucu =
  | {
      readonly basarili: true;
      readonly liste: Liste<OturumKaydi>;
      readonly buOturumId: string;
    }
  | { readonly basarili: false; readonly hata: BackendHatasi };

export async function oturumlariListele(
  sorgu: OturumListesiSorgusu,
): Promise<OturumListesiSonucu> {
  const sonuc = await backendIstegi({
    yol: `/kimlik/oturum${sorguMetni(sorgu)}`,
    yontem: 'GET',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return sonuc;
  }
  const { buOturumId, ...liste } = OturumListesiCevabi.parse(sonuc.govde);
  return { basarili: true, liste, buOturumId };
}
