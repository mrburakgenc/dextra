import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { yeniKimlik } from '../database/kimlik.js';

export const ISTEK_KIMLIGI_BASLIGI = 'x-istek-kimligi';

// Kimlik guard'ının doğruladığı oturum (TS-002 AK-12): kullanıcı ve oturum kimliği, kişinin yetki
// sayısı ve genel sayaç.
export interface IstekOturumu {
  readonly kullaniciId: string;
  readonly oturumId: string;
  readonly kisiSurumu: number;
  readonly genelSurum: number;
}

// İsteğin bağlamı (TS-002 AK-11). Oturum yalnız oturum gerektiren uçta, guard doğruladıktan sonra
// vardır. Uygulama kodu bağlamı yalnız okur; işlem nesnesi taşımaz (KR-011 Seçim 5).
export interface IstekBaglami {
  readonly istekKimligi: string;
  readonly oturum?: IstekOturumu;
}

// Depodaki nesne; oturum alanını yalnız istekOturumunuYaz doldurur, dışarıya IstekBaglami olarak verilir.
interface DepodakiBaglam {
  istekKimligi: string;
  oturum?: IstekOturumu;
}

const depo = new AsyncLocalStorage<DepodakiBaglam>();

// Bütün yollara bağlanan ara katman: isteğe kimlik verir, cevaba başlık olarak yazar ve isteğin
// geri kalanını bağlamın içinde koşturur.
export function istekBaglamiAraKatmani(
  _istek: IncomingMessage,
  cevap: ServerResponse,
  sonraki: () => void,
): void {
  const baglam: DepodakiBaglam = { istekKimligi: yeniKimlik() };
  cevap.setHeader(ISTEK_KIMLIGI_BASLIGI, baglam.istekKimligi);
  depo.run(baglam, sonraki);
}

// Koşan isteğin bağlamı; bir isteğin dışında (ör. arka plan döngüsünde) çağrılırsa hata verir.
export function istekBaglami(): IstekBaglami {
  return yazilabilirBaglam();
}

// Doğrulanan oturumu bağlama yazar; yalnız kimlik guard'ı çağırır.
export function istekOturumunuYaz(oturum: IstekOturumu): void {
  yazilabilirBaglam().oturum = oturum;
}

function yazilabilirBaglam(): DepodakiBaglam {
  const baglam = depo.getStore();
  if (baglam === undefined) {
    throw new Error('İstek bağlamı yok: çağrı bir isteğin içinde yapılmadı');
  }
  return baglam;
}
