// Parola değiştirme komutu: isteği yapan kişi ve oturumu (istek bağlamından), eski ve yeni parola.
export interface ParolaDegistirKomutu {
  readonly kullaniciId: string;
  readonly oturumId: string;
  readonly eskiParola: string;
  readonly yeniParola: string;
}
