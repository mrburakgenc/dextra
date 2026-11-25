// Çekirdek repository: parola_baglantisi tablosuna yetki kapısından geçmeden erişir (KR-010 Seçim 48'in
// adıyla istisnası). Tabloda kodun yalnız özeti durur (TS-002 değişmez 13).
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';

export interface BulunanBaglanti {
  id: string;
  kullaniciId: string;
  sonGecerlilikZamani: Date;
  kullanilmaZamani: Date | null;
}

export interface KullanilmamisBaglanti {
  id: string;
  sonGecerlilikZamani: Date;
  olusturanId: string | null;
  olusturmaZamani: Date;
}

export interface YeniBaglanti {
  id: string;
  kullaniciId: string;
  kodOzeti: string;
  sonGecerlilikZamani: Date;
  olusturanId: string | null;
}

export interface ParolaBaglantisiOkumaRepo {
  // Kod özeti verilen bağlantı; yoksa null.
  ozetIleBul(kodOzeti: string): Promise<BulunanBaglanti | null>;
}

export interface ParolaBaglantisiRepo extends ParolaBaglantisiOkumaRepo {
  // Kişinin kullanılmamış bağlantısı (kısmi tekil kısıt gereği en çok bir tane); yoksa null.
  kullanilmamisi(kullaniciId: string): Promise<KullanilmamisBaglanti | null>;
  sil(id: string): Promise<void>;
  // Oluşturma zamanını veritabanının varsayılanı verir.
  ekle(baglanti: YeniBaglanti): Promise<{ olusturmaZamani: Date }>;
  // Bağlantı kullanılmamış ve süresi geçmemişse kullanıldı diye işaretler. Koşullu güncelleme satırı
  // kilitler ve koşula kilit alındıktan sonra yeniden bakar: aynı kodla eşzamanlı ikinci istek
  // ilkinin işlemi bitince sıfır satır günceller. Güncellediyse true döner.
  kullan(id: string, kullanilmaZamani: Date): Promise<boolean>;
}

export const PAROLA_BAGLANTISI_REPO = new RepoBelirteci<
  ParolaBaglantisiOkumaRepo,
  ParolaBaglantisiRepo
>('ParolaBaglantisiRepo');

export function parolaBaglantisiRepo(
  istemci: RepoIstemcisi,
): ParolaBaglantisiRepo {
  return {
    ozetIleBul: (kodOzeti) =>
      istemci.parolaBaglantisi.findUnique({
        where: { kodOzeti },
        select: {
          id: true,
          kullaniciId: true,
          sonGecerlilikZamani: true,
          kullanilmaZamani: true,
        },
      }),
    kullanilmamisi: (kullaniciId) =>
      istemci.parolaBaglantisi.findFirst({
        where: { kullaniciId, kullanilmaZamani: null },
        select: {
          id: true,
          sonGecerlilikZamani: true,
          olusturanId: true,
          olusturmaZamani: true,
        },
      }),
    sil: async (id) => {
      await istemci.parolaBaglantisi.delete({
        where: { id },
        select: { id: true },
      });
    },
    ekle: (baglanti) =>
      istemci.parolaBaglantisi.create({
        data: baglanti,
        select: { olusturmaZamani: true },
      }),
    kullan: async (id, kullanilmaZamani) => {
      const { count } = await istemci.parolaBaglantisi.updateMany({
        where: {
          id,
          kullanilmaZamani: null,
          sonGecerlilikZamani: { gt: kullanilmaZamani },
        },
        data: { kullanilmaZamani },
      });
      return count === 1;
    },
  };
}
