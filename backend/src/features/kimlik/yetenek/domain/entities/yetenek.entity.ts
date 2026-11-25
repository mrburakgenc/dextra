// Yetenek varlığı: yeni yetenek satırının yazılacak hâli ve satırın durum kararları (TS-005
// "Sorumluluklar"). Varlık veritabanından doldurulmaz; kararlar işleyicinin topladığı olguları alır.
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';
import type {
  YetenekIcerigi,
  YetenekIcerigiAlanlari,
} from '../value-objects/yetenek-icerigi.js';

// Satırın bağlandığı grup, rol ve izin.
export interface YetenekBaglantisi {
  readonly grupId: string;
  readonly rolId: string;
  readonly izinId: string;
}

// Yazılacak yetenek satırı; boş şart ve boş kolon listesi null'dır (KR-008 Seçim 5 ve 11).
export interface YeniYetenek extends YetenekBaglantisi, YetenekIcerigiAlanlari {
  // Yalnız yenilemede: yeni satırın yerine geçtiği eski satır (TS-002 "Durum geçişleri").
  readonly yerineGectigiId?: string;
}

// Yazma eylemlerini yalnız (Kök, SuperAdmin) kümesine bağlanabilen kaynaklar (KR-008 Seçim 17;
// TS-002 değişmez 8). Yazma eylemi okuma dışındaki her eylemdir.
const KORUNAN_KAYNAKLAR = ['Grup', 'Rol', 'Uyelik', 'Yetenek'];
const OKUMA_EYLEMI = 'oku';

// Görülebilen izne bağlı olgular.
export interface IzinOlgulari {
  readonly kaynak: string;
  readonly eylem: string;
  // İzinin kaynağının alanları (kaynak kataloğu).
  readonly kaynakAlanlari: readonly string[];
  // Satır ortak koddaki derleyiciye verildiğinde derlenemediyse nedeni; derlendiyse undefined.
  readonly derlemeHatasi: string | undefined;
}

export interface YetenekYazmaOlgulari {
  // Grup ve rol var ve silinmemiş mi.
  readonly grupCanliMi: boolean;
  readonly rolCanliMi: boolean;
  // İzin görülebiliyorsa ona bağlı olgular; görülemeyen ya da var olmayan izin katalogda yok sayılır.
  readonly izin: IzinOlgulari | undefined;
  // (grup, rol) kümesi (Kök, SuperAdmin) mi.
  readonly kokSuperAdminKumesiMi: boolean;
}

export type YetenekYazmaReddi =
  | { readonly kod: 'grup_ya_da_rol_yok' }
  | { readonly kod: 'izin_yok' }
  | { readonly kod: 'bilinmeyen_kolon'; readonly kolon: string }
  | { readonly kod: 'derlenemedi'; readonly derlemeHatasi: string }
  | { readonly kod: 'korunan_kaynak' };

// İçerik değer nesnesinden geldiği için kuraldan geçmemiş bir içerikle satır üretilemez (TS-005
// Değişmez 3). Sıra sabittir (KR-008 Seçim 5, 7, 11, 17): grup ya da rol canlı değilse, sonra izin
// görülemiyorsa, sonra kolon listesinde kaynağın alanı olmayan kolon varsa (derleyici bilinmeyen kolonu
// sessizce attığı için ayrıca bakılır; ilk bilinmeyen kolon döner), sonra satır derlenemiyorsa, en son
// korunan kaynağın yazma izni (Kök, SuperAdmin) dışındaki kümeye bağlanıyorsa reddedilir.
export function yetenekOlustur(
  { grupId, rolId, izinId }: YetenekBaglantisi,
  icerik: YetenekIcerigi,
  olgular: YetenekYazmaOlgulari,
): Sonuc<YeniYetenek, YetenekYazmaReddi> {
  if (!olgular.grupCanliMi || !olgular.rolCanliMi) {
    return ret({ kod: 'grup_ya_da_rol_yok' });
  }
  const { izin } = olgular;
  if (izin === undefined) {
    return ret({ kod: 'izin_yok' });
  }
  const bilinmeyenKolon = icerik.kolonlar?.find(
    (kolon) => !izin.kaynakAlanlari.includes(kolon),
  );
  if (bilinmeyenKolon !== undefined) {
    return ret({ kod: 'bilinmeyen_kolon', kolon: bilinmeyenKolon });
  }
  if (izin.derlemeHatasi !== undefined) {
    return ret({ kod: 'derlenemedi', derlemeHatasi: izin.derlemeHatasi });
  }
  if (
    KORUNAN_KAYNAKLAR.includes(izin.kaynak) &&
    izin.eylem !== OKUMA_EYLEMI &&
    !olgular.kokSuperAdminKumesiMi
  ) {
    return ret({ kod: 'korunan_kaynak' });
  }
  const { sart, butunKayitlar, butunBirimler, kolonlar, butunKolonlar } =
    icerik;
  return tamam({
    grupId,
    rolId,
    izinId,
    sart,
    butunKayitlar,
    butunBirimler,
    kolonlar,
    butunKolonlar,
  });
}

export interface YetenekSilmeOlgulari {
  // Sistem satırı işareti; isteyen işareti göremiyorsa undefined.
  readonly sistemSatiri: boolean | undefined;
}

export type YetenekSilmeReddi = 'sistem_satiri';

// Sistem satırı silinmez; sistem satırı işaretini göremeyen kişi de silemez, karar kapalı düşer
// (TS-002 değişmez 8).
export function yetenekSilmeKarari(
  olgular: YetenekSilmeOlgulari,
): Sonuc<void, YetenekSilmeReddi> {
  return olgular.sistemSatiri === false ? tamam() : ret('sistem_satiri');
}

export interface YetenekYenilemeOlgulari {
  // Kararın baktığı kolonların hepsi isteyene görünüyor mu; biri görülemiyorsa satırın korunan olup
  // olmadığı bilinemez (TS-002 AK-46 eki).
  readonly kararKolonlariGorunurMu: boolean;
  readonly silinmisMi: boolean;
  readonly sistemSatiriMi: boolean;
  // Tohum anahtarı dolu mu.
  readonly tohumSatiriMi: boolean;
}

export type YetenekYenilemeReddi = 'gorulemiyor' | 'silinmis' | 'korunan_satir';

// Sıra sabittir (TS-002 "Durum geçişleri", AK-46 ve eki; değişmez 6): karar kolonlarından birini
// göremeyen kişi yenileyemez, sonra silinmiş satır yenilenmez, en son sistem satırı ve tohum satırı
// yenilenmez (onları tohum göçü değiştirir).
export function yetenekYenilemeKarari(
  olgular: YetenekYenilemeOlgulari,
): Sonuc<void, YetenekYenilemeReddi> {
  if (!olgular.kararKolonlariGorunurMu) {
    return ret('gorulemiyor');
  }
  if (olgular.silinmisMi) {
    return ret('silinmis');
  }
  if (olgular.sistemSatiriMi || olgular.tohumSatiriMi) {
    return ret('korunan_satir');
  }
  return tamam();
}
