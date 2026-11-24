import type { GirisYontemi } from '../../../../shared/kimlik/giris-yontemi.contract.js';

// Giriş komutu: yöntem, yöntemin girdisi ve imzası doğrulanmış istemci başlıklarından gelen adres ile
// tarayıcı bilgisi.
export interface GirisKomutu<TGirdi> {
  readonly yontem: GirisYontemi<TGirdi>;
  readonly girdi: TGirdi;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
}

// Girişin cevabı. Cihaz sırrı ve yenileme belirteci yalnız burada düz hâliyle bulunur; tabloda
// yalnız özetleri durur.
export interface GirisCevabi {
  readonly erisimBelirteci: string;
  readonly yenilemeBelirteci: string;
  readonly cihazSirri: string;
  readonly oturumId: string;
}
