// Kullanıcı aç işinin sonucu (TS-002 AK-39): kimlik ve bir kez gösterilen parola belirleme kodu (uç 201
// ile döner).
export interface KullaniciAcSonucu {
  readonly id: string;
  readonly parolaBaglantisiKodu: string;
}
