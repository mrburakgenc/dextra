// Grup alt özelliğinin repository arayüzleri ve belirteçleri: Grup kaynağına yalnız yetki kapısından
// erişilir; okuma okuma yüzünden, yazma yazma yüzünden geçer (TS-002 AK-19, AK-39). Gerçeklemeleri
// infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import type {
  Kayit,
  Siralama,
} from '../../../../../shared/yetki/okuma-kapisi.js';
import type { YeniGrup } from '../entities/grup.entity.js';
import type { GrupAdi } from '../value-objects/grup-adi.js';

export interface GrupListeIstegi {
  // Verilirse yalnız bu grubun doğrudan altındaki gruplar.
  readonly ustGrupId?: string;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

// Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
export interface IGrupOkumaRepo {
  liste(istek: GrupListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const GRUP_OKUMA_REPO = new RepoBelirteci<
  IGrupOkumaRepo,
  IGrupOkumaRepo
>('IGrupOkumaRepo');

// Grup kaynağına yalnız yetki kapısından, run'ın işlem nesnesiyle yazılır (TS-002 AK-19). Kapı işlemin
// istemcisini işlem nesnesinden aldığı için yazma Registrar'dan değil, işlem nesnesini parametre alan
// bu arayüzden geçer; isAdi kapının notunun işin adı alanıdır.
export interface IGrupYazmaRepo {
  // Yeni kaydın kimliğini döner; yeni satırı gören oluşturma yeteneği yoksa yetki_yok.
  olustur(islem: Islem, isAdi: string, grup: YeniGrup): Promise<string>;

  // Yalnız adı yazar; satırı tutan güncelleme yeteneği yoksa bulunamadi.
  adiniDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: GrupAdi,
  ): Promise<void>;

  // Üst grubu niyet eylemiyle (Grup:tasi) yazar; satırı tutan yetenek yoksa bulunamadi.
  tasi(
    islem: Islem,
    isAdi: string,
    id: string,
    ustGrupId: string,
  ): Promise<void>;

  // Yumuşak siler (Grup:sil); canlı ve tutan yetenekle görülen satır yoksa bulunamadi.
  sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}

// Nest sağlayıcı belirteci: modül gerçeklemeyi bununla sağlar, işleyici bununla enjekte eder.
export const GRUP_YAZMA_REPO = Symbol('IGrupYazmaRepo');
