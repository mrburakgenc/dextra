// Çekirdek repository: kullanici tablosuna yetki kapısından geçmeden erişir (KR-010 Seçim 48'in
// adıyla istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır.
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';

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
}

export const KULLANICI_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  KullaniciCekirdekRepo
>('KullaniciCekirdekRepo');

export function kullaniciCekirdekRepo(
  istemci: RepoIstemcisi,
): KullaniciCekirdekRepo {
  return {
    kilitle: async (id) => {
      await istemci.kullanici.update({
        where: { id },
        data: { yetkiSurumu: { increment: 0 } },
        select: { id: true },
      });
    },
    surumuArtir: async (id) => {
      const satir = await istemci.kullanici.update({
        where: { id },
        data: { yetkiSurumu: { increment: 1 } },
        select: { yetkiSurumu: true },
      });
      return satir.yetkiSurumu;
    },
    ekle: (kullanici) =>
      istemci.kullanici.create({
        data: kullanici,
        select: { yetkiSurumu: true, olusturmaZamani: true },
      }),
  };
}
