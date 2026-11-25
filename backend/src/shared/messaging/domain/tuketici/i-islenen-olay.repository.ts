import { RepoBelirteci } from '../../../database/domain/repo-belirteci.js';

// Sahiplenme denemesinin sonucu: satır bu çağrıyla alındı, olay daha önce tamamlandı ya da
// başka bir işçi şu an sahipleniyor.
export type SahiplenmeSonucu = 'sahiplenildi' | 'tamamlandi' | 'isleniyor';

export interface IslenenOlayRepo {
  // Satır yoksa 'isleniyor' olarak ekler; varsa ve sahiplenmesi süresi dolmuş 'isleniyor' ise
  // bitişi yenileyip devralır. Karar tek ifadede verilir: aynı anda iki çağrıdan yalnız biri alır.
  // Alınan satıra verilen sahip kimliği yazılır; çağıran her sahiplenmede yeni kimlik verir.
  sahiplen(
    tuketici: string,
    olayId: string,
    sahipId: string,
    sureSn: number,
  ): Promise<SahiplenmeSonucu>;
  // Tamamlama ve bırakma yalnız bu sahip kimliğini taşıyan satıra dokunur: sahiplenmesi
  // devralınmış işçi devralanın satırını tamamlayamaz ve silemez.
  tamamla(tuketici: string, olayId: string, sahipId: string): Promise<void>;
  // Yalnız 'isleniyor' satırı siler; devralan başka işçinin tamamladığı kayda dokunmaz.
  birak(tuketici: string, olayId: string, sahipId: string): Promise<void>;
}

// islenen_olay yalnız run içinde kullanılır; işlem dışı okuma görünümü boştur (unknown).
export const ISLENEN_OLAY_REPO = new RepoBelirteci<unknown, IslenenOlayRepo>(
  'IslenenOlayRepo',
);
