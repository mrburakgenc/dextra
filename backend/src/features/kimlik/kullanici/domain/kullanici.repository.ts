// Kullanıcı yönetiminin okuma repository'si: Kullanici kaynağına yalnız yetki kapısından erişir (TS-002
// AK-19, AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface KullaniciListeIstegi {
  // Verilirse yalnız pasif (true) ya da yalnız pasif olmayan (false) kişiler.
  readonly pasif?: boolean;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

export interface KullaniciOkumaRepo {
  liste(istek: KullaniciListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const KULLANICI_REPO = new RepoBelirteci<
  KullaniciOkumaRepo,
  KullaniciOkumaRepo
>('KullaniciRepo');
