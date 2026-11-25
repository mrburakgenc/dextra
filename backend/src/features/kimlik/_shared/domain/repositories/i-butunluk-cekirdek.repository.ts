// Çekirdek repository: bütünlük sorularının okumalarını yetki kapısından geçmeden yapar (KR-010
// Seçim 48'in adıyla istisnası; TS-002 "Yapı", "bütünlük sorusu"). Her metot yalnız evet ya da hayır
// döner, satır vermez; istisnası iki künyedir (TS-002 AK-43), onlar satırın yalnız sayılan alanlarını
// verir. Yalnız kimlik/_shared içindeki bütünlük sorusu parçası kullanır. Gerçeklemesi
// infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';

export interface ButunlukCekirdekRepo {
  kokSuperAdminUyesiMi(kullaniciId: string): Promise<boolean>;
  // Girebilen canlı (Kök, SuperAdmin) üyelerinin kümesi tam olarak bu kişi mi.
  sonGirebilenKokSuperAdminMi(kullaniciId: string): Promise<boolean>;
  grupCanliMi(grupId: string): Promise<boolean>;
  rolCanliMi(rolId: string): Promise<boolean>;
  kokSuperAdminKumesiMi(grupId: string, rolId: string): Promise<boolean>;
  // Canlı alt grubu, canlı üyeliği ve canlı yeteneği yok mu.
  grupBosMu(grupId: string): Promise<boolean>;
  // Canlı üyeliği ve canlı yeteneği yok mu.
  rolBosMu(rolId: string): Promise<boolean>;
  // Yeni üst, taşınan grubun kendisi ya da altındakilerden biri mi: yeni üstten köke doğru yürünür.
  tasimaDonguYaparMi(grupId: string, yeniUstGrupId: string): Promise<boolean>;
  // TS-002 AK-43 ekleri. Kayıt yoksa hayır döner.
  rolSistemRoluMu(rolId: string): Promise<boolean>;
  grupKokMu(grupId: string): Promise<boolean>;
  kisiPasifMi(kullaniciId: string): Promise<boolean>;
  kisiUnutulmusMu(kullaniciId: string): Promise<boolean>;
  kisiSistemAktoruMu(kullaniciId: string): Promise<boolean>;
  kullaniciAdiDoluMu(kullaniciId: string): Promise<boolean>;
  izinKatalogdaMi(izinId: string): Promise<boolean>;
  // Künyeler (TS-002 AK-43); kayıt yoksa undefined.
  uyelikKunyesi(uyelikId: string): Promise<UyelikKunyesi | undefined>;
  izinKunyesi(izinId: string): Promise<IzinKunyesi | undefined>;
}

export interface UyelikKunyesi {
  kullaniciId: string;
  grupId: string;
  rolId: string;
  // Silinme zamanı boş mu.
  canli: boolean;
}

export interface IzinKunyesi {
  kaynak: string;
  eylem: string;
}

// Okuma görünümü boştur: sorular çağıranın işleminde sorulur.
export const BUTUNLUK_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  ButunlukCekirdekRepo
>('ButunlukCekirdekRepo');
