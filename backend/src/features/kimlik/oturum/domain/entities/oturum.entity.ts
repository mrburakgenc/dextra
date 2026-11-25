// Oturum varlığı: yeni oturumun ve sır satırının yazılacak hâli, döndürmenin yazılacak hâli ve oturumun
// durum kararları (giriş, oturum denetimi, yenileme, yönetimden kapatma) (TS-005 "Sorumluluklar").
// Varlık veritabanından doldurulmaz; kararlar işleyicinin kilit altında okuduğu satırı ya da topladığı
// olguları alır.
import { createHash } from 'node:crypto';
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';
import type {
  OturumDenetimiGirdisi,
  OturumDenetimiSonucu,
} from '../../../../../shared/kimlik/domain/i-oturum-denetimi.contract.js';
import type { KapatilmaNedeni } from '../../../_shared/domain/kapatilma-nedeni.js';

// Oturum sayıları (TS-002 AK-9; KR-009 varsayılanları). Proje ayarı sonra gelir.
// Oturumun mutlak bitişi girişte belirlenir ve döndürmeyle uzamaz (KR-009 Kural 6).
export const MUTLAK_OMUR_MS = 7 * 24 * 60 * 60 * 1000;

// Hareketsizlik sınırı (TS-002 AK-9; KR-009 varsayılanı): son döndürmeden bu kadar sonra oturum açık
// sayılmaz. Proje ayarı sonra gelir.
export const HAREKETSIZLIK_SINIRI_MS = 30 * 60 * 1000;

// Hoşgörü penceresi (TS-002 AK-49 madde 2; KR-009 Kural 3): bir önceki neslin belirteci son
// döndürmeden sonra bu süre içinde gelirse yeniden kullanım sayılmaz. Ölçülünce değişir.
export const HOSGORU_PENCERESI_MS = 10_000;

// Yenileme belirtecinin ve cihaz sırrının tabloda duran özeti: SHA-256 (onaltılık). Yüksek
// entropili sırda yavaş özet gerekmez.
export function oturumSirrininOzeti(sir: string): string {
  return createHash('sha256').update(sir).digest('hex');
}

export interface KisininDurumu {
  readonly pasif: boolean;
  readonly unutulmus: boolean;
  readonly sistemAktoru: boolean;
}

export type OturumAcmaReddi = 'kisi_giremez';

// Pasif, unutulmuş kişi ve sistem aktörü oturum açamaz (TS-002 AK-9, AK-15).
export function oturumAcmaKarari(
  kisi: KisininDurumu,
): Sonuc<void, OturumAcmaReddi> {
  if (kisi.pasif || kisi.unutulmus || kisi.sistemAktoru) {
    return ret('kisi_giremez');
  }
  return tamam();
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

export interface OturumAcilisi {
  readonly id: string;
  readonly kullaniciId: string;
  readonly girisYontemi: string;
  readonly baslangicZamani: Date;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
  // Düz hâlleriyle; tabloya yalnız özetleri yazılır.
  readonly yenilemeBelirteci: string;
  readonly cihazSirri: string;
}

// Yeni oturumun nesli; girişte verilen yenileme belirteci bu nesille imzalanır.
export const ILK_NESIL = 1;

// Yeni oturum ve sır satırı (TS-002 "İşlem sınırları" Giriş): mutlak bitiş başlangıçtan mutlak ömür
// sonradır, son döndürme zamanı başlangıç zamanıdır, nesil ilk nesildir; sır satırında belirtecin ve
// cihaz sırrının yalnız özeti durur.
export function oturumAc({
  yenilemeBelirteci,
  cihazSirri,
  ...acilis
}: OturumAcilisi): { oturum: YeniOturum; sir: YeniOturumSirri } {
  return {
    oturum: {
      ...acilis,
      mutlakBitisZamani: new Date(
        acilis.baslangicZamani.getTime() + MUTLAK_OMUR_MS,
      ),
      sonDondurmeZamani: acilis.baslangicZamani,
    },
    sir: {
      nesil: ILK_NESIL,
      gecerliYenilemeOzeti: oturumSirrininOzeti(yenilemeBelirteci),
      cihazSirriOzeti: oturumSirrininOzeti(cihazSirri),
    },
  };
}

// Oturum denetiminde her istekte okunan satır: oturum, kişinin durumu ve sayısı ile genel sayaç, aynı
// anda.
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

// Okunan satırdan sonucu verir. Açık oturum (TS-002 "Veri modeli"): kapatılmamış, mutlak bitişi
// geçmemiş ve son döndürmesinden beri hareketsizlik sınırı dolmamış oturum. Adres yalnız öbür
// bakımlardan geçerli oturumda karşılaştırılır; yazma yalnız o dalda gerekir.
export function denetimSonucu(
  satir: DenetimSatiri | null,
  { ipAdresi, tarayiciBilgisi }: OturumDenetimiGirdisi,
  simdi: number,
): OturumDenetimiSonucu {
  if (satir === null) {
    return { gecerli: false, neden: 'yok' };
  }
  if (satir.kapali) {
    return { gecerli: false, neden: 'kapali' };
  }
  if (satir.kullaniciPasif || satir.sistemAktoru) {
    return { gecerli: false, neden: 'kullanici_pasif' };
  }
  if (
    satir.mutlakBitisZamani.getTime() <= simdi ||
    satir.sonDondurmeZamani.getTime() + HAREKETSIZLIK_SINIRI_MS <= simdi
  ) {
    return { gecerli: false, neden: 'suresi_doldu' };
  }
  if (
    satir.ipAdresi !== ipAdresi ||
    satir.tarayiciBilgisi !== tarayiciBilgisi
  ) {
    return { gecerli: false, neden: 'adres_degisti' };
  }
  return {
    gecerli: true,
    kullaniciId: satir.kullaniciId,
    kisiSurumu: satir.kisiSurumu,
    genelSurum: satir.genelSurum,
  };
}

export interface OturumSirriSatiri {
  readonly nesil: number;
  readonly gecerliYenilemeOzeti: string;
  readonly oncekiYenilemeOzeti: string | null;
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
  readonly sir: OturumSirriSatiri | null;
}

// Yenilemeye gelen belirtecin nesli ve özeti, isteğin adresi, tarayıcı bilgisi ve cihaz sırrının özeti.
export interface YenilemeIstegi {
  readonly nesil: number;
  readonly belirtecOzeti: string;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
  readonly cihazSirriOzeti: string;
}

export type YenilemeKarari =
  // Hiçbir satıra dokunulmadan reddedilir; kapalı oturuma eski nesil geldiyse güvenlik olayı yazılır.
  | { readonly tur: 'reddet'; readonly eskiNesil: boolean }
  // Yalnız bu oturum kapatılır ve reddedilir.
  | {
      readonly tur: 'kapat';
      readonly neden: Extract<
        KapatilmaNedeni,
        'tutarsiz_nesil' | 'sure' | 'adres_degisti' | 'cihaz_uymadi'
      >;
    }
  // Kişinin bütün oturumları yeniden_kullanim nedeniyle kapatılır ve reddedilir.
  | { readonly tur: 'yeniden_kullanim' }
  // Geçerli nesil: döndürülür. Pencere içinde bir önceki nesil: döndürülmez, geçerli neslin
  // belirteci yeniden imzalanır. İkisi de satırdaki sırrı ve son döndürme zamanını taşır.
  | {
      readonly tur: 'dondur' | 'pencere';
      readonly sir: OturumSirriSatiri;
      readonly sonDondurmeZamani: Date;
    };

// Yenileme sırasının 2–5. adımları (TS-002 "İşlem sınırları" Yenile; KR-009 Kural 11; AK-49). Satır
// kişi ve oturum kilidi altında okunmuştur. Giriş yöntemi adımı bugün yoktur (AK-49 madde 5).
export function yenilemeKarari(
  satir: YenilemeSatiri | null,
  istek: YenilemeIstegi,
  simdi: number,
): YenilemeKarari {
  if (satir === null) {
    return { tur: 'reddet', eskiNesil: false };
  }
  const { sir } = satir;
  // Kapalı oturumda toplu kapatma yapılmaz (KR-009 Kural 7; AK-49 madde 4).
  if (satir.kapali) {
    return {
      tur: 'reddet',
      eskiNesil: sir !== null && istek.nesil < sir.nesil,
    };
  }
  if (sir === null) {
    return { tur: 'reddet', eskiNesil: false };
  }
  if (
    istek.nesil > sir.nesil ||
    (istek.nesil === sir.nesil &&
      istek.belirtecOzeti !== sir.gecerliYenilemeOzeti)
  ) {
    return { tur: 'kapat', neden: 'tutarsiz_nesil' };
  }
  const pencere = istek.nesil < sir.nesil;
  // Yeniden kullanım kararı cihaz sırrına bakmaz; kaç nesil eski olursa olsun eski belirteç
  // pencere dışında hırsızlık işaretidir (KR-009 Seçim 2 ve 12).
  if (
    pencere &&
    !(
      istek.nesil === sir.nesil - 1 &&
      istek.belirtecOzeti === sir.oncekiYenilemeOzeti &&
      simdi < satir.sonDondurmeZamani.getTime() + HOSGORU_PENCERESI_MS
    )
  ) {
    return { tur: 'yeniden_kullanim' };
  }
  // Süre, adres ve cihaz sırrı pencere içi dalda da aranır.
  if (
    satir.mutlakBitisZamani.getTime() <= simdi ||
    satir.sonDondurmeZamani.getTime() + HAREKETSIZLIK_SINIRI_MS <= simdi
  ) {
    return { tur: 'kapat', neden: 'sure' };
  }
  if (
    satir.ipAdresi !== istek.ipAdresi ||
    satir.tarayiciBilgisi !== istek.tarayiciBilgisi
  ) {
    return { tur: 'kapat', neden: 'adres_degisti' };
  }
  if (sir.cihazSirriOzeti !== istek.cihazSirriOzeti) {
    return { tur: 'kapat', neden: 'cihaz_uymadi' };
  }
  return {
    tur: pencere ? 'pencere' : 'dondur',
    sir,
    sonDondurmeZamani: satir.sonDondurmeZamani,
  };
}

export type PencereReddi = 'ozet_uymadi';

// Pencere içinde geçerli neslin yeniden imzalanan belirteci saklanan özete uymuyorsa yenileme
// reddedilir; oturum yaşar (TS-002 AK-49 madde 2).
export function pencereKarari(
  sir: OturumSirriSatiri,
  yenidenImzalanan: string,
): Sonuc<void, PencereReddi> {
  return oturumSirrininOzeti(yenidenImzalanan) === sir.gecerliYenilemeOzeti
    ? tamam()
    : ret('ozet_uymadi');
}

export interface Dondurme {
  readonly nesil: number;
  readonly gecerliYenilemeOzeti: string;
  readonly oncekiYenilemeOzeti: string;
  readonly sonDondurmeZamani: Date;
}

// Döndürmenin nesli: geçerli neslin bir fazlası. Yeni belirteç bu nesille imzalanır.
export function yeniNesil(sir: OturumSirriSatiri): number {
  return sir.nesil + 1;
}

// Döndürmenin yazılacak hâli: yeni nesil ve yeni belirtecin özeti geçerli olur, eski geçerli özet bir
// önceki neslin özeti olur (pencere onunla sınanır), son döndürme zamanı şimdidir.
export function dondurme(
  sir: OturumSirriSatiri,
  yeniBelirtec: string,
  simdi: Date,
): Dondurme {
  return {
    nesil: yeniNesil(sir),
    gecerliYenilemeOzeti: oturumSirrininOzeti(yeniBelirtec),
    oncekiYenilemeOzeti: sir.gecerliYenilemeOzeti,
    sonDondurmeZamani: simdi,
  };
}

export type OturumKapatmaNedeni = Extract<
  KapatilmaNedeni,
  'sahibi_kapatti' | 'yonetici'
>;

export interface OturumKapatmaOlgulari {
  // Oturum kapatılmış mı; isteyen kapatılma zamanını göremiyorsa null.
  readonly kapaliMi: boolean | null;
  // Oturumun sahibi isteği yapan mı; isteyen sahibini göremiyorsa null.
  readonly sahibiMi: boolean | null;
}

export type OturumKapatmaReddi = 'gorulemiyor' | 'zaten_kapali';

// Yönetimden kapatma (TS-002 AK-51). Kararın baktığı iki olgudan biri görülemiyorsa oturumun kapalı
// olup olmadığı ya da kimin olduğu bilinemez; kapatılmaz (yetenek yenilemedeki gibi; AK-46 eki).
// Sonra zaten kapalı oturum kapatılmaz. Tamam, kapatmanın nedenini verir: oturumun sahibi isteği
// yapansa sahibi_kapatti, değilse yonetici.
export function oturumKapatmaKarari({
  kapaliMi,
  sahibiMi,
}: OturumKapatmaOlgulari): Sonuc<OturumKapatmaNedeni, OturumKapatmaReddi> {
  if (kapaliMi === null || sahibiMi === null) {
    return ret('gorulemiyor');
  }
  if (kapaliMi) {
    return ret('zaten_kapali');
  }
  return tamam(sahibiMi ? 'sahibi_kapatti' : 'yonetici');
}
