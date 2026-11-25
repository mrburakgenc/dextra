import 'server-only';
import { z } from 'zod';
import type { BackendHatasi } from '../../shared/backend/hata';
import { backendIstegi } from '../../shared/backend/istek';
import { KAYIT_BULUNAMADI } from './is-hatasi';
import { KullaniciKimligi } from './semalar';

// Tek kullanıcının kaydı (TS-004 "Yönetim ekranları"): backend'in GET kimlik/kullanici/:id
// sözleşmesi ön yüzde ayrı yazılır (KR-014). Kayıtta yalnız kişinin görebildiği kolonlar gelir;
// gelmeyen kolon undefined kalır.
const KullaniciKaydi = z.object({
  id: z.string(),
  kullaniciAdi: z.string().nullable().optional(),
  gorunenAd: z.string().optional(),
  telefon: z.string().nullable().optional(),
  sistemAktoru: z.boolean().optional(),
  pasifZamani: z.string().nullable().optional(),
  unutulmaZamani: z.string().nullable().optional(),
  olusturmaZamani: z.string().optional(),
});
export type KullaniciKaydi = z.infer<typeof KullaniciKaydi>;

export type KullaniciKaydiSonucu =
  | { readonly basarili: true; readonly kayit: KullaniciKaydi }
  | { readonly basarili: false; readonly hata: BackendHatasi };

// uuid olmayan kimlik backend yoluna konmaz; böyle bir kayıt olamayacağı için bulunamadı sayılır.
export async function kullaniciyiGetir(id: string): Promise<KullaniciKaydiSonucu> {
  const kimlik = KullaniciKimligi.safeParse(id);
  if (!kimlik.success) {
    return {
      basarili: false,
      hata: { kod: 'bulunamadi', ileti: KAYIT_BULUNAMADI, ayrinti: null, durum: 404 },
    };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/kullanici/${kimlik.data}`,
    yontem: 'GET',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return sonuc;
  }
  return { basarili: true, kayit: KullaniciKaydi.parse(sonuc.govde) };
}
