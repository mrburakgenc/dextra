// Yasağın biçimi (TS-008 "Yapı" › "Yasağın biçimi"; KU-020, KU-017): saklanacak bir yetenek satırının
// etkisi ve önceliğiyle tek anlamlı olup olmadığı. Kural depoda yalnız burada yazılır: yazım denetimi
// (yetenek varlığı) bununla reddeder; derleyici de bozuk yasağı bununla tanır.
import { ret, type Sonuc, tamam } from '../../domain/sonuc.js';

// Yazma eylemlerini yalnız (Kök, SuperAdmin) kümesine bağlanabilen kaynaklar (KR-008 Seçim 17;
// TS-002 değişmez 8). Yazma eylemi okuma dışındaki her eylemdir.
const KORUNAN_KAYNAKLAR = ['Grup', 'Rol', 'Uyelik', 'Yetenek'];
const OKUMA_EYLEMI = 'oku';
// Kolon listeli yasak yalnız bu eylemlerde yazılır; oluşturma, silme ve niyet eylemleri kayıt
// düzeyindedir (kapanan AU-10 ve AU-29).
const KOLON_DUZEYI_EYLEMLER = [OKUMA_EYLEMI, 'guncelle'];
// Kimlik kolon yasağıyla kapatılamaz (TS-008 "Tanım").
const KIMLIK_KOLONU = 'id';
const ONCELIK_EN_AZ = 0;
const ONCELIK_EN_COK = 100;

// Satırın biçime bakılan alanları; boş şart ve boş kolon listesi "yok" demektir.
export interface YasakBicimiGirdisi {
  readonly kaynak: string;
  readonly eylem: string;
  readonly sart: readonly unknown[];
  readonly butunKayitlar: boolean;
  readonly kolonlar: readonly string[];
  readonly butunKolonlar: boolean;
  readonly giremez: boolean;
  readonly oncelik: number;
}

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type YasakBicimiReddi =
  | 'oncelik_araligi'
  | 'korunan_kaynak'
  | 'kolon_siniri_yok'
  | 'kayit_siniri_yok'
  | 'kimlik_kolonu'
  | 'kayit_duzeyi_eylemde_kolon';

// Korunan kaynağın yazma eylemi mi.
export function korunanYazmaMi(kaynak: string, eylem: string): boolean {
  return KORUNAN_KAYNAKLAR.includes(kaynak) && eylem !== OKUMA_EYLEMI;
}

// Öncelik her satırda 0–100 arasında tam sayıdır. Yasak yalnız iki biçimde yazılır: kaydın bütünü
// ("bütün kolonlar" işareti) ya da kolon listesi; kayıt sınırı da ya "bütün kayıtlar" işaretidir ya
// şart. İşaret ile içeriğin birlikte yazılması bu kuralın değil, yetenek içeriğinin reddidir. İlk ret
// bu sırayla döner.
export function yasakBicimi(
  satir: YasakBicimiGirdisi,
): Sonuc<void, YasakBicimiReddi> {
  if (
    !Number.isInteger(satir.oncelik) ||
    satir.oncelik < ONCELIK_EN_AZ ||
    satir.oncelik > ONCELIK_EN_COK
  ) {
    return ret('oncelik_araligi');
  }
  if (!satir.giremez) {
    return tamam();
  }
  if (korunanYazmaMi(satir.kaynak, satir.eylem)) {
    return ret('korunan_kaynak');
  }
  if (!satir.butunKolonlar && satir.kolonlar.length === 0) {
    return ret('kolon_siniri_yok');
  }
  if (!satir.butunKayitlar && satir.sart.length === 0) {
    return ret('kayit_siniri_yok');
  }
  if (satir.kolonlar.includes(KIMLIK_KOLONU)) {
    return ret('kimlik_kolonu');
  }
  if (
    satir.kolonlar.length > 0 &&
    !KOLON_DUZEYI_EYLEMLER.includes(satir.eylem)
  ) {
    return ret('kayit_duzeyi_eylemde_kolon');
  }
  return tamam();
}
