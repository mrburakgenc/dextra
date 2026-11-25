import 'server-only';
import type { z } from 'zod';
import type { BackendHatasi } from '../../shared/backend/hata';
import { backendIstegi } from '../../shared/backend/istek';
import { KAYIT_BULUNAMADI } from './is-hatasi';
import { KayitKimligi } from './semalar';

// Rol ve grubun tek kaydı (TS-004 "Yönetim ekranları"): GET kimlik/<kaynak>/:id. Kayıtta yalnız
// kişinin görebildiği kolonlar gelir; gelmeyen kolon undefined kalır. Kayıt biçimi kaynağın kendi
// dosyasında yazılır (KR-014).

export type KayitSonucu<K> =
  | { readonly basarili: true; readonly kayit: K }
  | { readonly basarili: false; readonly hata: BackendHatasi };

// uuid olmayan kimlik backend yoluna konmaz; böyle bir kayıt olamayacağı için bulunamadı sayılır.
export async function kaydiGetir<K>(
  kaynak: 'rol' | 'grup' | 'yetenek',
  id: string,
  kayit: z.ZodType<K>,
): Promise<KayitSonucu<K>> {
  const kimlik = KayitKimligi.safeParse(id);
  if (!kimlik.success) {
    return {
      basarili: false,
      hata: { kod: 'bulunamadi', ileti: KAYIT_BULUNAMADI, ayrinti: null, durum: 404 },
    };
  }
  const sonuc = await backendIstegi({
    yol: `/kimlik/${kaynak}/${kimlik.data}`,
    yontem: 'GET',
    oturumlu: true,
  });
  if (!sonuc.basarili) {
    return sonuc;
  }
  return { basarili: true, kayit: kayit.parse(sonuc.govde) };
}
