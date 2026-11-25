// Yetki motorunun kişinin yetki verisini aldığı sözleşme; kimlik feature'ı uygular (TS-002).
// Yalnız düz veri taşır; derlemeyi ortak koddaki motor yapar.

export type Islec =
  | 'esit'
  | 'esit_degil'
  | 'listede'
  | 'listede_degil'
  | 'kucuk'
  | 'kucuk_esit'
  | 'buyuk'
  | 'buyuk_esit';

// isteyen: isteği yapanın kimliği; yetenek_grubu: yeteneğin grubu;
// yetenek_grubu_ve_alti: yeteneğin grubu ve altındakiler (KR-008 Seçim 4).
export type YerTutucu = 'isteyen' | 'yetenek_grubu' | 'yetenek_grubu_ve_alti';

export type SabitDeger = string | number | boolean;

export type SartDegeri =
  SabitDeger | readonly SabitDeger[] | { readonly yerTutucu: YerTutucu };

// Saklanan şartın bir öğesi; şart bu öğelerin düz dizisidir ve hepsi "ve" ile bağlanır.
export interface SartOgesi {
  readonly alan: string;
  readonly islec: Islec;
  readonly deger: SartDegeri;
}

export interface YetenekSatiri {
  readonly yetenekId: string;
  readonly grupId: string;
  readonly rolId: string;
  readonly kaynak: string;
  readonly eylem: string;
  readonly sart: readonly SartOgesi[];
  readonly butunKayitlar: boolean;
  readonly butunBirimler: boolean;
  readonly kolonlar: readonly string[];
  readonly butunKolonlar: boolean;
}

export interface UyelikSatiri {
  readonly uyelikId: string;
  readonly grupId: string;
  readonly rolId: string;
}

export interface YetkiSurumleri {
  readonly kisiSurumu: number;
  readonly genelSurum: number;
}

export interface KisininSatirlari extends YetkiSurumleri {
  readonly uyelikler: readonly UyelikSatiri[];
  readonly yetenekler: readonly YetenekSatiri[];
  // Anahtar bir grubun kimliğidir; değer, o grubun kendi kimliğini ve altındaki bütün grupların
  // kimliklerini içeren listedir: liste grubun kendisini her zaman içerir. Derleyici listeyi
  // olduğu gibi kullanır, grubu kendisi eklemez.
  readonly altGruplar: Readonly<Record<string, readonly string[]>>;
}

export interface YetkiVerisi {
  surumler(kullaniciId: string): Promise<YetkiSurumleri>;
  // Sürümler satırlardan önce okunur (TS-002, çürütme 9).
  kisininSatirlari(kullaniciId: string): Promise<KisininSatirlari>;
}

export const YETKI_VERISI = Symbol('YetkiVerisi');
