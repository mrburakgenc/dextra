// Formun Server Action'dan aldığı durum: genel hata formun üstünde, alan hataları alanın
// yanında gösterilir. Başarıda Server Action yönlendirdiği için başarı durumu yoktur.
// İstemci formları bunu içe aktardığı için Zod'suz ayrı dosyadadır; Zod istemci paketine girmez.
// Hata dönen form yazılanı korur (TS-004 "Yönetim formlarının sertleştirilmesi"): iş, gönderilen
// değerleri de döndürür ve alanlar o değerlerle açılır. Çatı, işi biten formun denetimsiz alanlarını
// sıfırladığı için bu açıkça yapılır.
export interface FormDurumu {
  readonly genelHata: string | null;
  readonly alanHatalari: Readonly<Record<string, string>>;
  readonly degerler?: Readonly<Record<string, string>>;
}

export const BOS_FORM_DURUMU: FormDurumu = { genelHata: null, alanHatalari: {} };

export function gonderilenDegerler(form: FormData, adlar: readonly string[]): Record<string, string> {
  const degerler: Record<string, string> = {};
  for (const ad of adlar) {
    const deger = form.get(ad);
    if (typeof deger === 'string') {
      degerler[ad] = deger;
    }
  }
  return degerler;
}

// Kullanıcı işlerinin durumu: başarıda yönlendirme yoktur. Üretilen parola belirleme adresi
// yalnız bu durumda, bellekte taşınır; adrese, çereze ya da tarayıcı deposuna yazılmaz ve sayfa
// yenilenince kaybolur (TS-004 "Yönetim ekranları").
export interface KullaniciIsDurumu extends FormDurumu {
  readonly parolaAdresi: string | null;
}

export const BOS_KULLANICI_IS_DURUMU: KullaniciIsDurumu = {
  ...BOS_FORM_DURUMU,
  parolaAdresi: null,
};
