// Üyelik yönetiminin okuma repository'si: Uyelik kaynağına yalnız yetki kapısından erişir (TS-002
// AK-19, AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
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
