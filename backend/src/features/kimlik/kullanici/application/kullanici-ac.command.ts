import type { YeniKullanici } from '../domain/kullanici.repository.js';

// Kullanıcı aç komutu: kullanıcı adı küçük harfli, görünen ad baştaki ve sondaki boşluğu atılmış
// hâliyle gelir (doğrulamayı ucun şeması yapar).
export type KullaniciAcKomutu = YeniKullanici;

// Oluşturma cevabı (TS-002 AK-39): kimlik ve bir kez gösterilen parola belirleme kodu.
export interface AcilanKullanici {
  readonly id: string;
  readonly parolaBaglantisiKodu: string;
}
