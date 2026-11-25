// Kimlik guard'ının her istekte oturumu denetlediği sözleşme; kimlik feature'ı uygular (TS-002 "Yapı").
// Adres karşılaştırması ve uymayan oturumun kapatılması uygulamanın içindedir; çağıran yalnız imzası
// doğrulanmış adres bilgisini verir ve sonucu uygular. Yalnız düz veri taşır.

export interface OturumDenetimiGirdisi {
  readonly oturumId: string;
  readonly ipAdresi: string;
  readonly tarayiciBilgisi: string;
}

// yok: oturum satırı yok ya da genel sayaç satırı yok; kapali: oturum kapatılmış;
// suresi_doldu: mutlak bitiş ya da hareketsizlik sınırı geçmiş; adres_degisti: IP ya da tarayıcı
// bilgisi oturumdakine uymuyor (oturum bu nedenle kapatılır); kullanici_pasif: kişi pasif ya da
// sistem aktörü.
export type OturumGecersizlikNedeni =
  | 'yok'
  | 'kapali'
  | 'suresi_doldu'
  | 'adres_degisti'
  | 'kullanici_pasif';

export type OturumDenetimiSonucu =
  | {
      readonly gecerli: true;
      readonly kullaniciId: string;
      readonly kisiSurumu: number;
      readonly genelSurum: number;
    }
  | { readonly gecerli: false; readonly neden: OturumGecersizlikNedeni };

export interface OturumDenetimi {
  denetle(girdi: OturumDenetimiGirdisi): Promise<OturumDenetimiSonucu>;
}

export const OTURUM_DENETIMI = Symbol('OturumDenetimi');
