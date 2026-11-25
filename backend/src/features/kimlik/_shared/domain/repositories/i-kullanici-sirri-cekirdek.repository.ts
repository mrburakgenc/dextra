// Çekirdek repository: kullanici_sirri tablosuna yetki kapısından geçmeden erişir (KR-010 Seçim 48'in
// adıyla istisnası). Parola özetini hiçbir metot dışarı vermez. Yalnız kimlik/_shared içindeki
// "parola sırrı" parçası kullanır. Gerçeklemesi infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';

export interface KullaniciSirriCekirdekRepo {
  // Kişinin sır satırının güncelleme zamanı; satır yoksa null.
  guncellemeZamani(kullaniciId: string): Promise<Date | null>;
  sil(kullaniciId: string): Promise<void>;
}

// Okuma görünümü boştur: parça çağıranın işleminde çalışır.
export const KULLANICI_SIRRI_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  KullaniciSirriCekirdekRepo
>('KullaniciSirriCekirdekRepo');
