import type { Islem } from '../database/unit-of-work.js';

// Tohum göçü: adını ve koşucunun açtığı işlemi alan uygulama işlevi (TS-002 AK-1).
export type TohumGocu = (ad: string, islem: Islem) => Promise<void>;

// Tohum göçlerinin süreç içi kaydı. Göçler bildirildikleri sırayla uygulanır; ad tekildir.
export class TohumDefteri {
  private readonly gocler = new Map<string, TohumGocu>();

  bildir(ad: string, goc: TohumGocu): void {
    if (this.gocler.has(ad)) {
      throw new Error(`${ad} tohum göçü zaten bildirildi`);
    }
    this.gocler.set(ad, goc);
  }

  // Bildirilen göçler, bildirildikleri sırayla.
  sirayla(): [string, TohumGocu][] {
    return [...this.gocler];
  }
}
