// Tarih ve paranın tek biçimlendiği yer (KR-014; TS-004 Yapı). Ekranlar kendi başına
// biçimlemez; bu klasör dışındaki biçimleme çağrılarını lint reddeder.

const SAAT_DILIMI = 'Europe/Istanbul';

const tarihBicimi = new Intl.DateTimeFormat('tr-TR', {
  timeZone: SAAT_DILIMI,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const tarihSaatBicimi = new Intl.DateTimeFormat('tr-TR', {
  timeZone: SAAT_DILIMI,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const paraBicimi = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
});

// an: Date ya da backend'in döndürdüğü ISO 8601 metni.
export function tarih(an: Date | string): string {
  return tarihBicimi.format(new Date(an));
}

export function tarihSaat(an: Date | string): string {
  return tarihSaatBicimi.format(new Date(an));
}

// kurus: kuruş cinsinden tam sayı.
export function para(kurus: number): string {
  return paraBicimi.format(kurus / 100);
}
