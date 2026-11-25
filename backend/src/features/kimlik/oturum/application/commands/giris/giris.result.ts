// Giriş işinin sonucu. Cihaz sırrı ve yenileme belirteci yalnız burada düz hâliyle bulunur; tabloda
// yalnız özetleri durur.
export interface GirisSonucu {
  readonly erisimBelirteci: string;
  readonly yenilemeBelirteci: string;
  readonly cihazSirri: string;
  readonly oturumId: string;
}
