// Kişinin açık oturum sınırı: bir kişinin birden çok oturumuna bakan saf kural (TS-005 "Yapı":
// services).

// Kişinin en çok bu kadar açık oturumu olur; aşan girişte en eskisi kapanır (TS-002 AK-9; KR-009
// varsayılanı). Proje ayarı sonra gelir.
export const EN_COK_ACIK_OTURUM = 3;

// Girişte yeni oturum açılmadan önce kapanacak oturumlar. Açık oturumlar en eskisi önce verilir;
// yenisiyle birlikte sınırı aşmayacak kadar en eski oturum seçilir.
export function sinirdaKapanacaklar(acik: readonly string[]): string[] {
  return acik.slice(0, Math.max(0, acik.length - (EN_COK_ACIK_OTURUM - 1)));
}
