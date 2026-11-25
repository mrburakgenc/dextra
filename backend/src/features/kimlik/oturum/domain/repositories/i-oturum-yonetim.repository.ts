// Oturumların listelenmesi ve kapatılmasının repository arayüzleri ve belirteçleri (TS-002 AK-51):
// Oturum kaynağına yalnız yetki kapısından erişir; çekirdek repository'leri kullanmaz (AK-39). Kayıtlar
// yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38); oturum sırrı kaynak
// değildir ve gelmez. Gerçeklemeleri infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import type {
  Kayit,
  Siralama,
} from '../../../../../shared/yetki/okuma-kapisi.js';
import type { OturumKapatmaNedeni } from '../entities/oturum.entity.js';

export interface OturumListeIstegi {
  // Verilirse yalnız o kişinin oturumları.
  readonly kullaniciId?: string;
  // Verilirse yalnız açık (true) ya da yalnız açık olmayan (false) oturumlar; açıklık simdi anına
  // göre ölçülür.
  readonly acik?: boolean;
  readonly simdi: Date;
  readonly siralama: Siralama;
  readonly atla: number;
  readonly al: number;
}

export interface IOturumYonetimOkumaRepo {
  liste(istek: OturumListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const OTURUM_YONETIM_OKUMA_REPO = new RepoBelirteci<
  IOturumYonetimOkumaRepo,
  IOturumYonetimOkumaRepo
>('IOturumYonetimOkumaRepo');

export interface OturumKapatmasi {
  readonly kapatilmaZamani: Date;
  readonly kapatilmaNedeni: OturumKapatmaNedeni;
}

// Oturum kapatmanın yazma repository'si: Oturum kaynağına yalnız yetki kapısından, run'ın işlem
// nesnesiyle yazar (TS-002 AK-19).
export interface IOturumYonetimYazmaRepo {
  // Kapatma niyeti (Oturum:kapat): oturumun satırını yeteneğin şartıyla kilitler ve not bırakır;
  // kapatma verilirse kapatılma zamanını ve nedenini yazar, verilmezse hiçbir kolon yazmaz. Satırı
  // tutan yetenek yoksa bulunamadi.
  kapatNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    kapatma?: OturumKapatmasi,
  ): Promise<void>;
}

// Nest sağlayıcı belirteci: modül gerçeklemeyi bununla sağlar, işleyici bununla enjekte eder.
export const OTURUM_YONETIM_YAZMA_REPO = Symbol('IOturumYonetimYazmaRepo');
