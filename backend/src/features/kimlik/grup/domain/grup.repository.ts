// Grup yönetiminin okuma repository'si: Grup kaynağına yalnız yetki kapısından erişir (TS-002 AK-19,
// AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38).
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
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

export interface YeniGrup {
  readonly ad: string;
  readonly ustGrupId: string;
}

// Grup yönetiminin yazma repository'si: Grup kaynağına yalnız yetki kapısından, run'ın işlem
// nesnesiyle yazar (TS-002 AK-19). Kapı işlemin istemcisini işlem nesnesinden aldığı için yazma
// Registrar'dan değil, işlem nesnesini parametre alan bu arayüzden geçer.
export abstract class GrupYazmaRepo {
  // Yeni kaydın kimliğini döner; yeni satırı gören oluşturma yeteneği yoksa yetki_yok.
  abstract olustur(islem: Islem, isAdi: string, grup: YeniGrup): Promise<string>;

  // Yalnız adı yazar; satırı tutan güncelleme yeteneği yoksa bulunamadi.
  abstract adiniDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: string,
  ): Promise<void>;

  // Üst grubu niyet eylemiyle (Grup:tasi) yazar; satırı tutan yetenek yoksa bulunamadi.
  abstract tasi(
    islem: Islem,
    isAdi: string,
    id: string,
    ustGrupId: string,
  ): Promise<void>;

  // Yumuşak siler (Grup:sil); canlı ve tutan yetenekle görülen satır yoksa bulunamadi.
  abstract sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}
