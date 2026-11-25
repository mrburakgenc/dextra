// Üyelik varlığı: verilecek üyeliğin yazılacak hâli ve üyeliğin durum kararları (TS-005
// "Sorumluluklar"). Varlık veritabanından doldurulmaz; kararlar işleyicinin topladığı olguları alır.
// (Kök, SuperAdmin) kümesi: kök grup ile SuperAdmin rolü; (Kök, Temel) kümesi: kök grup ile kodu dolu
// (sistem) bir rolün SuperAdmin olmayan kümesidir.
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

// Kişiye bir grupta rol verilir.
export interface YeniUyelik {
  readonly kullaniciId: string;
  readonly grupId: string;
  readonly rolId: string;
}

export interface UyelikVermeOlgulari {
  // Verilen (grup, rol) kümesi (Kök, SuperAdmin) mi.
  readonly superAdminUyeligiMi: boolean;
  // Üyeliği veren kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyor mu.
  readonly isteyenSuperAdminMi: boolean;
  // Üyelik verilen kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyor mu.
  readonly kisiSuperAdminMi: boolean;
  // Grup ve rol var ve silinmemiş mi.
  readonly grupCanliMi: boolean;
  readonly rolCanliMi: boolean;
  readonly kisiPasifMi: boolean;
  readonly kisiUnutulmusMu: boolean;
  readonly kisiSistemAktoruMu: boolean;
}

export type UyelikVermeReddi =
  | 'superadmin_degil'
  | 'zaten_superadmin'
  | 'grup_ya_da_rol_yok'
  | 'kisi_uygun_degil';

export interface VerilecekUyelik {
  readonly uyelik: YeniUyelik;
  // SuperAdmin üyeliği kişinin kimlik bilgisini sıfırlar: kişi kilitlenir, parola sırrı ve
  // kullanılmamış bağlantı silinir, bütün oturumları yetki_yukseltme nedeniyle kapanır.
  readonly kimlikSifirlanirMi: boolean;
}

// Sıra sabittir (KR-008 Seçim 47 ve eki): (Kök, SuperAdmin) üyeliğini yalnız (Kök, SuperAdmin) üyesi
// verir, zaten üye olan kişiye hiçbir şey sıfırlanmadan verilmez; sonra grup ve rol canlı olmalıdır;
// sonra kişi pasif, unutulmuş ya da sistem aktörü olamaz.
export function uyelikVer(
  uyelik: YeniUyelik,
  olgular: UyelikVermeOlgulari,
): Sonuc<VerilecekUyelik, UyelikVermeReddi> {
  if (olgular.superAdminUyeligiMi) {
    if (!olgular.isteyenSuperAdminMi) {
      return ret('superadmin_degil');
    }
    if (olgular.kisiSuperAdminMi) {
      return ret('zaten_superadmin');
    }
  }
  if (!olgular.grupCanliMi || !olgular.rolCanliMi) {
    return ret('grup_ya_da_rol_yok');
  }
  if (
    olgular.kisiPasifMi ||
    olgular.kisiUnutulmusMu ||
    olgular.kisiSistemAktoruMu
  ) {
    return ret('kisi_uygun_degil');
  }
  return tamam({ uyelik, kimlikSifirlanirMi: olgular.superAdminUyeligiMi });
}

export interface KimlikSifirlamaOlgulari {
  readonly kullaniciAdiDoluMu: boolean;
}

// Kimliği sıfırlanan kişinin kullanıcı adı doluysa yeni parola bağlantısı üretilir (kod cevapta bir
// kez döner); değilse kullanılmamış bağlantısı silinir.
export function sifirlamaBaglantisi(
  olgular: KimlikSifirlamaOlgulari,
): 'uret' | 'sil' {
  return olgular.kullaniciAdiDoluMu ? 'uret' : 'sil';
}

export interface UyelikKaldirmaOncesiOlgulari {
  // Üyelik silinmemiş mi.
  readonly canliMi: boolean;
}

export type UyelikKaldirmaOncesiReddi = 'silinmis';

// Silinmiş üyelik yeniden kaldırılmaz; bu karar silmeden ve öbür olgular sorulmadan önce verilir.
export function uyelikKaldirmaOncesiKarari(
  olgular: UyelikKaldirmaOncesiOlgulari,
): Sonuc<void, UyelikKaldirmaOncesiReddi> {
  return olgular.canliMi ? tamam() : ret('silinmis');
}

export interface UyelikKaldirmaOlgulari {
  // Üyeliğin (grup, rol) kümesi (Kök, SuperAdmin) mi.
  readonly superAdminUyeligiMi: boolean;
  // Üyeliğin grubu kök grup mu.
  readonly grupKokMu: boolean;
  // Üyeliğin rolü sistem rolü (kodu dolu) mu.
  readonly rolSistemRoluMu: boolean;
  // Kaldıran kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyor mu.
  readonly isteyenSuperAdminMi: boolean;
  // Üyeliğin kişisi girebilen son (Kök, SuperAdmin) üyesi mi.
  readonly sonGirebilenSuperAdminMi: boolean;
}

export type UyelikKaldirmaReddi =
  'temel_uyelik' | 'superadmin_degil' | 'son_superadmin';

// Sıra sabittir (KR-008 Seçim 47; AK-43): (Kök, Temel) üyeliği kaldırılamaz; SuperAdmin üyeliğini
// yalnız (Kök, SuperAdmin) üyesi kaldırır; girebilen son SuperAdmin'in üyeliği kaldırılamaz.
// Olgular silmeden önceki hâldir.
export function uyelikKaldirmaKarari(
  olgular: UyelikKaldirmaOlgulari,
): Sonuc<void, UyelikKaldirmaReddi> {
  if (
    !olgular.superAdminUyeligiMi &&
    olgular.grupKokMu &&
    olgular.rolSistemRoluMu
  ) {
    return ret('temel_uyelik');
  }
  if (olgular.superAdminUyeligiMi && !olgular.isteyenSuperAdminMi) {
    return ret('superadmin_degil');
  }
  if (olgular.superAdminUyeligiMi && olgular.sonGirebilenSuperAdminMi) {
    return ret('son_superadmin');
  }
  return tamam();
}
