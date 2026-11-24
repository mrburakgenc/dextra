import 'server-only';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { oturumCerezleriniSil } from '../oturum/cerezler';

// Backend hatalarının tek okunduğu yer (TS-004 Yapı "Hata eşleme"; TS-002 AK-11).
// Backend'in hata gövdesi { kod, ileti, ayrinti } biçimindedir; durum HTTP durumudur.
export interface BackendHatasi {
  readonly kod: string;
  readonly ileti: string;
  readonly ayrinti: unknown;
  readonly durum: number;
}

const hataGovdesi = z.object({
  kod: z.string(),
  ileti: z.string(),
  ayrinti: z.unknown(),
});

// dogrulama_hatasi ayrıntısı: alan ve neden çiftlerinin listesi.
const dogrulamaAyrintisi = z.array(
  z.object({ alan: z.string(), neden: z.string() }),
);

// Biçimi tanınmayan hata gövdesi beklenmeyen hatadır; gövdenin içeriği iletiye taşınmaz.
export function hataGovdesiniOku(govde: unknown, durum: number): BackendHatasi {
  const sonuc = hataGovdesi.safeParse(govde);
  if (!sonuc.success) {
    return {
      kod: 'beklenmeyen_hata',
      ileti: 'Beklenmeyen bir hata oluştu',
      ayrinti: null,
      durum,
    };
  }
  const { kod, ileti, ayrinti } = sonuc.data;
  return { kod, ileti, ayrinti, durum };
}

// dogrulama_hatasi için alan adından iletiye eşleme; aynı alanın ilk iletisi kalır.
// Başka kodlarda ya da ayrıntı tanınmazsa boş döner.
export function alanHatalari(hata: BackendHatasi): Record<string, string> {
  if (hata.kod !== 'dogrulama_hatasi') {
    return {};
  }
  const sonuc = dogrulamaAyrintisi.safeParse(hata.ayrinti);
  if (!sonuc.success) {
    return {};
  }
  const alanlar: Record<string, string> = {};
  for (const { alan, neden } of sonuc.data) {
    alanlar[alan] ??= neden;
  }
  return alanlar;
}

// kimlik_gerekli (401) gelince oturum çerezleri silinir ve giriş ekranına dönülür
// (TS-004 Değişmez 5); başka kodlarda bir şey yapmaz. Çerez silme çatının kuralı gereği
// yalnız Server Action ya da Route Handler içinde çalışır.
export async function kimlikGerekliyseGiriseDon(
  hata: BackendHatasi,
): Promise<void> {
  if (hata.kod !== 'kimlik_gerekli') {
    return;
  }
  await oturumCerezleriniSil();
  redirect('/giris');
}
