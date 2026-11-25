import type { KapatilmaNedeni } from '../../_shared/cekirdek/oturum.repository.js';
import { HAREKETSIZLIK_SINIRI_MS } from './oturum-denetimi.js';
import type { YenilemeSatiri } from './oturum.repository.js';

// Hoşgörü penceresi (TS-002 AK-49 madde 2; KR-009 Kural 3): bir önceki neslin belirteci son
// döndürmeden sonra bu süre içinde gelirse yeniden kullanım sayılmaz. Ölçülünce değişir.
export const HOSGORU_PENCERESI_MS = 10_000;

// Yenilemeye gelen belirtecin nesli ve özeti, isteğin adresi, tarayıcı bilgisi ve cihaz sırrının özeti.
export interface YenilemeIstegi {
  readonly nesil: number;
  readonly belirtecOzeti: string;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
  readonly cihazSirriOzeti: string;
}

export type YenilemeKarari =
  // Hiçbir satıra dokunulmadan reddedilir; kapalı oturuma eski nesil geldiyse güvenlik olayı yazılır.
  | { readonly tur: 'reddet'; readonly eskiNesil: boolean }
  // Yalnız bu oturum kapatılır ve reddedilir.
  | {
      readonly tur: 'kapat';
      readonly neden: Extract<
        KapatilmaNedeni,
        'tutarsiz_nesil' | 'sure' | 'adres_degisti' | 'cihaz_uymadi'
      >;
    }
  // Kişinin bütün oturumları yeniden_kullanim nedeniyle kapatılır ve reddedilir.
  | { readonly tur: 'yeniden_kullanim' }
  // Geçerli nesil: döndürülür. Pencere içinde bir önceki nesil: döndürülmez, geçerli neslin
  // belirteci yeniden imzalanır. İkisi de satırdaki sırrı ve son döndürme zamanını taşır.
  | {
      readonly tur: 'dondur' | 'pencere';
      readonly sir: NonNullable<YenilemeSatiri['sir']>;
      readonly sonDondurmeZamani: Date;
    };

// Yenileme sırasının 2–5. adımları (TS-002 "İşlem sınırları" Yenile; KR-009 Kural 11; AK-49). Satır
// kişi ve oturum kilidi altında okunmuştur. Giriş yöntemi adımı bugün yoktur (AK-49 madde 5).
export function yenilemeKarari(
  satir: YenilemeSatiri | null,
  istek: YenilemeIstegi,
  simdi: number,
): YenilemeKarari {
  if (satir === null) {
    return { tur: 'reddet', eskiNesil: false };
  }
  const { sir } = satir;
  // Kapalı oturumda toplu kapatma yapılmaz (KR-009 Kural 7; AK-49 madde 4).
  if (satir.kapali) {
    return {
      tur: 'reddet',
      eskiNesil: sir !== null && istek.nesil < sir.nesil,
    };
  }
  if (sir === null) {
    return { tur: 'reddet', eskiNesil: false };
  }
  if (
    istek.nesil > sir.nesil ||
    (istek.nesil === sir.nesil &&
      istek.belirtecOzeti !== sir.gecerliYenilemeOzeti)
  ) {
    return { tur: 'kapat', neden: 'tutarsiz_nesil' };
  }
  const pencere = istek.nesil < sir.nesil;
  // Yeniden kullanım kararı cihaz sırrına bakmaz; kaç nesil eski olursa olsun eski belirteç
  // pencere dışında hırsızlık işaretidir (KR-009 Seçim 2 ve 12).
  if (
    pencere &&
    !(
      istek.nesil === sir.nesil - 1 &&
      istek.belirtecOzeti === sir.oncekiYenilemeOzeti &&
      simdi < satir.sonDondurmeZamani.getTime() + HOSGORU_PENCERESI_MS
    )
  ) {
    return { tur: 'yeniden_kullanim' };
  }
  // Süre, adres ve cihaz sırrı pencere içi dalda da aranır.
  if (
    satir.mutlakBitisZamani.getTime() <= simdi ||
    satir.sonDondurmeZamani.getTime() + HAREKETSIZLIK_SINIRI_MS <= simdi
  ) {
    return { tur: 'kapat', neden: 'sure' };
  }
  if (
    satir.ipAdresi !== istek.ipAdresi ||
    satir.tarayiciBilgisi !== istek.tarayiciBilgisi
  ) {
    return { tur: 'kapat', neden: 'adres_degisti' };
  }
  if (sir.cihazSirriOzeti !== istek.cihazSirriOzeti) {
    return { tur: 'kapat', neden: 'cihaz_uymadi' };
  }
  return {
    tur: pencere ? 'pencere' : 'dondur',
    sir,
    sonDondurmeZamani: satir.sonDondurmeZamani,
  };
}
