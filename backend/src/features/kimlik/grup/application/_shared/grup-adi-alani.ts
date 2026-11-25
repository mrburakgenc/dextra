// Grup adı gövde alanının Zod şeması: biçimi (metin) Zod denetler, kuralı değer nesnesi verir; ret,
// alanın yoluyla dogrulama_hatasi olur (TS-005 "Komut ve sorgu").
import { z } from 'zod';
import {
  GRUP_ADI_EN_AZ,
  GRUP_ADI_EN_COK,
  type GrupAdiReddi,
  grupAdi,
} from '../../domain/value-objects/grup-adi.js';

// Her ret kodu Zod'un kendi uzunluk sorununa çevrilir; böylece cevaptaki neden metni, kuralın şemada
// yazıldığı zamanki Zod iletisiyle aynı kalır (HTTP sözleşmesi değişmez; TS-005 Seçenekler 4). Eşleme
// ret kodlarının tamamını adıyla taşır: değer nesnesine eklenen ve burada eşlenmeyen kod derlenmez.
const SORUN: Record<GrupAdiReddi, (ham: string) => z.core.$ZodRawIssue> = {
  kisa: (ham) => ({
    code: 'too_small',
    origin: 'string',
    minimum: GRUP_ADI_EN_AZ,
    inclusive: true,
    input: ham,
  }),
  uzun: (ham) => ({
    code: 'too_big',
    origin: 'string',
    maximum: GRUP_ADI_EN_COK,
    inclusive: true,
    input: ham,
  }),
};

export const grupAdiAlani = z.string().transform((ham, baglam) => {
  const sonuc = grupAdi(ham);
  if (sonuc.tur === 'tamam') {
    return sonuc.deger;
  }
  baglam.issues.push(SORUN[sonuc.neden](ham));
  return z.NEVER;
});
