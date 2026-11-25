// Giriş komutu: yöntem, yöntemin girdisi ve imzası doğrulanmış istemci başlıklarından gelen adres ile
// tarayıcı bilgisi. Girdinin şeması yöntemindir (parola ile girişte parola alt özelliğinin komutu).
import type { GirisYontemi } from '../../../../../../shared/kimlik/application/i-giris-yontemi.port.js';

export interface GirisKomutu<TGirdi> {
  readonly yontem: GirisYontemi<TGirdi>;
  readonly girdi: TGirdi;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
}
