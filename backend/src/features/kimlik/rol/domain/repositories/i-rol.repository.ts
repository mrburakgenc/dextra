// Rol alt özelliğinin repository arayüzleri ve belirteçleri: okuma yetki kapısının okuma yüzünden,
// yazma yazma yüzünden geçer (TS-002 AK-39); gerçeklemeleri infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import type {
  Kayit,
  Siralama,
} from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { YeniRol } from '../entities/rol.entity.js';
import type { RolAdi } from '../value-objects/rol-adi.js';

export interface Sayfa {
  readonly atla: number;
  readonly al: number;
}

// Kayıtlar isteyenin görebildiği kolonları ve kimliği taşır.
export interface IRolOkumaRepo {
  // Yalnız silinmemiş roller (TS-002 AK-39, AK-42); tek kayıt silinmiş rolü de verir.
  roller(siralama: readonly Siralama[], sayfa: Sayfa): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan rol için bulunamadi.
  rol(id: string): Promise<Kayit>;
  // İzin kataloğu.
  izinler(siralama: readonly Siralama[], sayfa: Sayfa): Promise<Kayit[]>;
}

export const ROL_OKUMA_REPO = new RepoBelirteci<IRolOkumaRepo, IRolOkumaRepo>(
  'IRolOkumaRepo',
);

// Yazmalar yalnız çağıranın işleminde yapılır ve her biri değişiklik kaydı notu bırakır; isAdi notun
// işin adı alanıdır. Yetki kapısının reddi hata olarak atılır.
export interface IRolYazmaRepo {
  // Yeni rolün kimliğini döner.
  olustur(islem: Islem, isAdi: string, rol: YeniRol): Promise<string>;
  // Görülemeyen ya da var olmayan rol için bulunamadi.
  adDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: RolAdi,
  ): Promise<void>;
  // Yumuşak siler; silinmiş, görülemeyen ya da var olmayan rol için bulunamadi.
  sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}

// Nest sağlayıcı belirteci: modül gerçeklemeyi bununla sağlar, işleyici bununla enjekte eder.
export const ROL_YAZMA_REPO = Symbol('IRolYazmaRepo');
