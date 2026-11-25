// Outbox tablolarının repository'si ve belirteci. Ayrı dosyadadır: feature bu dosyayı içe
// aktaramaz (eslint.config.mjs); outbox'a yalnız yazma yüzeyinden ulaşır (KR-011 Yazım biçimi).
import { RepoBelirteci } from '../../../database/domain/repo-belirteci.js';
import type { Prisma } from '../../../database/generated/client.js';
import type { RepoIstemcisi } from '../../../database/infrastructure/registrar.js';

export interface OutboxRepo {
  olayEkle(
    satir: Pick<Prisma.OutboxOlayCreateInput, 'id' | 'ad' | 'surum' | 'govde'>,
  ): Promise<void>;
  izEkle(
    satir: Pick<Prisma.OutboxIzCreateInput, 'id' | 'surum' | 'govde'>,
  ): Promise<void>;
}

// Okuma görünümü boştur: notları okuyan kod yoktur.
export const OUTBOX_REPO = new RepoBelirteci<object, OutboxRepo>('OutboxRepo');

export function outboxRepo(istemci: RepoIstemcisi): OutboxRepo {
  return {
    olayEkle: async (satir) => {
      await istemci.outboxOlay.create({ data: satir });
    },
    izEkle: async (satir) => {
      await istemci.outboxIz.create({ data: satir });
    },
  };
}
