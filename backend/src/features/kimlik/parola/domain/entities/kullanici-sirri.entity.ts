// Kullanıcı sırrı varlığı: sırrın bağlantıyla belirlenmesi, değiştirilmesi ve girişte sınanması
// üzerine durum kararları (TS-005 "Sorumluluklar"). Varlık veritabanından doldurulmaz; kararlar
// işleyicinin topladığı olguları alır. Yazılacak hâl, kuraldan geçmiş Parola'nın özetleyiciden (port)
// geçmiş özetidir; özetleme G/Ç olduğu için işleyicide yapılır.
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';

export interface BaglantiDurumu {
  // Kullanıldığı an; kullanılmamışsa null.
  readonly kullanilmaZamani: Date | null;
  readonly sonGecerlilikZamani: Date;
}

export interface ParolaBelirlemeOlgulari<B extends BaglantiDurumu> {
  // Kodun özetiyle bulunan bağlantı; yoksa null.
  readonly baglanti: B | null;
  readonly simdi: Date;
}

export type ParolaBelirlemeReddi = 'baglanti_gecersiz';

// Bağlantı yoksa, kullanılmışsa ya da süresi geçmişse (son geçerlilik anı dahil) parola belirlenmez;
// hangisi olduğu ayrılmaz (KR-009 Seçim 9). Tamam, bağlantıyı değeriyle verir.
export function parolaBelirlemeKarari<B extends BaglantiDurumu>({
  baglanti,
  simdi,
}: ParolaBelirlemeOlgulari<B>): Sonuc<B, ParolaBelirlemeReddi> {
  // Bağlantı yoksa ilk koşul da doğrudur.
  if (
    baglanti?.kullanilmaZamani !== null ||
    baglanti.sonGecerlilikZamani.getTime() <= simdi.getTime()
  ) {
    return ret('baglanti_gecersiz');
  }
  return tamam(baglanti);
}

export interface SirDogrulamaOlgulari<S> {
  // Kişinin saklı sırrı; parolası belirlenmemişse null.
  readonly sir: S | null;
  // Verilen parola saklı özetle doğrulandı mı.
  readonly parolaDogruMu: boolean;
}

export type EskiParolaReddi = 'parola_yok' | 'eski_parola_yanlis';

// Parolası olmayan kişi parolasını değiştiremez; sonra eski parola doğru olmalıdır (TS-002 AK-50).
// Tamam, sırrı değeriyle verir.
export function eskiParolaKarari<S>({
  sir,
  parolaDogruMu,
}: SirDogrulamaOlgulari<S>): Sonuc<S, EskiParolaReddi> {
  if (sir === null) {
    return ret('parola_yok');
  }
  if (!parolaDogruMu) {
    return ret('eski_parola_yanlis');
  }
  return tamam(sir);
}

export interface ParolaDegistirmeOlgulari {
  // Sırrın, eski parola doğrulanırken okunan güncelleme zamanı.
  readonly okunanZaman: Date;
  // Kişinin kilidi altında okunan güncelleme zamanı; sır satırı yoksa null.
  readonly kilitAltindakiZaman: Date | null;
  // İsteği yapan oturum kişinindir ve kapatılmamıştır.
  readonly oturumAcikMi: boolean;
}

export type ParolaDegistirmeReddi = 'sir_degisti' | 'oturum_kapali';

// Sır ilk okunandan beri değiştiyse, sonra isteği yapan oturum kapandıysa parola değişmez (TS-002
// "İşlem sınırları" Parola değiştir; AK-50).
export function parolaDegistirmeKarari({
  okunanZaman,
  kilitAltindakiZaman,
  oturumAcikMi,
}: ParolaDegistirmeOlgulari): Sonuc<void, ParolaDegistirmeReddi> {
  if (kilitAltindakiZaman?.getTime() !== okunanZaman.getTime()) {
    return ret('sir_degisti');
  }
  if (!oturumAcikMi) {
    return ret('oturum_kapali');
  }
  return tamam();
}

export type GirisReddi = 'yanlis';

// Kişi yoksa, parolası belirlenmemişse ya da parola yanlışsa giriş reddedilir; hangisi olduğu ayrılmaz
// (TS-002 AK-15). Tamam, sırrı değeriyle verir.
export function girisKarari<S>({
  sir,
  parolaDogruMu,
}: SirDogrulamaOlgulari<S>): Sonuc<S, GirisReddi> {
  if (sir === null || !parolaDogruMu) {
    return ret('yanlis');
  }
  return tamam(sir);
}

export interface GirisKesinlestirmeOlgulari {
  // Doğrulamanın kanıtı: sırrın doğrulama anındaki güncelleme zamanı (ISO 8601).
  readonly kanit: string;
  // Kişinin kilidi altında okunan güncelleme zamanı; sır satırı yoksa null.
  readonly kilitAltindakiZaman: Date | null;
}

export type GirisKesinlestirmeReddi = 'sir_degisti';

// Sır doğrulamadan beri değiştiyse giriş kesinleşmez (KR-009 Seçim 10).
export function girisKesinlestirmeKarari({
  kanit,
  kilitAltindakiZaman,
}: GirisKesinlestirmeOlgulari): Sonuc<void, GirisKesinlestirmeReddi> {
  return kilitAltindakiZaman?.toISOString() === kanit
    ? tamam()
    : ret('sir_degisti');
}
