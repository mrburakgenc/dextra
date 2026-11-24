import {
  type Registrar,
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../database/registrar.js';

// Aktarılmayı bekleyen değişiklik kaydı notu. Zaman metin olarak okunur: JavaScript Date
// milisaniyede keser, veritabanı mikrosaniye tutar.
export interface OutboxIzNotu {
  id: string;
  govde: Record<string, unknown>;
  olusturmaZamani: string;
}

export interface OutboxIzRepo {
  // Aktarılmamış, sürümü bilinen ve ertelenmemiş en çok `enCok` notu, başka işlemin kilitlediklerini
  // atlayarak kilitler. Sıra güvencesi yoktur.
  aktarilacaklariKilitle(
    enCok: number,
    bilinenSurum: number,
  ): Promise<OutboxIzNotu[]>;
  // Verilen kimlikli notların aktarım zamanını veritabanının saatiyle doldurur.
  aktarildiIsaretle(kimlikler: readonly string[]): Promise<void>;
}

// outbox_iz yalnız işlem içinde, kilitlenerek okunur; işlem dışı okuma görünümü boştur (unknown).
export const OUTBOX_IZ_REPO = new RepoBelirteci<unknown, OutboxIzRepo>(
  'OutboxIzRepo',
);

// Prisma'nın model arayüzünde FOR UPDATE SKIP LOCKED yoktur; sorgular ham SQL'dir.
function outboxIzRepo(istemci: RepoIstemcisi): OutboxIzRepo {
  return {
    aktarilacaklariKilitle: async (enCok, bilinenSurum) => {
      const satirlar = await istemci.$queryRaw<
        {
          id: string;
          govde: Record<string, unknown>;
          olusturma_zamani: string;
        }[]
      >`select id, govde, to_jsonb(olusturma_zamani) #>> '{}' as olusturma_zamani
          from outbox_iz
         where aktarim_zamani is null
           and surum <= ${bilinenSurum}
           and (sonraki_deneme_zamani is null or sonraki_deneme_zamani <= clock_timestamp())
         limit ${enCok}
           for update skip locked`;
      return satirlar.map((satir) => ({
        id: satir.id,
        govde: satir.govde,
        olusturmaZamani: satir.olusturma_zamani,
      }));
    },
    aktarildiIsaretle: async (kimlikler) => {
      await istemci.$executeRaw`update outbox_iz set aktarim_zamani = clock_timestamp()
                                 where id = any(${kimlikler}::uuid[])`;
    },
  };
}

// Ortak tablonun repository'si ortak kodun kaydıyla Unit of Work'e tanıtılır (KR-011).
export function outboxIzRepoKaydet(registrar: Registrar): void {
  registrar.register(OUTBOX_IZ_REPO, outboxIzRepo);
}
