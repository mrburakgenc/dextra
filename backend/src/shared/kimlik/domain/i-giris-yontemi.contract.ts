// Giriş yöntemi sözleşmesinin sonuç tipleri; yöntemin kendisi application/i-giris-yontemi.port.ts'tedir.

// Doğrulamanın kanıtı düz veridir: parolada sırrın doğrulama anındaki güncelleme zamanı, kodda kod
// satırının kimliği. Kesinleştirme onu kişinin kilidi altında yeniden sınar.
export type GirisDogrulamaSonucu =
  | {
      readonly sonuc: 'tamam';
      readonly kullaniciId: string;
      readonly kanit: string;
    }
  | { readonly sonuc: 'yanlis' | 'kilitli' | 'kapali' };

export type GirisKesinlestirmeSonucu = 'tamam' | 'gecersiz';
