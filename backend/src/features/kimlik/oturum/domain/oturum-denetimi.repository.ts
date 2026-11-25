// Oturum denetiminin repository'si: oturum, kullanici ve yetki_surumu tablolarına yetki kapısından
// geçmeden erişir. Oturum denetimi bir çekirdek yoldur (TS-002 "Çekirdek yollar"; KR-010 Seçim 48'in
// adıyla istisnası).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';

// Her istekte okunan satır: oturum, kişinin durumu ve sayısı ile genel sayaç, aynı anda.
export interface DenetimSatiri {
  readonly kullaniciId: string;
  readonly mutlakBitisZamani: Date;
  readonly sonDondurmeZamani: Date;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
  readonly kapali: boolean;
  readonly kullaniciPasif: boolean;
  readonly sistemAktoru: boolean;
  readonly kisiSurumu: number;
  readonly genelSurum: number;
}

export interface OturumDenetimiOkumaRepo {
  // Tek deyimle okunur (KR-010 Seçim 49). Oturum ya da genel sayaç satırı yoksa null.
  oku(oturumId: string): Promise<DenetimSatiri | null>;
  // Kimlik feature'ının sistem aktörü (TS-002 AK-2); hiç ya da birden çok satır varsa hata atılır.
  kimlikSistemAktoru(): Promise<string>;
}

export interface OturumDenetimiRepo extends OturumDenetimiOkumaRepo {
  // Oturum kapatılmamışsa adres_degisti nedeniyle kapatır; kapattıysa true döner.
  adresleKapat(oturumId: string, kapatilmaZamani: Date): Promise<boolean>;
}

export const OTURUM_DENETIMI_REPO = new RepoBelirteci<
  OturumDenetimiOkumaRepo,
  OturumDenetimiRepo
>('OturumDenetimiRepo');
