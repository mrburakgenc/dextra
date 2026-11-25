import { AsyncLocalStorage } from 'node:async_hooks';
import { istekteYazmaAcildi } from '../../observability/istek-baglami/istek-baglami.js';
import type { Islem } from '../domain/islem.js';
import type { RepoBelirteci } from '../domain/repo-belirteci.js';
import type { PrismaClient } from '../generated/client.js';
import type { RepoIstemcisi, RepoKayitlari } from './registrar.js';

// İşlemin süre sınırı (KR-011); aşılırsa Prisma işlemi geri alır.
export const ISLEM_SURE_SINIRI_MS = 5000;

class AcikIslem implements Islem {
  private kapali = false;

  constructor(
    private readonly istemci: RepoIstemcisi,
    private readonly registrar: RepoKayitlari,
  ) {}

  repo<TOkuma, TTam extends TOkuma>(
    belirtec: RepoBelirteci<TOkuma, TTam>,
  ): TTam {
    if (this.kapali) {
      throw new Error(
        'İşlem kapandı; Islem örneği is fonksiyonunun dışında kullanılamaz',
      );
    }
    return this.registrar.kur(belirtec, this.istemci);
  }

  kapat(): void {
    this.kapali = true;
  }
}

// Tekil çalıştırıcı; işlem durumu taşımaz, her run kendi Islem örneğini alır.
export class UnitOfWork {
  // Yalnız "işlemin içinde miyim" işareti; işlemi taşımaz, yalnız hata vermek için okunur.
  // is içinde başlatılıp beklenmeyen işler işareti miras alır; run bitince işaret kapanır,
  // böylece onlar sonradan read ya da run çağırınca yanlışlıkla iç içe sayılmaz.
  private readonly islemde = new AsyncLocalStorage<{ acik: boolean }>();

  constructor(
    private readonly istemci: PrismaClient,
    private readonly registrar: RepoKayitlari,
  ) {}

  async run<T>(is: (islem: Islem) => Promise<T>): Promise<T> {
    this.islemDisindaOl('run');
    // İstekteysek istek bağlamına yazma işaretini koyar (TS-002 AK-40); işlem geri alınsa da kalır.
    istekteYazmaAcildi();
    return this.istemci.$transaction(
      async (tx) => {
        const islem = new AcikIslem(tx, this.registrar);
        const isaret = { acik: true };
        try {
          return await this.islemde.run(isaret, () => is(islem));
        } finally {
          isaret.acik = false;
          islem.kapat();
        }
      },
      { timeout: ISLEM_SURE_SINIRI_MS },
    );
  }

  read<TOkuma, TTam extends TOkuma>(
    belirtec: RepoBelirteci<TOkuma, TTam>,
  ): TOkuma {
    this.islemDisindaOl('read');
    return this.registrar.kur(belirtec, this.istemci);
  }

  private islemDisindaOl(kapi: 'run' | 'read'): void {
    if (this.islemde.getStore()?.acik === true) {
      throw new Error(`İşlem içindeyken ${kapi} çağrılamaz`);
    }
  }
}
