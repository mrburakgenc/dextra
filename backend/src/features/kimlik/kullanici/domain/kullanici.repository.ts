// Kullanıcı yönetiminin okuma repository'si: Kullanici kaynağına yalnız yetki kapısından erişir (TS-002
// AK-19, AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
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

export interface YeniKullanici {
  readonly kullaniciAdi: string;
  readonly gorunenAd: string;
}

// Kullanıcı yönetiminin yazma repository'si: Kullanici kaynağına yalnız yetki kapısından, run'ın
// işlem nesnesiyle yazar (TS-002 AK-19). Kapı işlemin istemcisini işlem nesnesinden aldığı için yazma
// Registrar'dan değil, işlem nesnesini parametre alan bu arayüzden geçer.
export abstract class KullaniciYazmaRepo {
  // Yeni kaydın kimliğini döner; oluşturma yeteneği yoksa ya da alanları kapsamıyorsa yetki_yok.
  abstract olustur(
    islem: Islem,
    isAdi: string,
    kullanici: YeniKullanici,
  ): Promise<string>;

  // Yalnız görünen adı yazar; satırı tutan güncelleme yeteneği yoksa bulunamadi, tutan yetenek
  // görünen adı kapsamıyorsa yetki_yok.
  abstract gorunenAdiDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    gorunenAd: string,
  ): Promise<void>;

  // Parola bağlantısı üretme niyeti (Kullanici:parola_baglantisi_uret): hiçbir kolon yazmaz, kişinin
  // satırını yeteneğin şartıyla kilitler ve not bırakır; satırı tutan yetenek yoksa bulunamadi.
  abstract parolaBaglantisiNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
  ): Promise<void>;

  // Pasife alma niyeti (Kullanici:pasife_al): kişinin satırını yeteneğin şartıyla kilitler ve not
  // bırakır; pasif zamanı verilirse onu yazar, verilmezse hiçbir kolon yazmaz. Satırı tutan yetenek
  // yoksa bulunamadi.
  abstract pasifeAlNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    pasifZamani?: Date,
  ): Promise<void>;

  // Yeniden açma niyeti (Kullanici:yeniden_ac): kişinin satırını yeteneğin şartıyla kilitler ve not
  // bırakır; isaretiKaldir doğruysa pasif zamanını boşaltır, değilse hiçbir kolon yazmaz. Satırı
  // tutan yetenek yoksa bulunamadi.
  abstract yenidenAcNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    isaretiKaldir: boolean,
  ): Promise<void>;
}

export const KULLANICI_REPO = new RepoBelirteci<
  KullaniciOkumaRepo,
  KullaniciOkumaRepo
>('KullaniciRepo');
