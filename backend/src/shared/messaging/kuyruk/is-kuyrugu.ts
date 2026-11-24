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

export interface IsKuyrugu {
  // Aynı kimlikle konan iş, ilki kuyrukta dururken yeni iş üretmez.
  koy(kuyruk: string, is: KuyrukIsi): Promise<void>;
  dinle(kuyruk: string, isleyici: IsIsleyici): Promise<Dinleyici>;
  basarisizSayisi(kuyruk: string): Promise<number>;
}

// Arayüz bu belirteçle enjekte edilir.
export const IS_KUYRUGU = Symbol('IS_KUYRUGU');
