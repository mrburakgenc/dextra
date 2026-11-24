// Giriş ve çıkışın repository'si: oturum, oturum_sirri ve kullanici tablolarına yetki kapısından
// geçmeden erişir. Giriş ve çıkış çekirdek yollardır (TS-002 "Çekirdek yollar"; KR-010 Seçim 48'in
// adıyla istisnası).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { KapatilmaNedeni } from '../../_shared/cekirdek/oturum.repository.js';

export interface KisininDurumu {
  readonly pasif: boolean;
  readonly unutulmus: boolean;
  readonly sistemAktoru: boolean;
}

export interface YeniOturum {
  readonly id: string;
  readonly kullaniciId: string;
  readonly girisYontemi: string;
  readonly baslangicZamani: Date;
  readonly mutlakBitisZamani: Date;
  readonly sonDondurmeZamani: Date;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
}

export interface YeniOturumSirri {
  readonly nesil: number;
  readonly gecerliYenilemeOzeti: string;
  readonly cihazSirriOzeti: string;
}

export interface OturumRepo {
  // Kişinin durumu; kişi yoksa Prisma'nın "kayıt yok" hatası atılır.
  kisininDurumu(kullaniciId: string): Promise<KisininDurumu>;
  // Kişinin açık oturumlarının kimlikleri, en eskisi (başlangıç zamanı) önce. Açık oturum: kapatılmamış,
  // mutlak bitişi geçmemiş ve son döndürmesinden beri hareketsizlik sınırı dolmamış (TS-002).
  acikOturumlar(kullaniciId: string, simdi: Date): Promise<string[]>;
  // Verilen oturumlardan kapatılmamış olanları verilen nedenle kapatır ve kapananların kimliklerini döner.
  kapat(
    idler: readonly string[],
    neden: KapatilmaNedeni,
    kapatilmaZamani: Date,
  ): Promise<string[]>;
  // Oturumu ve sır satırını yazar.
  ekle(oturum: YeniOturum, sir: YeniOturumSirri): Promise<void>;
}

// Okuma görünümü boştur: giriş ve çıkış bu tablolara yalnız işlemin içinde erişir.
export const OTURUM_REPO = new RepoBelirteci<object, OturumRepo>('OturumRepo');
