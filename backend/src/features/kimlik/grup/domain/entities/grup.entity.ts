// Grup varlığı: yeni grubun yazılacak hâli ve grubun durum kararları (TS-005 "Sorumluluklar"). Varlık
// veritabanından doldurulmaz; kararlar işleyicinin topladığı olguları alır.
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';
import type { GrupAdi } from '../value-objects/grup-adi.js';

// Üst grup zorunludur: kök grup tektir, yönetimden ikinci bir kök açılamaz (TS-002 AK-39).
export interface YeniGrup {
  readonly ad: GrupAdi;
  readonly ustGrupId: string;
}

export interface GrupOlusturmaOlgulari {
  // Üst grup var ve silinmemiş mi.
  readonly ustGrupCanliMi: boolean;
}

export type GrupOlusturmaReddi = 'ust_grup_yok';

// Ad değer nesnesinden geldiği için kuraldan geçmemiş bir adla grup üretilemez (TS-005 Değişmez 3);
// yok ya da silinmiş üst grubun altına grup açılmaz.
export function grupOlustur(
  ad: GrupAdi,
  ustGrupId: string,
  olgular: GrupOlusturmaOlgulari,
): Sonuc<YeniGrup, GrupOlusturmaReddi> {
  return olgular.ustGrupCanliMi
    ? tamam({ ad, ustGrupId })
    : ret('ust_grup_yok');
}

export interface GrupTasimaOlgulari {
  // Taşınan grup var ve silinmemiş mi.
  readonly canliMi: boolean;
  // Taşınan grup kök grup mu (üst grubu yok mu).
  readonly kokMu: boolean;
  // Hedef (yeni üst) grup var ve silinmemiş mi.
  readonly hedefCanliMi: boolean;
  // Hedef, taşınan grubun kendisi ya da altındakilerden biri mi.
  readonly donguYaparMi: boolean;
}

export type GrupTasimaReddi = 'silinmis' | 'kok' | 'ust_grup_yok' | 'dongu';

// Sıra sabittir: silinmiş ya da var olmayan grup önce reddedilir (bulunamadi), sonra kök, canlı
// olmayan hedef ve döngü (KR-008 Seçim 22 ve 27).
export function grupTasimaKarari(
  olgular: GrupTasimaOlgulari,
): Sonuc<void, GrupTasimaReddi> {
  if (!olgular.canliMi) {
    return ret('silinmis');
  }
  if (olgular.kokMu) {
    return ret('kok');
  }
  if (!olgular.hedefCanliMi) {
    return ret('ust_grup_yok');
  }
  if (olgular.donguYaparMi) {
    return ret('dongu');
  }
  return tamam();
}

export interface GrupSilmeOlgulari {
  // Grup kök grup mu (üst grubu yok mu).
  readonly kokMu: boolean;
  // Canlı alt grubu, canlı üyeliği ve canlı yeteneği yok mu.
  readonly bosMu: boolean;
}

export type GrupSilmeReddi = 'kok' | 'dolu';

// Kök grup, boş olsa da silinmez; sonra dolu grup silinmez (TS-002 AK-39; KR-008 Seçim 22 ve 27).
export function grupSilmeKarari(
  olgular: GrupSilmeOlgulari,
): Sonuc<void, GrupSilmeReddi> {
  if (olgular.kokMu) {
    return ret('kok');
  }
  if (!olgular.bosMu) {
    return ret('dolu');
  }
  return tamam();
}
