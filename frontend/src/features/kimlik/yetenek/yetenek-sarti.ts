// Yeteneğin şartı (TS-004 "Yönetim ekranları"): backend'in kimlik/yetenek sözleşmesindeki biçim ön
// yüzde ayrı yazılır (KR-014). İstemci formu da kullandığı için Zod'suzdur ve sunucu modülü içe
// aktarmaz.

export const ISLECLER = [
  'esit',
  'esit_degil',
  'listede',
  'listede_degil',
  'kucuk',
  'kucuk_esit',
  'buyuk',
  'buyuk_esit',
] as const;
export type Islec = (typeof ISLECLER)[number];

// Listeli işleçlerde değer virgülle ayrılır.
export const LISTELI_ISLECLER: readonly Islec[] = ['listede', 'listede_degil'];

export const YER_TUTUCULAR = ['isteyen', 'yetenek_grubu', 'yetenek_grubu_ve_alti'] as const;
export type YerTutucu = (typeof YER_TUTUCULAR)[number];

export type SabitDeger = string | number | boolean;
export type SartDegeri = SabitDeger | SabitDeger[] | { yerTutucu: YerTutucu };

export interface SartOgesi {
  readonly alan: string;
  readonly islec: Islec;
  readonly deger: SartDegeri;
}

// Formdaki değer türleri; değer metni seçilen türe çevrilir. Mantıksal değer true ya da false
// yazılır.
export const DEGER_TURLERI = ['metin', 'sayi', 'mantiksal', 'yerTutucu'] as const;
export type DegerTuru = (typeof DEGER_TURLERI)[number];

export const DEGER_TURU_ETIKETLERI: Readonly<Record<DegerTuru, string>> = {
  metin: 'Metin',
  sayi: 'Sayı',
  mantiksal: 'Doğru ya da yanlış (true, false)',
  yerTutucu: 'Yer tutucu',
};

// Formun bir şart satırı: değer ekranda yazıldığı metindir; yer tutucu türünde yer tutucunun adıdır.
export interface SartSatiri {
  readonly alan: string;
  readonly islec: Islec;
  readonly tur: DegerTuru;
  readonly deger: string;
}

function sabitTuru(deger: SabitDeger): DegerTuru {
  if (typeof deger === 'number') {
    return 'sayi';
  }
  return typeof deger === 'boolean' ? 'mantiksal' : 'metin';
}

// Yenile formunun başlangıç satırları: değer türü saklanan değerin tipinden çıkarılır; dizide ilk
// öğenin tipi alınır.
export function sartSatirlari(sart: readonly SartOgesi[] | null): SartSatiri[] {
  return (sart ?? []).map(({ alan, islec, deger }) => {
    if (Array.isArray(deger)) {
      const [ilk] = deger;
      return {
        alan,
        islec,
        tur: ilk === undefined ? 'metin' : sabitTuru(ilk),
        deger: deger.map(String).join(', '),
      };
    }
    if (typeof deger === 'object') {
      return { alan, islec, tur: 'yerTutucu', deger: deger.yerTutucu };
    }
    return { alan, islec, tur: sabitTuru(deger), deger: String(deger) };
  });
}
