import type { Islem } from '../../../../shared/database/unit-of-work.js';

// Rol kaynağına yazma arayüzü (TS-002 AK-39): yazmalar yalnız yetki kapısından, çağıranın işleminde
// yapılır ve her biri değişiklik kaydı notu bırakır. Sınıf, Nest'te sağlayıcı belirteci olarak da
// kullanılır; gerçeklemesi infrastructure klasöründedir. Yetki kapısının reddi hata olarak atılır.
export abstract class RolYazici {
  // Kodu boş yeni rolün kimliğini döner.
  abstract olustur(islem: Islem, isAdi: string, ad: string): Promise<string>;

  // Görülemeyen ya da var olmayan rol için bulunamadi.
  abstract adDegistir(
    islem: Islem,
    isAdi: string,
    id: string,
    ad: string,
  ): Promise<void>;

  // Yumuşak siler; silinmiş, görülemeyen ya da var olmayan rol için bulunamadi.
  abstract sil(islem: Islem, isAdi: string, id: string): Promise<void>;
}
