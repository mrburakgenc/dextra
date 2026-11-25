import { z } from 'zod';

// Liste ekranlarının adres sorgusu (TS-004 "Yönetim ekranları"): sayfa, sıralama ve süzgeç adresin
// sorgusunda durur. Kaynağın kolonları ve süzgeçleri kaynağın kendi dosyasındadır.

// Geçersiz sayfa 1'e döner.
export const sayfaSemasi = z.coerce.number().int().min(1).catch(1);

// Sıralanabilen kolonlar ve azalan karşılıkları (başında '-'); geçersiz değer sıralamasız kalır
// (backend'in varsayılanı).
export function siralamaSemasi<const K extends string>(kolonlar: readonly K[]) {
  return z
    .enum([...kolonlar, ...kolonlar.map((kolon): `-${K}` => `-${kolon}`)])
    .optional()
    .catch(undefined);
}

export type SorguAlanlari = Readonly<Record<string, string | number | undefined>>;

// Dolu alanlar adres sorgusuna verilen sırayla yazılır; hiçbiri dolu değilse boş metin döner.
export function sorguMetni(alanlar: SorguAlanlari): string {
  const parametreler = new URLSearchParams();
  for (const [ad, deger] of Object.entries(alanlar)) {
    if (deger !== undefined) {
      parametreler.set(ad, String(deger));
    }
  }
  const metin = parametreler.toString();
  return metin === '' ? '' : `?${metin}`;
}
