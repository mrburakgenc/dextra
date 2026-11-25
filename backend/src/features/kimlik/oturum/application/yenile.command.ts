// Yenileme komutu: gövdedeki yenileme belirteci ve cihaz sırrı ile imzası doğrulanmış istemci
// başlıklarından gelen adres ve tarayıcı bilgisi.
export interface YenileKomutu {
  readonly yenilemeBelirteci: string;
  readonly cihazSirri: string;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
}

// Yenilemenin cevabı; cihaz sırrı döndürmede aynı kaldığı için ve oturum kimliği dönmez (AK-49).
export interface YenileCevabi {
  readonly erisimBelirteci: string;
  readonly yenilemeBelirteci: string;
}
