// Yetenek yönetiminin okuma repository'si: Yetenek kaynağına yalnız yetki kapısından erişir (TS-002
// AK-19, AK-39). Kayıtlar yalnız isteyenin görebildiği kolonları ve her zaman kimliği taşır (AK-38);
// şart ve kolon listesi saklandığı biçimde gelir.
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type { SartOgesi } from '../../../../shared/kimlik/yetki-verisi.contract.js';
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

// Yazma işinin run içindeki okumaları; ikisi de yetki kapısından, isteyenin okuma yeteneğiyle.
export interface YetenekRepo extends YetenekOkumaRepo {
  // İzin kaynağından o kimlikteki kayıt; görülemiyor ya da yoksa undefined.
  izin(id: string): Promise<Kayit | undefined>;
}

export const YETENEK_REPO = new RepoBelirteci<YetenekOkumaRepo, YetenekRepo>(
  'YetenekRepo',
);

// Yazılacak yetenek satırı; boş şart ve boş kolon listesi null'dır (KR-008 Seçim 5 ve 11).
export interface YeniYetenek {
  readonly grupId: string;
  readonly rolId: string;
  readonly izinId: string;
  readonly sart: readonly SartOgesi[] | null;
  readonly butunKayitlar: boolean;
  readonly butunBirimler: boolean;
  readonly kolonlar: readonly string[] | null;
  readonly butunKolonlar: boolean;
}

// Yetenek yönetiminin yazma repository'si: Yetenek kaynağına yalnız yetki kapısından, run'ın işlem
// nesnesiyle yazar (TS-002 AK-19). Güncelleme metodu yoktur: satır yerinde düzenlenmez (değişmez 6).
export abstract class YetenekYazmaRepo {
  // Köken 'yonetici' yazılır; yeni kaydın kimliğini döner.
  abstract olustur(
    islem: Islem,
    isAdi: string,
    yetenek: YeniYetenek,
  ): Promise<string>;

  // Yumuşak silme; satırı tutan silme yeteneği yoksa ya da satır zaten silinmişse bulunamadi.
  abstract sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}
