export interface DonguAyari {
  // Döngünün yürüttüğü iş; ne yaptığını döngü bilmez. true dönerse beklemeden yeniden çağrılır,
  // false dönerse boşta bekleme kadar beklenir, hata atarsa artan aralıkla beklenir.
  adim: () => Promise<boolean>;
  bosBeklemeMs: number;
  hataBeklemeTabanMs: number;
  hataBeklemeUstMs: number;
}

// Bir adımı zamanlayıcıyla yineleyen döngü. Aynı anda en çok bir adım koşar.
// Hata atan adımın ardından bekleme her ardışık hatada ikiye katlanır, üst sınırda durur;
// başarılı adım sayacı sıfırlar.
export class Dongu {
  private zamanlayici: NodeJS.Timeout | undefined;
  private surenAdim: Promise<void> | undefined;
  private calisiyor = false;
  private ardisikHata = 0;

  constructor(private readonly ayar: DonguAyari) {}

  baslat(): void {
    if (this.calisiyor) {
      return;
    }
    this.calisiyor = true;
    this.planla(0);
  }

  // Bekleyen zamanlayıcıyı kaldırır ve süren adımın bitmesini bekler; döndükten sonra açık
  // zamanlayıcı kalmaz ve yeni adım başlamaz.
  async durdur(): Promise<void> {
    this.calisiyor = false;
    clearTimeout(this.zamanlayici);
    this.zamanlayici = undefined;
    await this.surenAdim;
  }

  private planla(beklemeMs: number): void {
    this.zamanlayici = setTimeout(() => {
      this.zamanlayici = undefined;
      this.surenAdim = this.adimKos();
    }, beklemeMs);
  }

  private async adimKos(): Promise<void> {
    let beklemeMs: number;
    try {
      const hemenYeniden = await this.ayar.adim();
      this.ardisikHata = 0;
      beklemeMs = hemenYeniden ? 0 : this.ayar.bosBeklemeMs;
    } catch {
      // Hatanın kendisi adımın işidir; döngü yalnız bekler (TS-003 sözleşme 4).
      beklemeMs = Math.min(
        this.ayar.hataBeklemeTabanMs * 2 ** this.ardisikHata,
        this.ayar.hataBeklemeUstMs,
      );
      this.ardisikHata += 1;
    }
    if (this.calisiyor) {
      this.planla(beklemeMs);
    }
  }
}
