// Üyelik alt özelliğinin repository arayüzleri ve belirteçleri: Uyelik kaynağına yalnız yetki
// kapısından erişilir; okuma okuma yüzünden, yazma yazma yüzünden geçer (TS-002 AK-19, AK-39).
// Gerçeklemeleri infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import type {
  Kayit,
  Siralama,
} from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { YeniUyelik } from '../entities/uyelik.entity.js';

export interface UyelikListeIstegi {
  // Verilen süzgeçler "ve" ile birleşir.
  readonly kullaniciId?: string;
  readonly grupId?: string;
  readonly rolId?: string;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

// Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
export interface IUyelikOkumaRepo {
  // Yalnız silinmemiş üyelikler.
  liste(istek: UyelikListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const UYELIK_OKUMA_REPO = new RepoBelirteci<
  IUyelikOkumaRepo,
  IUyelikOkumaRepo
>('IUyelikOkumaRepo');

// Uyelik kaynağına yalnız yetki kapısından, run'ın işlem nesnesiyle yazılır (TS-002 AK-19); isAdi
// kapının notunun işin adı alanıdır.
export interface IUyelikYazmaRepo {
  // Yeni kaydın kimliğini döner; yeni satırı gören oluşturma yeteneği yoksa yetki_yok.
  olustur(islem: Islem, isAdi: string, uyelik: YeniUyelik): Promise<string>;

  // Silinme zamanını yazar; satırı tutan silme yeteneği yoksa ya da satır zaten silinmişse bulunamadi.
  sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}

// Nest sağlayıcı belirteci: modül gerçeklemeyi bununla sağlar, işleyici bununla enjekte eder.
export const UYELIK_YAZMA_REPO = Symbol('IUyelikYazmaRepo');
