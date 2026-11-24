// Rol alt özelliğinin okuma repository'si: rol ve izin kaynaklarını yalnız yetki kapısından okur
// (TS-002 AK-39). Kayıtlar isteyenin görebildiği kolonları ve kimliği taşır.
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

export interface Sayfa {
  readonly atla: number;
  readonly al: number;
}

export interface RolOkumaRepo {
  // Yalnız silinmemiş roller (TS-002 AK-39, AK-42); tek kayıt silinmiş rolü de verir.
  roller(siralama: readonly Siralama[], sayfa: Sayfa): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan rol için bulunamadi.
  rol(id: string): Promise<Kayit>;
  // İzin kataloğu.
  izinler(siralama: readonly Siralama[], sayfa: Sayfa): Promise<Kayit[]>;
}

export const ROL_REPO = new RepoBelirteci<RolOkumaRepo, RolOkumaRepo>(
  'RolRepo',
);
