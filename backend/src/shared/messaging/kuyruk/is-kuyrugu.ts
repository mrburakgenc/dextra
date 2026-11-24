// İş kuyruğu kapısı. Ortak kod ve feature'lar kuyruğu yalnız bu arayüzden görür; gerçekleyen
// bağdaştırıcı ve kuyruk paketi bu klasörde kalır (KR-012 Seçim 1).

// Kuyruğa konan iş. Veri düz veridir: JSON'a çevrilip geri okunabilen değerler taşır.
export interface KuyrukIsi {
  readonly kimlik: string;
  readonly ad: string;
  readonly veri: Readonly<Record<string, unknown>>;
}

// Hata atarsa iş yeniden denenir.
export type IsIsleyici = (is: KuyrukIsi) => Promise<void>;

export interface Dinleyici {
  kapat(): Promise<void>;
}

// Kapının kabul etmediği iş kimliğinde koy() bu hatayı atar.
export class GecersizIsKimligiHatasi extends Error {
  constructor() {
    super(
      'Kuyruk işinin kimliği yalnız rakamlardan oluşamaz ve iki nokta (:) içeremez',
    );
    this.name = 'GecersizIsKimligiHatasi';
  }
}

export interface IsKuyrugu {
  // Aynı kimlikle konan iş, ilki kuyrukta dururken yeni iş üretmez.
  // Kimlik kısıtı: yalnız rakamlardan oluşan ("123") ya da iki nokta (:) içeren kimlik kabul
  // edilmez; koy() GecersizIsKimligiHatasi atar ve iş kuyruğa konmaz.
  koy(kuyruk: string, is: KuyrukIsi): Promise<void>;
  dinle(kuyruk: string, isleyici: IsIsleyici): Promise<Dinleyici>;
  basarisizSayisi(kuyruk: string): Promise<number>;
}

// Arayüz bu belirteçle enjekte edilir.
export const IS_KUYRUGU = Symbol('IS_KUYRUGU');
