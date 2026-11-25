// Giriş, çıkış ve yenilemenin repository'si: oturum, oturum_sirri ve kullanici tablolarına yetki
// kapısından geçmeden erişir. Giriş, çıkış ve yenileme çekirdek yollardır (TS-002 "Çekirdek yollar"; KR-010 Seçim 48'in
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

// Yenilemede kilit altında okunan oturum ve sır satırı.
export interface YenilemeSatiri {
  readonly mutlakBitisZamani: Date;
  readonly sonDondurmeZamani: Date;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
  readonly kapali: boolean;
  // Sır satırı yoksa null.
  readonly sir: {
    readonly nesil: number;
    readonly gecerliYenilemeOzeti: string;
    readonly oncekiYenilemeOzeti: string | null;
    readonly cihazSirriOzeti: string;
  } | null;
}

export interface Dondurme {
  readonly nesil: number;
  readonly gecerliYenilemeOzeti: string;
  readonly oncekiYenilemeOzeti: string;
  readonly sonDondurmeZamani: Date;
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
  // Kişinin oturumunu anahtar dışı güncelleme kilidiyle kilitler (değer değiştirmeyen güncelleme) ve
  // sır satırıyla birlikte kilit altında okur. Oturum yoksa ya da kişinin değilse null.
  kilitleVeOku(
    oturumId: string,
    kullaniciId: string,
  ): Promise<YenilemeSatiri | null>;
  // Kişinin kapatılmamış bütün oturumlarının kimlikleri.
  kapatilmamislar(kullaniciId: string): Promise<string[]>;
  // Döndürme: oturumun son döndürme zamanını ve sır satırının nesil ve özetlerini yazar.
  dondur(oturumId: string, dondurme: Dondurme): Promise<void>;
  // Kimlik feature'ının sistem aktörü (TS-002 AK-2, AK-35); hiç ya da birden çok satır varsa hata atılır.
  kimlikSistemAktoru(): Promise<string>;
}

// Okuma görünümü boştur: giriş, çıkış ve yenileme bu tablolara yalnız işlemin içinde erişir.
export const OTURUM_REPO = new RepoBelirteci<object, OturumRepo>('OturumRepo');
