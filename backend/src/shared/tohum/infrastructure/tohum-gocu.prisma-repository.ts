import type {
  Registrar,
  RepoIstemcisi,
} from '../../database/infrastructure/registrar.js';
import {
  TOHUM_GOCU_REPO,
  type TohumGocuRepo,
} from '../domain/i-tohum-gocu.repository.js';

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
