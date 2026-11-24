// Formun Server Action'dan aldığı durum: genel hata formun üstünde, alan hataları alanın
// yanında gösterilir. Başarıda Server Action yönlendirdiği için başarı durumu yoktur.
// İstemci formları bunu içe aktardığı için Zod'suz ayrı dosyadadır; Zod istemci paketine girmez.
export interface FormDurumu {
  readonly genelHata: string | null;
  readonly alanHatalari: Readonly<Record<string, string>>;
}

export const BOS_FORM_DURUMU: FormDurumu = { genelHata: null, alanHatalari: {} };
