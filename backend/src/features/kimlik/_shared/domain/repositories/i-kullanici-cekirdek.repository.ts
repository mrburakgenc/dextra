// Çekirdek repository: kullanici tablosuna yetki kapısından geçmeden erişir (KR-010 Seçim 48'in
// adıyla istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır. Gerçeklemesi
// infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';

export interface YeniKullanici {
  id: string;
  kullaniciAdi: string | null;
  telefon: string | null;
  gorunenAd: string;
  sistemAktoru: boolean;
}

export interface KullaniciCekirdekRepo {
  // Kişinin satırını anahtar dışı güncelleme kilidiyle kilitler (değer değiştirmeyen güncelleme).
  // Kişi yoksa Prisma'nın "kayıt yok" hatası atılır.
  kilitle(id: string): Promise<void>;
  // Kişinin yetki sayısını bir artırır ve yeni değeri döner; satırı aynı kiple kilitler.
  surumuArtir(id: string): Promise<number>;
  // Kullanıcıyı yazar; oluşturma zamanını ve sayıyı veritabanının varsayılanı verir.
  ekle(
    kullanici: YeniKullanici,
  ): Promise<{ yetkiSurumu: number; olusturmaZamani: Date }>;
  // Verilen görünen adla bir sistem aktörü var mı.
  sistemAktoruVarMi(gorunenAd: string): Promise<boolean>;
}

export const KULLANICI_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  KullaniciCekirdekRepo
>('KullaniciCekirdekRepo');
