import 'server-only';
import { z } from 'zod';
import type { BackendHatasi } from '../../../shared/backend/hata';
import { type ListeSonucu, listeyiGetir } from '../../../shared/liste/liste-istegi';
import { BOS } from '../../../shared/liste/liste-parcalari';
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
export const GrupKaydi = z.object({
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

// Üst grup seçimi (oluştur ve taşı) listenin ilk 100 kaydından kurulur; 100 backend'in sayfa
// boyutu sınırıdır. Adı gelmeyen grup boş işaretle görünür.
export interface UstGrupSecenekleri {
  readonly gruplar: readonly { readonly id: string; readonly etiket: string }[];
  readonly dahaFazlasiVar: boolean;
}

export type UstGrupSecenekleriSonucu =
  | { readonly basarili: true; readonly secenekler: UstGrupSecenekleri }
  | { readonly basarili: false; readonly hata: BackendHatasi };

export async function ustGrupSecenekleri(): Promise<UstGrupSecenekleriSonucu> {
  const sonuc = await listeyiGetir('/kimlik/grup', { sayfa: 1, boyut: 100 }, GrupKaydi);
  if (!sonuc.basarili) {
    return sonuc;
  }
  return {
    basarili: true,
    secenekler: {
      gruplar: sonuc.liste.kayitlar.map((kayit) => ({
        id: kayit.id,
        etiket: kayit.ad ?? BOS,
      })),
      dahaFazlasiVar: sonuc.liste.sonrakiVar,
    },
  };
}
