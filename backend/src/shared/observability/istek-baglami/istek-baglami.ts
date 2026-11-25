import { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { yeniKimlik } from '../../database/domain/kimlik.js';
import type { DerlemeSonucu } from '../../yetki/application/yetenek-derleyici.js';

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
// vardır; oturumun derlenmiş yetkisi yetki guard'ından sonra vardır (AK-18). Uygulama kodu bağlamı
// yalnız okur; işlem nesnesi taşımaz (KR-011 Seçim 5).
export interface IstekBaglami {
  readonly istekKimligi: string;
  readonly oturum?: IstekOturumu;
  readonly yetki?: DerlemeSonucu;
  // Yazma işareti (TS-002 AK-40): bu istekte Unit of Work'ün run kapısı çağrıldıysa doğrudur; işlem
  // sonradan geri alınsa da doğru kalır. Yalnız Unit of Work yazar; erişim kaydı salt okuma isteğini
  // bununla tanır (KR-013 Seçim 6).
  readonly yazmaAcildi: boolean;
}

// Depodaki nesne; oturum alanını yalnız istekOturumunuYaz, yetki alanını yalnız istekYetkisiniYaz,
// yazma işaretini yalnız istekteYazmaAcildi doldurur, dışarıya IstekBaglami olarak verilir.
interface DepodakiBaglam {
  istekKimligi: string;
  oturum?: IstekOturumu;
  yetki?: DerlemeSonucu;
  yazmaAcildi: boolean;
}

const depo = new AsyncLocalStorage<DepodakiBaglam>();

// Bütün yollara bağlanan ara katman: isteğe kimlik verir, cevaba başlık olarak yazar ve isteğin
// geri kalanını bağlamın içinde koşturur.
export function istekBaglamiAraKatmani(
  _istek: IncomingMessage,
  cevap: ServerResponse,
  sonraki: () => void,
): void {
  const baglam: DepodakiBaglam = {
    istekKimligi: yeniKimlik(),
    yazmaAcildi: false,
  };
  cevap.setHeader(ISTEK_KIMLIGI_BASLIGI, baglam.istekKimligi);
  depo.run(baglam, sonraki);
}

// Koşan isteğin bağlamı; bir isteğin dışında (ör. arka plan döngüsünde) çağrılırsa hata verir.
export function istekBaglami(): IstekBaglami {
  return yazilabilirBaglam();
}

// Koşan isteğin bağlamı; bir isteğin dışında çağrılırsa hata vermez, tanımsız döner.
export function varsaIstekBaglami(): IstekBaglami | undefined {
  return depo.getStore();
}

// Yazma işaretini koyar; yalnız Unit of Work'ün run kapısı çağırır. İstek dışında (arka plan döngüsü,
// komut, tohum) hiçbir şey yapmaz.
export function istekteYazmaAcildi(): void {
  const baglam = depo.getStore();
  if (baglam !== undefined) {
    baglam.yazmaAcildi = true;
  }
}

// Doğrulanan oturumu bağlama yazar; yalnız kimlik guard'ı çağırır.
export function istekOturumunuYaz(oturum: IstekOturumu): void {
  yazilabilirBaglam().oturum = oturum;
}

// Oturumun derlenmiş yetkisini bağlama yazar; yalnız yetki guard'ı çağırır.
export function istekYetkisiniYaz(yetki: DerlemeSonucu): void {
  yazilabilirBaglam().yetki = yetki;
}

function yazilabilirBaglam(): DepodakiBaglam {
  const baglam = depo.getStore();
  if (baglam === undefined) {
    throw new Error('İstek bağlamı yok: çağrı bir isteğin içinde yapılmadı');
  }
  return baglam;
}
