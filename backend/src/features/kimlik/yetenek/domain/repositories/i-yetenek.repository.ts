// Yetenek alt özelliğinin repository arayüzleri ve belirteçleri: Yetenek kaynağına yalnız yetki
// kapısından erişilir; okuma okuma yüzünden, yazma yazma yüzünden geçer (TS-002 AK-19, AK-39).
// Gerçeklemeleri infrastructure/repositories altındadır. Kayıtlar yalnız isteyenin görebildiği
// kolonları ve her zaman kimliği taşır (AK-38); şart ve kolon listesi saklandığı biçimde gelir.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';
import type { Islem } from '../../../../../shared/database/domain/islem.js';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { YeniYetenek } from '../entities/yetenek.entity.js';

// Okunan yetenek ve izin kayıtları: kimlik her zaman vardır; isteyenin göremediği kolon kayıtta yoktur.
export interface YetenekGorunumu {
  readonly id: string;
  readonly grupId?: string;
  readonly rolId?: string;
  readonly izinId?: string;
  readonly sart?: unknown;
  readonly butunKayitlar?: boolean;
  readonly butunBirimler?: boolean;
  readonly kolonlar?: readonly string[];
  readonly butunKolonlar?: boolean;
  readonly sistemSatiri?: boolean;
  readonly silinmeZamani?: Date | null;
  readonly tohumAnahtari?: string | null;
  readonly yerineGectigiId?: string | null;
  readonly koken?: string;
  readonly olusturmaZamani?: Date;
  readonly giremez?: boolean;
  readonly oncelik?: number;
}

export interface IzinGorunumu {
  readonly id: string;
  readonly kaynak?: string;
  readonly eylem?: string;
}

export interface YetenekListeIstegi {
  // Verilen her süzgeç listeyi o kimliğe eşit kayıtlara daraltır.
  readonly grupId?: string;
  readonly rolId?: string;
  readonly izinId?: string;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

export interface IYetenekOkumaRepo {
  // Yalnız silinmemiş yetenekler (TS-002 AK-39, AK-42).
  liste(istek: YetenekListeIstegi): Promise<YetenekGorunumu[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<YetenekGorunumu>;
}

// Yazma işinin run içindeki okumaları; ikisi de yetki kapısından, isteyenin okuma yeteneğiyle.
export interface IYetenekRepo extends IYetenekOkumaRepo {
  // İzin kaynağından o kimlikteki kayıt; görülemiyor ya da yoksa undefined.
  izin(id: string): Promise<IzinGorunumu | undefined>;
}

export const YETENEK_REPO = new RepoBelirteci<IYetenekOkumaRepo, IYetenekRepo>(
  'IYetenekRepo',
);

// Yetenek kaynağına yalnız yetki kapısından, run'ın işlem nesnesiyle yazılır (TS-002 AK-19). Kapı
// işlemin istemcisini işlem nesnesinden aldığı için yazma Registrar'dan değil, işlem nesnesini
// parametre alan bu arayüzden geçer; isAdi kapının notunun işin adı alanıdır. Güncelleme metodu yoktur:
// satır yerinde düzenlenmez (değişmez 6).
export interface IYetenekYazmaRepo {
  // Köken 'yonetici' yazılır; yeni kaydın kimliğini döner.
  olustur(islem: Islem, isAdi: string, yetenek: YeniYetenek): Promise<string>;

  // Yenilemede eski satırın kapatılması: niyet eylemi 'yenile', silinme zamanı yazılır. Satırı tutan
  // yenile yeteneği yoksa ya da satır zaten silinmişse bulunamadi.
  kapat(islem: Islem, isAdi: string, id: string): Promise<void>;

  // Yumuşak silme; satırı tutan silme yeteneği yoksa ya da satır zaten silinmişse bulunamadi.
  sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}

// Nest sağlayıcı belirteci: modül gerçeklemeyi bununla sağlar, işleyici bununla enjekte eder.
export const YETENEK_YAZMA_REPO = Symbol('IYetenekYazmaRepo');
