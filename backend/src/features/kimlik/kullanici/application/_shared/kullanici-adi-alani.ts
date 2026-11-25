// Kullanıcı adı gövde alanının Zod şeması: biçimi (metin) Zod denetler, kuralı değer nesnesi verir;
// ret, alanın yoluyla dogrulama_hatasi olur (TS-005 "Komut ve sorgu", Seçenekler 4).
import { z } from 'zod';
import {
  KULLANICI_ADI_DESENI,
  type KullaniciAdiReddi,
  kullaniciAdi,
} from '../../domain/value-objects/kullanici-adi.js';

// Her ret kodu Zod'un kendi desen sorununa çevrilir; böylece cevaptaki neden metni, kuralın şemada
// yazıldığı zamanki Zod iletisiyle aynı kalır (HTTP sözleşmesi değişmez). Eşlemesi olmayan ret kodu
// derlenmez.
const SORUNLAR: Record<
  KullaniciAdiReddi,
  (ham: string) => z.core.$ZodRawIssue
> = {
  desene_uymuyor: (ham) => ({
    code: 'invalid_format',
    format: 'regex',
    origin: 'string',
    pattern: KULLANICI_ADI_DESENI.toString(),
    input: ham,
  }),
};

export const kullaniciAdiAlani = z.string().transform((ham, baglam) => {
  const sonuc = kullaniciAdi(ham);
  if (sonuc.tur === 'tamam') {
    return sonuc.deger;
  }
  baglam.issues.push(SORUNLAR[sonuc.neden](ham));
  return z.NEVER;
});
