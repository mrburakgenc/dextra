import {
  type Registrar,
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../database/registrar.js';

// Aktarılmayı bekleyen olay notu.
export interface OutboxOlayNotu {
  id: string;
  ad: string;
  surum: number;
  govde: Record<string, unknown>;
}

export interface OutboxOlayRepo {
  // Aktarılmamış en çok `enCok` notu, başka işlemin kilitlediklerini atlayarak kilitler.
  // Sıra güvencesi yoktur.
  aktarilacaklariKilitle(enCok: number): Promise<OutboxOlayNotu[]>;
  // Verilen kimlikli notların aktarım zamanını veritabanının saatiyle doldurur.
  aktarildiIsaretle(kimlikler: readonly string[]): Promise<void>;
}

// outbox_olay yalnız işlem içinde, kilitlenerek okunur; işlem dışı okuma görünümü boştur (unknown).
export const OUTBOX_OLAY_REPO = new RepoBelirteci<unknown, OutboxOlayRepo>(
  'OutboxOlayRepo',
);

// Prisma'nın model arayüzünde FOR UPDATE SKIP LOCKED yoktur; sorgular ham SQL'dir.
function outboxOlayRepo(istemci: RepoIstemcisi): OutboxOlayRepo {
  return {
    aktarilacaklariKilitle: (enCok) =>
      istemci.$queryRaw<OutboxOlayNotu[]>`select id, ad, surum, govde
          from outbox_olay
         where aktarim_zamani is null
         limit ${enCok}
           for update skip locked`,
    aktarildiIsaretle: async (kimlikler) => {
      await istemci.$executeRaw`update outbox_olay set aktarim_zamani = clock_timestamp()
                                 where id = any(${kimlikler}::uuid[])`;
    },
  };
}

// Ortak tablonun repository'si ortak kodun kaydıyla Unit of Work'e tanıtılır (KR-011).
export function outboxOlayRepoKaydet(registrar: Registrar): void {
  registrar.register(OUTBOX_OLAY_REPO, outboxOlayRepo);
}
