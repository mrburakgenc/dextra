// Dışarıya dönen hata kodları ve HTTP durumları (TS-002 AK-11). Cevap gövdesi her zaman
// { kod, ileti, ayrinti } biçimindedir; çeviriyi yalnız HataSuzgeci yapar.
export const HATA_DURUMLARI = {
  dogrulama_hatasi: 400,
  kimlik_gerekli: 401,
  yetki_yok: 403,
  bulunamadi: 404,
  cakisma: 409,
  beklenmeyen_hata: 500,
  yeniden_dene: 503,
} as const;

export type HataKodu = keyof typeof HATA_DURUMLARI;

// Uygulama kodu dışarıya dönecek hatayı bununla atar; ileti ve ayrıntı istemciye olduğu gibi gider.
export class KodluHata extends Error {
  override readonly name = 'KodluHata';

  constructor(
    readonly kod: HataKodu,
    ileti: string,
    readonly ayrinti?: unknown,
  ) {
    super(ileti);
  }
}
