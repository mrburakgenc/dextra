// Kullanıcı alt özelliğinin repository arayüzleri ve belirteçleri: Kullanici kaynağına okuma yetki
// kapısının okuma yüzünden, yazma yazma yüzünden erişir (TS-002 AK-19, AK-39); gerçeklemeleri
// infrastructure/repositories altındadır. Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman
// kimliği taşır (AK-38).
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';
import type { Islem } from '../../../../../shared/database/unit-of-work.js';
import type {
  Kayit,
  Siralama,
} from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { YeniKullanici } from '../entities/kullanici.entity.js';
import type { GorunenAd } from '../value-objects/gorunen-ad.js';

export interface KullaniciListeIstegi {
  // Verilirse yalnız pasif (true) ya da yalnız pasif olmayan (false) kişiler.
  readonly pasif?: boolean;
  readonly siralama?: Siralama;
  readonly atla: number;
  readonly al: number;
}

export interface IKullaniciOkumaRepo {
  liste(istek: KullaniciListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export const KULLANICI_OKUMA_REPO = new RepoBelirteci<
  IKullaniciOkumaRepo,
  IKullaniciOkumaRepo
>('IKullaniciOkumaRepo');

// Yazmalar yalnız çağıranın işleminde, yetki kapısından yapılır ve her biri değişiklik kaydı notu
// bırakır; isAdi notun işin adı alanıdır. Kapı işlemin istemcisini işlem nesnesinden aldığı için yazma
// Registrar'dan değil, işlem nesnesini parametre alan bu arayüzden geçer.
export interface IKullaniciYazmaRepo {
  // Yeni kaydın kimliğini döner; oluşturma yeteneği yoksa ya da alanları kapsamıyorsa yetki_yok.
  olustur(
    islem: Islem,
    isAdi: string,
    kullanici: YeniKullanici,
  ): Promise<string>;

  // Yalnız görünen adı yazar; satırı tutan güncelleme yeteneği yoksa bulunamadi, tutan yetenek
  // görünen adı kapsamıyorsa yetki_yok.
  gorunenAdiDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    gorunenAd: GorunenAd,
  ): Promise<void>;

  // Parola bağlantısı üretme niyeti (Kullanici:parola_baglantisi_uret): hiçbir kolon yazmaz, kişinin
  // satırını yeteneğin şartıyla kilitler ve not bırakır; satırı tutan yetenek yoksa bulunamadi.
  parolaBaglantisiNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
  ): Promise<void>;

  // Pasife alma niyeti (Kullanici:pasife_al): kişinin satırını yeteneğin şartıyla kilitler ve not
  // bırakır; pasif zamanı verilirse onu yazar, verilmezse hiçbir kolon yazmaz. Satırı tutan yetenek
  // yoksa bulunamadi.
  pasifeAlNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    pasifZamani?: Date,
  ): Promise<void>;

  // Yeniden açma niyeti (Kullanici:yeniden_ac): kişinin satırını yeteneğin şartıyla kilitler ve not
  // bırakır; isaretiKaldir doğruysa pasif zamanını boşaltır, değilse hiçbir kolon yazmaz. Satırı
  // tutan yetenek yoksa bulunamadi.
  yenidenAcNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    isaretiKaldir: boolean,
  ): Promise<void>;
}

// Nest sağlayıcı belirteci: modül gerçeklemeyi bununla sağlar, işleyici bununla enjekte eder.
export const KULLANICI_YAZMA_REPO = Symbol('IKullaniciYazmaRepo');
