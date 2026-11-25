// Parola alt özelliğinin repository arayüzleri ve belirteci: kullanici, kullanici_sirri ve oturum
// tablolarına yetki kapısından geçmeden erişir. Bağlantıyla parola belirleme, parola değiştirme ve
// kurulum komutu çekirdek yollardır (TS-002 "Çekirdek yollar"; KR-010 Seçim 48'in adıyla istisnası);
// gerçeklemesi infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';

export interface IParolaOkumaRepo {
  // Kullanıcı adı verilen kişinin kimliği; yoksa null.
  kullaniciAdiylaBul(kullaniciAdi: string): Promise<string | null>;
  // Çekirdek yolların notlarında yazan olarak geçen, kimlik feature'ının sistem aktörünün kimliği
  // (TS-002 AK-2); hiç ya da birden çok satır varsa hata atılır.
  kimlikSistemAktoru(): Promise<string>;
  // Girişin okuduğu sır: kullanıcı adı verilen kişinin kimliği, parola özeti ve sırrın güncelleme
  // zamanı. Kişi yoksa ya da parolası belirlenmemişse null.
  girisSirri(kullaniciAdi: string): Promise<GirisSirri | null>;
  // Kimliği verilen kişinin parola özeti ve sırrın güncelleme zamanı; parolası yoksa null.
  kisininSirri(
    kullaniciId: string,
  ): Promise<Omit<GirisSirri, 'kullaniciId'> | null>;
}

export interface GirisSirri {
  readonly kullaniciId: string;
  readonly parolaOzeti: string;
  readonly guncellemeZamani: Date;
}

export interface IParolaRepo extends IParolaOkumaRepo {
  // Kişinin sır satırının güncelleme zamanı; satır yoksa null.
  sirZamani(kullaniciId: string): Promise<Date | null>;
  // Kişinin parola özetini yazar (satır yoksa ekler) ve güncelleme zamanını verilen değer yapar.
  sirYaz(
    kullaniciId: string,
    parolaOzeti: string,
    guncellemeZamani: Date,
  ): Promise<void>;
  // Oturum verilen kişinindir ve kapatılmamıştır.
  oturumAcikMi(oturumId: string, kullaniciId: string): Promise<boolean>;
}

export const PAROLA_REPO = new RepoBelirteci<IParolaOkumaRepo, IParolaRepo>(
  'IParolaRepo',
);
