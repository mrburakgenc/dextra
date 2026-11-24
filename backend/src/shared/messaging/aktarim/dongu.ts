import { Logger } from '@nestjs/common';

export interface DonguAyari {
  // Döngünün yürüttüğü iş; ne yaptığını döngü bilmez. true dönerse beklemeden yeniden çağrılır,
  // false dönerse boşta bekleme kadar beklenir, hata atarsa artan aralıkla beklenir.
  adim: () => Promise<boolean>;
  bosBeklemeMs: number;
  hataBeklemeTabanMs: number;
  hataBeklemeUstMs: number;
  // Günlük iletisinde döngüyü ayırt eden ad; verilmezse "Dongu".
  ad?: string;
}

export interface DonguHataDurumu {
  // Son hata atan adımın hatasının sınıfı (Error ise adı, değilse türü); hiç hata olmadıysa undefined.
  // Başarılı adımdan sonra da okunur kalır.
  sonHataSinifi: string | undefined;
  // Ardışık hata sayısı; başarılı adım sıfırlar.
  ardisikHata: number;
}

// Bir adımı zamanlayıcıyla yineleyen döngü. Hangi sırayla başlatılıp durdurulursa durdurulsun aynı
// anda en çok bir adım koşar ve en çok bir zamanlayıcı bekler.
// Hata atan adımın ardından bekleme her ardışık hatada ikiye katlanır, üst sınırda durur;
// başarılı adım sayacı sıfırlar.
export class Dongu {
  private readonly gunluk = new Logger(Dongu.name);
  private zamanlayici: NodeJS.Timeout | undefined;
  private surenAdim: Promise<void> | undefined;
  private adimSuruyor = false;
  private calisiyor = false;
  private ardisikHata = 0;
  private sonHataSinifi: string | undefined;

  constructor(private readonly ayar: DonguAyari) {}

  // Durdurmanın sözü beklenmeden yeniden başlatılırsa süren adım bitince zinciri kendisi sürdürür;
  // ikinci bir zincir kurulmaz.
  baslat(): void {
    if (this.calisiyor) {
      return;
    }
    this.calisiyor = true;
    if (!this.adimSuruyor) {
      this.planla(0);
    }
  }

  // Bekleyen zamanlayıcıyı kaldırır ve süren adımın bitmesini bekler; döndükten sonra açık
  // zamanlayıcı kalmaz ve yeni adım başlamaz (arada yeniden başlatılmadıysa).
  async durdur(): Promise<void> {
    this.calisiyor = false;
    clearTimeout(this.zamanlayici);
    this.zamanlayici = undefined;
    await this.surenAdim;
  }

  hataDurumu(): DonguHataDurumu {
    return {
      sonHataSinifi: this.sonHataSinifi,
      ardisikHata: this.ardisikHata,
    };
  }

  private planla(beklemeMs: number): void {
    this.zamanlayici = setTimeout(() => {
      this.zamanlayici = undefined;
      this.adimSuruyor = true;
      this.surenAdim = this.adimKos();
    }, beklemeMs);
  }

  private async adimKos(): Promise<void> {
    let beklemeMs: number;
    try {
      const hemenYeniden = await this.ayar.adim();
      this.ardisikHata = 0;
      beklemeMs = hemenYeniden ? 0 : this.ayar.bosBeklemeMs;
    } catch (hata) {
      // Hatanın kendisi adımın işidir; döngü bekler, hatayı okunur kılar ve günlüğe yazar
      // (TS-003 sözleşme 4).
      beklemeMs = Math.min(
        this.ayar.hataBeklemeTabanMs * 2 ** this.ardisikHata,
        this.ayar.hataBeklemeUstMs,
      );
      this.ardisikHata += 1;
      this.hatayiYaz(hata, beklemeMs);
    }
    this.adimSuruyor = false;
    if (this.calisiyor) {
      this.planla(beklemeMs);
    }
  }

  // İleti yalnız döngünün adını, hatanın sınıfını ve varsa kodunu taşır; hatanın metni ve nedeni
  // gövdedeki değeri taşıyabildiği için yazılmaz.
  private hatayiYaz(hata: unknown, beklemeMs: number): void {
    this.sonHataSinifi = hata instanceof Error ? hata.name : typeof hata;
    const kod = (hata as { code?: unknown } | null)?.code;
    const kodMetni = typeof kod === 'string' ? `, kod ${kod}` : '';
    this.gunluk.error(
      `${this.ayar.ad ?? Dongu.name}: adım hata verdi (${this.sonHataSinifi}${kodMetni}); ` +
        `ardışık ${String(this.ardisikHata)}. hata, ${String(beklemeMs)} ms sonra yeniden denenecek`,
    );
  }
}
