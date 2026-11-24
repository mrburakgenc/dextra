// Parola özetleyicisinin arayüzü (TS-002 AK-4). Sınıf, Nest'te sağlayıcı belirteci olarak da
// kullanılır; gerçeklemesi infrastructure klasöründedir.
export abstract class ParolaOzetleyici {
  // Saklanacak dizgeyi üretir; dizge algoritmayı, ayarları ve tuzu da taşır.
  abstract ozetle(parola: string): Promise<string>;

  // Parolayı saklanan dizgedeki ayarlar ve tuzla yeniden özetler, sabit zamanlı karşılaştırır.
  abstract dogrula(parola: string, saklanan: string): Promise<boolean>;
}
