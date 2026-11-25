// Kullanıcı varlığı: yeni kullanıcının yazılacak hâli ve kişinin durum kararları (TS-005
// "Sorumluluklar"). Varlık veritabanından doldurulmaz; kararlar işleyicinin kapıdan sonra, satır
// kilitliyken bütünlük sorusuyla topladığı olguları alır. Retler bugünkü denetim sırasıyla döner.
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';
import type { GorunenAd } from '../value-objects/gorunen-ad.js';
import type { KullaniciAdi } from '../value-objects/kullanici-adi.js';

export interface YeniKullanici {
  readonly kullaniciAdi: KullaniciAdi;
  readonly gorunenAd: GorunenAd;
}

// Alanlar değer nesnesinden geldiği için kuraldan geçmemiş bir adla kullanıcı üretilemez (TS-005
// Değişmez 3). Telefon ve sistem aktörü işareti yazılacak hâlde yoktur.
export function kullaniciOlustur(
  kullaniciAdi: KullaniciAdi,
  gorunenAd: GorunenAd,
): YeniKullanici {
  return { kullaniciAdi, gorunenAd };
}

export interface SuperAdminKorumasiOlgulari {
  // Hedef kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyor mu.
  readonly hedefKokSuperAdminMi: boolean;
  // İsteyen kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyor mu.
  readonly isteyenKokSuperAdminMi: boolean;
}

// SuperAdmin koruması (KR-008 Seçim 47): SuperAdmin hedefine yalnız SuperAdmin dokunur.
function superAdminKorumasinaTakilirMi(
  olgular: SuperAdminKorumasiOlgulari,
): boolean {
  return olgular.hedefKokSuperAdminMi && !olgular.isteyenKokSuperAdminMi;
}

export interface KullaniciGuncellemeOlgulari {
  readonly sistemAktoruMu: boolean;
  readonly unutulmusMu: boolean;
}

export type KullaniciGuncellemeReddi = 'sistem_aktoru' | 'unutulmus';

// Sistem aktörünün ve unutulmuş kişinin görünen adı değişmez (TS-002 değişmez 16 ve AK-47): çekirdek
// yollar sistem aktörünü görünen adıyla bulur; unutulmuş kişinin görünen adı kişiye geri götürmeyen
// sabit değerdir (KR-012).
export function kullaniciGuncellemeKarari(
  olgular: KullaniciGuncellemeOlgulari,
): Sonuc<void, KullaniciGuncellemeReddi> {
  if (olgular.sistemAktoruMu) {
    return ret('sistem_aktoru');
  }
  if (olgular.unutulmusMu) {
    return ret('unutulmus');
  }
  return tamam();
}

export interface KullaniciPasifeAlmaOlgulari extends SuperAdminKorumasiOlgulari {
  readonly sistemAktoruMu: boolean;
  readonly pasifMi: boolean;
  // Kişi girebilen son (Kök, SuperAdmin) üyesi mi.
  readonly sonGirebilenKokSuperAdminMi: boolean;
}

export type KullaniciPasifeAlmaReddi =
  | 'superadmin_korumasi'
  | 'sistem_aktoru'
  | 'pasif'
  | 'son_girebilen_superadmin';

// Önce SuperAdmin koruması; sonra sistem aktörü ve zaten pasif kişi pasife alınmaz; sonra girebilen
// son SuperAdmin pasife alınmaz (TS-002 "İşlem sınırları"; KR-008 Seçim 43 ve 47).
export function kullaniciPasifeAlmaKarari(
  olgular: KullaniciPasifeAlmaOlgulari,
): Sonuc<void, KullaniciPasifeAlmaReddi> {
  if (superAdminKorumasinaTakilirMi(olgular)) {
    return ret('superadmin_korumasi');
  }
  if (olgular.sistemAktoruMu) {
    return ret('sistem_aktoru');
  }
  if (olgular.pasifMi) {
    return ret('pasif');
  }
  if (olgular.sonGirebilenKokSuperAdminMi) {
    return ret('son_girebilen_superadmin');
  }
  return tamam();
}

export interface KullaniciYenidenAcmaOlgulari {
  readonly unutulmusMu: boolean;
  readonly sistemAktoruMu: boolean;
  readonly pasifMi: boolean;
}

export type KullaniciYenidenAcmaReddi =
  'unutulmus' | 'sistem_aktoru' | 'pasif_degil';

// Unutulmuş kişi, sistem aktörü ve pasif olmayan kişi yeniden açılmaz (TS-002 "İşlem sınırları";
// AK-47 eki).
export function kullaniciYenidenAcmaKarari(
  olgular: KullaniciYenidenAcmaOlgulari,
): Sonuc<void, KullaniciYenidenAcmaReddi> {
  if (olgular.unutulmusMu) {
    return ret('unutulmus');
  }
  if (olgular.sistemAktoruMu) {
    return ret('sistem_aktoru');
  }
  if (!olgular.pasifMi) {
    return ret('pasif_degil');
  }
  return tamam();
}

export interface ParolaBaglantisiUretmeOlgulari extends SuperAdminKorumasiOlgulari {
  readonly sistemAktoruMu: boolean;
  readonly pasifMi: boolean;
  readonly unutulmusMu: boolean;
  readonly kullaniciAdiDoluMu: boolean;
}

export type ParolaBaglantisiUretmeReddi =
  | 'superadmin_korumasi'
  | 'sistem_aktoru'
  | 'pasif'
  | 'unutulmus'
  | 'kullanici_adi_yok';

// Önce SuperAdmin koruması; sonra sistem aktörü, pasif ve unutulmuş kişi için; sonra kullanıcı adı
// olmayan kişi için bağlantı üretilmez (TS-002 "İşlem sınırları"; KR-008 Seçim 47; KR-009 Seçim 9).
export function parolaBaglantisiUretmeKarari(
  olgular: ParolaBaglantisiUretmeOlgulari,
): Sonuc<void, ParolaBaglantisiUretmeReddi> {
  if (superAdminKorumasinaTakilirMi(olgular)) {
    return ret('superadmin_korumasi');
  }
  if (olgular.sistemAktoruMu) {
    return ret('sistem_aktoru');
  }
  if (olgular.pasifMi) {
    return ret('pasif');
  }
  if (olgular.unutulmusMu) {
    return ret('unutulmus');
  }
  if (!olgular.kullaniciAdiDoluMu) {
    return ret('kullanici_adi_yok');
  }
  return tamam();
}
