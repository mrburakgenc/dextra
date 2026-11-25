// Oturumların listelenmesi ve kapatılmasının repository'si (TS-002 AK-51): Oturum kaynağına yalnız
// yetki kapısından erişir; çekirdek repository'leri kullanmaz (AK-39). Kayıtlar yalnız isteyenin
// görebildiği kolonları ve her zaman kimliği taşır (AK-38); oturum sırrı kaynak değildir ve gelmez.
import { RepoBelirteci } from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type { Kayit, Siralama } from '../../../../shared/yetki/okuma-kapisi.js';

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

export interface OturumYonetimOkumaRepo {
  liste(istek: OturumListeIstegi): Promise<Kayit[]>;
  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  tek(id: string): Promise<Kayit>;
}

export interface OturumKapatmasi {
  readonly kapatilmaZamani: Date;
  readonly kapatilmaNedeni: 'sahibi_kapatti' | 'yonetici';
}

// Oturum kapatmanın yazma repository'si: Oturum kaynağına yalnız yetki kapısından, run'ın işlem
// nesnesiyle yazar (TS-002 AK-19).
export abstract class OturumYonetimYazmaRepo {
  // Kapatma niyeti (Oturum:kapat): oturumun satırını yeteneğin şartıyla kilitler ve not bırakır;
  // kapatma verilirse kapatılma zamanını ve nedenini yazar, verilmezse hiçbir kolon yazmaz. Satırı
  // tutan yetenek yoksa bulunamadi.
  abstract kapatNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    kapatma?: OturumKapatmasi,
  ): Promise<void>;
}

export const OTURUM_YONETIM_REPO = new RepoBelirteci<
  OturumYonetimOkumaRepo,
  OturumYonetimOkumaRepo
>('OturumYonetimRepo');
