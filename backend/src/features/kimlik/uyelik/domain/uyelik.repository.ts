// Üyelik yönetiminin okuma repository'si: Uyelik kaynağına yalnız yetki kapısından erişir (TS-002
// AK-19, AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface UyelikListeIstegi {
  // Verilen süzgeçler "ve" ile birleşir.
  readonly kullaniciId?: string;
  readonly grupId?: string;
  readonly rolId?: string;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

export interface UyelikOkumaRepo {
  // Yalnız silinmemiş üyelikler.
  liste(istek: UyelikListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const UYELIK_REPO = new RepoBelirteci<UyelikOkumaRepo, UyelikOkumaRepo>(
  'UyelikRepo',
);

export interface YeniUyelik {
  readonly kullaniciId: string;
  readonly grupId: string;
  readonly rolId: string;
}

// Üyelik yönetiminin yazma repository'si: Uyelik kaynağına yalnız yetki kapısından, run'ın işlem
// nesnesiyle yazar (TS-002 AK-19).
export abstract class UyelikYazmaRepo {
  // Yeni kaydın kimliğini döner; yeni satırı gören oluşturma yeteneği yoksa yetki_yok.
  abstract olustur(
    islem: Islem,
    isAdi: string,
    uyelik: YeniUyelik,
  ): Promise<string>;

  // Silinme zamanını yazar; satırı tutan silme yeteneği yoksa ya da satır zaten silinmişse bulunamadi.
  abstract sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}
