// Rol adı gövde alanının Zod şeması: biçimi (metin) Zod denetler, kuralı değer nesnesi verir; ret,
// alanın yoluyla dogrulama_hatasi olur (TS-005 "Komut ve sorgu").
import { z } from 'zod';
import {
  ROL_ADI_EN_AZ,
  ROL_ADI_EN_COK,
  rolAdi,
} from '../../domain/value-objects/rol-adi.js';

// Ret kodu Zod'un kendi uzunluk sorununa çevrilir; böylece cevaptaki neden metni, kuralın şemada
// yazıldığı zamanki Zod iletisiyle aynı kalır (HTTP sözleşmesi değişmez).
export const rolAdiAlani = z.string().transform((ham, baglam) => {
  const sonuc = rolAdi(ham);
  if (sonuc.tur === 'tamam') {
    return sonuc.deger;
  }
  baglam.issues.push(
    sonuc.neden === 'kisa'
      ? {
          code: 'too_small',
          origin: 'string',
          minimum: ROL_ADI_EN_AZ,
          inclusive: true,
          input: ham,
        }
      : {
          code: 'too_big',
          origin: 'string',
          maximum: ROL_ADI_EN_COK,
          inclusive: true,
          input: ham,
        },
  );
  return z.NEVER;
});
