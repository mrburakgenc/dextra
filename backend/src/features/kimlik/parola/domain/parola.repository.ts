// Parola alt özelliğinin repository'si: kullanici ve kullanici_sirri tablolarına yetki kapısından
// geçmeden erişir. Bağlantıyla parola belirleme ve kurulum komutu çekirdek yollardır (TS-002
// "Çekirdek yollar"; KR-010 Seçim 48'in adıyla istisnası).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';

export interface ParolaOkumaRepo {
  // Kullanıcı adı verilen kişinin kimliği; yoksa null.
  kullaniciAdiylaBul(kullaniciAdi: string): Promise<string | null>;
  // Çekirdek yolların notlarında yazan olarak geçen, kimlik feature'ının sistem aktörünün kimliği
  // (TS-002 AK-2); yoksa Prisma'nın "kayıt yok" hatası atılır.
  kimlikSistemAktoru(): Promise<string>;
  // Girişin okuduğu sır: kullanıcı adı verilen kişinin kimliği, parola özeti ve sırrın güncelleme
  // zamanı. Kişi yoksa ya da parolası belirlenmemişse null.
  girisSirri(kullaniciAdi: string): Promise<GirisSirri | null>;
}

export interface GirisSirri {
  readonly kullaniciId: string;
  readonly parolaOzeti: string;
  readonly guncellemeZamani: Date;
}

export interface ParolaRepo extends ParolaOkumaRepo {
  // Kişinin sır satırının güncelleme zamanı; satır yoksa null.
  sirZamani(kullaniciId: string): Promise<Date | null>;
  // Kişinin parola özetini yazar (satır yoksa ekler) ve güncelleme zamanını verilen değer yapar.
  sirYaz(
    kullaniciId: string,
    parolaOzeti: string,
    guncellemeZamani: Date,
  ): Promise<void>;
}

export const PAROLA_REPO = new RepoBelirteci<ParolaOkumaRepo, ParolaRepo>(
  'ParolaRepo',
);
