import type { Islem } from '../../database/domain/islem.js';

// Tohum göçü: adını ve koşucunun açtığı işlemi alan uygulama işlevi (TS-002 AK-1).
export type TohumGocu = (ad: string, islem: Islem) => Promise<void>;

// Göç adı: tarih ve saat damgası, feature ve konu (YYYYAAGGSSDD-<feature>-<konu>; TS-002 AK-24).
const GOC_ADI = /^\d{12}-[a-z]+(-[a-z]+)+$/;

// Tohum göçlerinin süreç içi kaydı. Göçler, modüllerin kurulma sırasına bağlı kalmasın diye
// bildirim sırasıyla değil ada göre sıralı uygulanır (TS-002 AK-24); ad tekildir.
export class TohumDefteri {
  private readonly gocler = new Map<string, TohumGocu>();

  bildir(ad: string, goc: TohumGocu): void {
    if (!GOC_ADI.test(ad)) {
      throw new Error(
        `${ad} tohum göçünün adı YYYYAAGGSSDD-<feature>-<konu> biçiminde değil`,
      );
    }
    if (this.gocler.has(ad)) {
      throw new Error(`${ad} tohum göçü zaten bildirildi`);
    }
    this.gocler.set(ad, goc);
  }

  // Bildirilen göçler, ada göre sıralı. Karşılaştırma yerel ayara bağlı değildir (kod birimiyle).
  sirayla(): [string, TohumGocu][] {
    return [...this.gocler].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }
}
