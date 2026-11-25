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

// Formdaki metinlerin gönderimde şarta ve kolon listesine çevrilmesi. Sunucudaki şema da bunları
// kullanır; yenile formu ön doldurmanın kayıpsızlığını aynı çevirmeyle sınar.

type Cevrim<T> = { readonly deger: T } | { readonly hata: string };

export type SartCevrimi =
  | { readonly oge: SartOgesi }
  | { readonly hata: string; readonly girdi: 'alan' | 'deger' };

function sabiteCevir(tur: DegerTuru, metin: string): Cevrim<SabitDeger> {
  const parca = metin.trim();
  if (parca === '') {
    return { hata: 'Değer boş olamaz' };
  }
  if (tur === 'sayi') {
    const sayi = Number(parca);
    return Number.isFinite(sayi) ? { deger: sayi } : { hata: 'Değer sayıya çevrilemiyor' };
  }
  if (tur === 'mantiksal') {
    return parca === 'true' || parca === 'false'
      ? { deger: parca === 'true' }
      : { hata: 'Değer true ya da false olmalı' };
  }
  return { deger: parca };
}

export function sartOgesine(satir: SartSatiri): SartCevrimi {
  const alan = satir.alan.trim();
  if (alan === '') {
    return { hata: 'Alan boş olamaz', girdi: 'alan' };
  }
  const { islec, tur } = satir;
  if (tur === 'yerTutucu') {
    const yerTutucu = YER_TUTUCULAR.find((ad) => ad === satir.deger);
    return yerTutucu === undefined
      ? { hata: 'Yer tutucu seçilmeli', girdi: 'deger' }
      : { oge: { alan, islec, deger: { yerTutucu } } };
  }
  if (!LISTELI_ISLECLER.includes(islec)) {
    const deger = sabiteCevir(tur, satir.deger);
    return 'hata' in deger
      ? { hata: deger.hata, girdi: 'deger' }
      : { oge: { alan, islec, deger: deger.deger } };
  }
  const degerler: SabitDeger[] = [];
  for (const parca of satir.deger.split(',')) {
    const deger = sabiteCevir(tur, parca);
    if ('hata' in deger) {
      return { hata: deger.hata, girdi: 'deger' };
    }
    degerler.push(deger.deger);
  }
  return { oge: { alan, islec, deger: degerler } };
}

// Boş metin null'dır (backend'de boş liste).
export function kolonlaraCevir(metin: string): Cevrim<string[] | null> {
  if (metin.trim() === '') {
    return { deger: null };
  }
  const kolonlar = metin.split(',').map((kolon) => kolon.trim());
  return kolonlar.includes('') ? { hata: 'Kolon adı boş olamaz' } : { deger: kolonlar };
}

// Metne çevrilip geri çevrildiğinde özgün değerini vermeyen şart öğesi düzenlenebilir satır olarak
// açılmaz (TS-004 "Yönetim formlarının sertleştirilmesi"): saklandığı yazımla salt okunur gösterilir,
// gövdeye özgün değeriyle gider ve yalnız çıkarılabilir.
export interface SaklananSatir {
  readonly tur: 'saklanan';
  readonly oge: SartOgesi;
}

export type FormSatiri = SartSatiri | SaklananSatir;

function sabitTuru(deger: SabitDeger): DegerTuru {
  if (typeof deger === 'number') {
    return 'sayi';
  }
  return typeof deger === 'boolean' ? 'mantiksal' : 'metin';
}

function degerEsit(a: SartDegeri, b: SartDegeri): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((oge, sira) => oge === b[sira])
    );
  }
  if (typeof a === 'object' || typeof b === 'object') {
    return typeof a === 'object' && typeof b === 'object' && a.yerTutucu === b.yerTutucu;
  }
  return a === b;
}

function duzenlenebilirSatir({ alan, islec, deger }: SartOgesi): SartSatiri {
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
}

// Metin girdisi değerinden satır sonlarını siler (HTML'in değer temizleme kuralı); sınama, satırın
// girdide duracağı değeri geri çevirir.
function metinGirdisinde(metin: string): string {
  return metin.replace(/[\r\n]/g, '');
}

// Yenile formunun başlangıç satırları: değer türü saklanan değerin tipinden çıkarılır; dizide ilk
// öğenin tipi alınır. Satır geri çevrildiğinde öğeyi aynen vermiyorsa öğe saklanan satır olur.
export function sartSatirlari(sart: readonly SartOgesi[] | null): FormSatiri[] {
  return (sart ?? []).map((oge) => {
    const satir = duzenlenebilirSatir(oge);
    const geri = sartOgesine({
      ...satir,
      alan: metinGirdisinde(satir.alan),
      deger: metinGirdisinde(satir.deger),
    });
    const kayipsiz =
      'oge' in geri &&
      geri.oge.alan === oge.alan &&
      geri.oge.islec === oge.islec &&
      degerEsit(geri.oge.deger, oge.deger);
    return kayipsiz ? satir : { tur: 'saklanan', oge };
  });
}

// Yenile formunun kolon alanı: virgülle yazılıp geri çevrildiğinde aynı listeyi vermeyen liste
// saklanan liste olur ve aynen gider. Boş liste boş metindir.
export function kolonAlani(kolonlar: readonly string[]): {
  readonly kolonlar: string;
  readonly sakliKolonlar: readonly string[] | null;
} {
  const metin = kolonlar.join(', ');
  const geri = kolonlaraCevir(metinGirdisinde(metin));
  const kayipsiz =
    'deger' in geri &&
    (geri.deger ?? []).length === kolonlar.length &&
    (geri.deger ?? []).every((kolon, sira) => kolon === kolonlar[sira]);
  return kayipsiz
    ? { kolonlar: metin, sakliKolonlar: null }
    : { kolonlar: '', sakliKolonlar: kolonlar };
}
