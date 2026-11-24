import {
  type Registrar,
  RepoBelirteci,
  type RepoIstemcisi,
} from '../database/registrar.js';

export interface TohumGocuRepo {
  // Göçün adını deftere yazar; ad zaten yazılıysa hiçbir şey yazmaz ve false döner. Aynı adı yazan
  // ve henüz bitmemiş başka bir işlem varsa onun bitmesini bekler: o onaylanırsa false, geri
  // alınırsa bu çağrı yazar ve true döner.
  yaz(ad: string): Promise<boolean>;
}

// Defter yalnız run içinde kullanılır; işlem dışı okuma görünümü boştur (unknown).
export const TOHUM_GOCU_REPO = new RepoBelirteci<unknown, TohumGocuRepo>(
  'TohumGocuRepo',
);

function tohumGocuRepo(istemci: RepoIstemcisi): TohumGocuRepo {
  return {
    yaz: async (ad) => {
      // skipDuplicates, çakışan satırı ON CONFLICT DO NOTHING ile atlar; sayı yalnız yazılanı sayar.
      const { count } = await istemci.tohumGocu.createMany({
        data: [{ ad }],
        skipDuplicates: true,
      });
      return count === 1;
    },
  };
}

export function tohumGocuRepoKaydet(registrar: Registrar): void {
  registrar.register(TOHUM_GOCU_REPO, tohumGocuRepo);
}
