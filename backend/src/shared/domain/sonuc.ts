// Domain işlevlerinin dönüş tipi: ya "tamam" (varsa değeriyle) ya adlı bir "ret"; domain hata atmaz,
// reddi çağıran (işleyici) kendi hatasına çevirir (TS-005 Değişmez 1).
export type Sonuc<T, R> =
  | { readonly tur: 'tamam'; readonly deger: T }
  | { readonly tur: 'ret'; readonly neden: R };

// Değersiz "tamam" karar işlevleri içindir; değerli olan, kuralından geçmiş değeri taşır.
export function tamam(): Sonuc<void, never>;
export function tamam<T>(deger: T): Sonuc<T, never>;
export function tamam<T>(deger?: T): Sonuc<T | undefined, never> {
  return { tur: 'tamam', deger };
}

export function ret<R>(neden: R): Sonuc<never, R> {
  return { tur: 'ret', neden };
}
