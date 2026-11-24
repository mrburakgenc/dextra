import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { yeniKimlik } from '../database/kimlik.js';

export const ISTEK_KIMLIGI_BASLIGI = 'x-istek-kimligi';

// İsteğin bağlamı (TS-002 AK-11). Kimlik denetimi kurulunca kullanıcı ve oturum alanları buraya
// eklenir. Uygulama kodu bağlamı yalnız okur; işlem nesnesi taşımaz (KR-011 Seçim 5).
export interface IstekBaglami {
  readonly istekKimligi: string;
}

const depo = new AsyncLocalStorage<IstekBaglami>();

// Bütün yollara bağlanan ara katman: isteğe kimlik verir, cevaba başlık olarak yazar ve isteğin
// geri kalanını bağlamın içinde koşturur.
export function istekBaglamiAraKatmani(
  _istek: IncomingMessage,
  cevap: ServerResponse,
  sonraki: () => void,
): void {
  const baglam: IstekBaglami = { istekKimligi: yeniKimlik() };
  cevap.setHeader(ISTEK_KIMLIGI_BASLIGI, baglam.istekKimligi);
  depo.run(baglam, sonraki);
}

// Koşan isteğin bağlamı; bir isteğin dışında (ör. arka plan döngüsünde) çağrılırsa hata verir.
export function istekBaglami(): IstekBaglami {
  const baglam = depo.getStore();
  if (baglam === undefined) {
    throw new Error('İstek bağlamı yok: çağrı bir isteğin içinde yapılmadı');
  }
  return baglam;
}
