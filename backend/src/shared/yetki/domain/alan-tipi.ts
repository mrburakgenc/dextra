// Şart dilinin alan tipleri (TS-002 AK-44). "obur" (JSON, dizi) şartta kullanılamaz.
export type AlanTipi =
  | 'metin'
  | 'sayi'
  | 'mantiksal'
  | 'kimlik'
  | 'zaman'
  | 'obur';
