// Grup yönetiminin okuma repository'si: Grup kaynağına yalnız yetki kapısından erişir (TS-002 AK-19,
// AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface GrupListeIstegi {
  // Verilirse yalnız bu grubun doğrudan altındaki gruplar.
  readonly ustGrupId?: string;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

export interface GrupOkumaRepo {
  liste(istek: GrupListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const GRUP_REPO = new RepoBelirteci<GrupOkumaRepo, GrupOkumaRepo>(
  'GrupRepo',
);
