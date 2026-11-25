// Çekirdek repository: genel sayaç satırına yetki kapısından geçmeden erişir (KR-010 Seçim 48'in
// adıyla istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır. Gerçeklemesi
// infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';

export interface YetkiSurumuCekirdekRepo {
  // Satırı anahtar dışı güncelleme kilidiyle (FOR NO KEY UPDATE) kilitler: anahtara dokunmayan bir
  // güncelleme bu kilidi alır (GV-003 ölçümü). Satır yoksa Prisma'nın "kayıt yok" hatası atılır.
  kilitle(artir: boolean): Promise<void>;
}

// Okuma görünümü boştur: genel sayacı işlem dışında okuyan çekirdek kodu bu görevde yoktur.
export const YETKI_SURUMU_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  YetkiSurumuCekirdekRepo
>('YetkiSurumuCekirdekRepo');
