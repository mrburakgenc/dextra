import type { UnitOfWork } from '../../database/unit-of-work.js';
import type { IsKuyrugu } from '../kuyruk/is-kuyrugu.js';
import type { AboneDefteri } from './abone-defteri.js';
import { OUTBOX_OLAY_REPO } from './outbox-olay.repository.js';

// Bir geçişte en çok alınan not sayısı.
export const PARTI_BOYU = 100;

export interface GecisSonucu {
  // Bütün kuyruklarına iş konup işaretlenen not sayısı.
  aktarilan: number;
  // Kuyruklarından birine iş konamadığı için işaretlenmeyen not sayısı; sonraki geçiş yeniden dener.
  kalan: number;
}

// outbox_olay notlarını, olayı dinleyen her tüketicinin kendi kuyruğuna taşır (KR-012 Kural 4, 6).
export class OlayAktarici {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly defter: AboneDefteri,
    private readonly kuyruk: IsKuyrugu,
  ) {}

  // Bir parti notu taşır. Kuyruğa koyma hatası atılmaz: o not işaretlenmez, öbürleri ilerler.
  // İşin kimliği olayın kimliğidir; yeniden denemede kuyrukta duran iş ikilenmez.
  async gecis(): Promise<GecisSonucu> {
    return this.uow.run(async (islem) => {
      const repo = islem.repo(OUTBOX_OLAY_REPO);
      const notlar = await repo.aktarilacaklariKilitle(PARTI_BOYU);
      const aktarilanlar: string[] = [];
      for (const not of notlar) {
        // İşin verisi zarftır: olayın kimliği, adı, sürümü ve gövdesi.
        const zarf = {
          id: not.id,
          ad: not.ad,
          surum: not.surum,
          govde: not.govde,
        };
        const sonuclar = await Promise.allSettled(
          this.defter
            .dinleyenler(not.ad)
            .map((kuyruk) =>
              this.kuyruk.koy(kuyruk, { kimlik: not.id, ad: not.ad, veri: zarf }),
            ),
        );
        if (sonuclar.every((sonuc) => sonuc.status === 'fulfilled')) {
          aktarilanlar.push(not.id);
        }
      }
      if (aktarilanlar.length > 0) {
        await repo.aktarildiIsaretle(aktarilanlar);
      }
      return {
        aktarilan: aktarilanlar.length,
        kalan: notlar.length - aktarilanlar.length,
      };
    });
  }
}
