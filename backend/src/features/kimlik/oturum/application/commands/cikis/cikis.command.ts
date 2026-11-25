// Çıkış komutu: kimlik guard'ının doğruladığı oturum ve sahibi; istek gövdesinden okunmaz.
export interface CikisKomutu {
  readonly kullaniciId: string;
  readonly oturumId: string;
}
