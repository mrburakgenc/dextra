// Parola gövde alanının Zod şeması: biçimi (metin) Zod denetler, kuralı değer nesnesi verir; ret,
// alanın yoluyla dogrulama_hatasi olur (TS-005 "Komut ve sorgu").
import { z } from 'zod';
import {
  PAROLA_EN_AZ_KOD_NOKTASI,
  PAROLA_EN_COK_KOD_NOKTASI,
  parola,
  type ParolaReddi,
} from '../../domain/value-objects/parola.js';

// Her ret kodunun Zod sorunundaki iletisi; kod eklenip burada eşlenmezse derlenmez. İletiler, kuralın
// şemada refine ile yazıldığı zamanki iletilerdir (HTTP sözleşmesi değişmez).
const RET_ILETISI: Record<ParolaReddi, string> = {
  kisa: `Parola en az ${String(PAROLA_EN_AZ_KOD_NOKTASI)} karakter olmalı`,
  uzun: `Parola en çok ${String(PAROLA_EN_COK_KOD_NOKTASI)} karakter olabilir`,
};

// Ret kodu, refine'ın ürettiği custom sorunla aynı biçimde Zod'a verilir.
export const parolaAlani = z.string().transform((ham, baglam) => {
  const sonuc = parola(ham);
  if (sonuc.tur === 'tamam') {
    return sonuc.deger;
  }
  baglam.issues.push({
    code: 'custom',
    message: RET_ILETISI[sonuc.neden],
    input: ham,
  });
  return z.NEVER;
});
