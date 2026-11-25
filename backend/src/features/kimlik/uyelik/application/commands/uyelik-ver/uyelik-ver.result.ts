// Üyelik ver işinin sonucu: yeni üyeliğin kimliği (uç 201 ile döner). Kod yalnız SuperAdmin üyeliği
// verilen ve kullanıcı adı dolu kişide döner.
export interface UyelikVerSonucu {
  readonly id: string;
  readonly parolaBaglantisiKodu?: string;
}
