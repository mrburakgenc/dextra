// Yenileme işinin sonucu; cihaz sırrı döndürmede aynı kaldığı için ve oturum kimliği dönmez (AK-49).
export interface YenileSonucu {
  readonly erisimBelirteci: string;
  readonly yenilemeBelirteci: string;
}
