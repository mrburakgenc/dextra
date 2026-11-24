// Yetenek yönetiminin okuma repository'si: Yetenek kaynağına yalnız yetki kapısından erişir (TS-002
// AK-19, AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38);
// şart ve kolon listesi saklandığı biçimde gelir.
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface YetenekListeIstegi {
  // Verilen her süzgeç listeyi o kimliğe eşit kayıtlara daraltır.
  readonly grupId?: string;
  readonly rolId?: string;
  readonly izinId?: string;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

export interface YetenekOkumaRepo {
  // Yalnız silinmemiş yetenekler (TS-002 AK-39, AK-42).
  liste(istek: YetenekListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const YETENEK_REPO = new RepoBelirteci<
  YetenekOkumaRepo,
  YetenekOkumaRepo
>('YetenekRepo');
