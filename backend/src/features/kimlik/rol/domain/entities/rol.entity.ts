// Rol varlığı: yeni rolün yazılacak hâli ve rolün durum kararları (TS-005 "Sorumluluklar"). Varlık
// veritabanından doldurulmaz; kararlar işleyicinin topladığı olguları alır.
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';
import type { RolAdi } from '../value-objects/rol-adi.js';

// Yazılacak hâl kod taşımaz: kod sistem alanıdır (TS-002 AK-41), yönetimden açılan rolün kodu boştur.
export interface YeniRol {
  readonly ad: RolAdi;
}

// Ad değer nesnesinden geldiği için kuraldan geçmemiş bir adla rol üretilemez (TS-005 Değişmez 3).
export function rolOlustur(ad: RolAdi): YeniRol {
  return { ad };
}

export interface RolSilmeOlgulari {
  // Kodu dolu mu (bütünlük sorusu; kod okuma kapısından okunmaz).
  readonly sistemRoluMu: boolean;
  // Canlı üyeliği ve canlı yeteneği yok mu.
  readonly bosMu: boolean;
}

export type RolSilmeReddi = 'sistem_rolu' | 'dolu';

// Sistem rolü, boş olsa da silinmez; sonra dolu rol silinmez (TS-002 AK-39, AK-43).
export function rolSilmeKarari(
  olgular: RolSilmeOlgulari,
): Sonuc<void, RolSilmeReddi> {
  if (olgular.sistemRoluMu) {
    return ret('sistem_rolu');
  }
  if (!olgular.bosMu) {
    return ret('dolu');
  }
  return tamam();
}

export interface RolAdDegistirmeOlgulari {
  // Rol silinmemiş mi.
  readonly canliMi: boolean;
}

export type RolAdDegistirmeReddi = 'silinmis';

// Silinmiş rolün adı değişmez (TS-002 "Durum geçişleri"; AK-43).
export function rolAdDegistirmeKarari(
  olgular: RolAdDegistirmeOlgulari,
): Sonuc<void, RolAdDegistirmeReddi> {
  return olgular.canliMi ? tamam() : ret('silinmis');
}
