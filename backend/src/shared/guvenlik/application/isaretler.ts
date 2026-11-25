// Uç işaretleri (TS-002 AK-12; KR-008 Seçim 46): her uç şu üç işaretten tam birini taşır.
// herkese_acik: oturum istenmez; yalniz_kendisi: oturum gerekir, yetenek aranmaz;
// izin: oturum ve (kaynak, eylem) yeteneği gerekir.
// İşaretler ucun metoduna bir dizi olarak yazılır; aynı uçtaki her işaret diziye eklenir, böylece
// işaretsiz uç boş dizi, birden çok işaretli uç birden uzun dizi okunur.

export const ISARET_ANAHTARI = 'guvenlik:isaretler';

export type Isaret =
  | { readonly tur: 'herkese_acik' }
  | { readonly tur: 'yalniz_kendisi' }
  | { readonly tur: 'izin'; readonly kaynak: string; readonly eylem: string };

// Ucun metoduna yazılmış işaretler, yazıldıkları sırayla; işaret yoksa boş dizi.
export function isaretleriOku(isleyici: object): readonly Isaret[] {
  return (
    (Reflect.getOwnMetadata(ISARET_ANAHTARI, isleyici) as
      | readonly Isaret[]
      | undefined) ?? []
  );
}

function isaretle(isaret: Isaret): MethodDecorator {
  return (_hedef, _ad, tanim) => {
    const isleyici = tanim.value as object;
    // Dekoratörler alttan üste uygulanır; diziye başa eklenince sıra yazıldığı gibi kalır.
    Reflect.defineMetadata(
      ISARET_ANAHTARI,
      [isaret, ...isaretleriOku(isleyici)],
      isleyici,
    );
  };
}

export const HerkeseAcik = (): MethodDecorator =>
  isaretle({ tur: 'herkese_acik' });

export const YalnizKendisi = (): MethodDecorator =>
  isaretle({ tur: 'yalniz_kendisi' });

export const Izin = (kaynak: string, eylem: string): MethodDecorator =>
  isaretle({ tur: 'izin', kaynak, eylem });
