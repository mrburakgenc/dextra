// Bağlantıyla parola belirleme komutu: bağlantı kodu ve kurala uyan yeni parola.
export interface ParolaBelirleKomutu {
  readonly kod: string;
  readonly parola: string;
}
