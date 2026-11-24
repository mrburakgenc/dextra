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

// Kuyruklarından birine iş konamayan notun yeniden denenmesine kalan aralık: ilk ertelemede taban,
// her yeni ertelemede iki katı, üst sınırda durur.
export const KONAMAMA_TABAN_ARALIK_SN = 10;
export const KONAMAMA_UST_ARALIK_SN = 300;
// Aktarılmış notun silinmeden önce durduğu süre (KR-012 Kural 6).
export const AKTARILMIS_SAKLAMA_GUN = 3;

export interface OutboxOlayOlculeri {
  // Hiç denenmemiş (deneme_sayisi 0) ve aktarılmamış en eski notun yaşı; böyle not yoksa null.
  enEskiDenenmemisYasSn: number | null;
  // Denenmiş ama aktarılamamış not sayısı.
  denenmisBekleyenSayisi: number;
}

// İşlem dışı okuma yüzü: yalnız ölçüler; kilit almaz.
export interface OutboxOlayOkuma {
  olculer(): Promise<OutboxOlayOlculeri>;
}

export interface OutboxOlayRepo extends OutboxOlayOkuma {
  // Aktarılmamış ve ertelenmemiş en çok `enCok` notu, başka işlemin kilitlediklerini atlayarak
  // kilitler. Sıra güvencesi yoktur.
  aktarilacaklariKilitle(enCok: number): Promise<OutboxOlayNotu[]>;
  // Verilen kimlikli notların aktarım zamanını veritabanının saatiyle doldurur.
  aktarildiIsaretle(kimlikler: readonly string[]): Promise<void>;
  // Kuyruklarından birine iş konamayan notun deneme sayısını bir artırır, sonraki denemeyi ileri
  // atar ve konamayan kuyrukla hatanın sınıfını yazar. Not silinmez.
  konamadiIsaretle(kimlik: string, sonHata: string): Promise<void>;
  // Aktarımının üzerinden saklama süresi geçmiş en çok `enCok` notu siler, silinen sayıyı döner.
  // Aktarılmamış not yaşına bakılmadan kalır.
  eskileriSil(enCok: number): Promise<number>;
}

// Notlar işlem içinde, kilitlenerek alınır; işlem dışı okuma yalnız ölçüleri verir.
export const OUTBOX_OLAY_REPO = new RepoBelirteci<
  OutboxOlayOkuma,
  OutboxOlayRepo
>('OutboxOlayRepo');

// Prisma'nın model arayüzünde FOR UPDATE SKIP LOCKED yoktur; sorgular ham SQL'dir.
function outboxOlayRepo(istemci: RepoIstemcisi): OutboxOlayRepo {
  return {
    aktarilacaklariKilitle: (enCok) =>
      istemci.$queryRaw<OutboxOlayNotu[]>`select id, ad, surum, govde
          from outbox_olay
         where aktarim_zamani is null
           and (sonraki_deneme_zamani is null or sonraki_deneme_zamani <= clock_timestamp())
         limit ${enCok}
           for update skip locked`,
    aktarildiIsaretle: async (kimlikler) => {
      await istemci.$executeRaw`update outbox_olay set aktarim_zamani = clock_timestamp()
                                 where id = any(${kimlikler}::uuid[])`;
    },
    // Sağ taraftaki deneme_sayisi artırılmadan önceki değerdir. Üs 20'de kesilir: sürekli konamayan
    // notta sayı büyüdükçe 2'nin kuvveti double sınırını aşıp hata vermesin (sonuç zaten üst sınırdadır).
    konamadiIsaretle: async (kimlik, sonHata) => {
      await istemci.$executeRaw`update outbox_olay
           set deneme_sayisi = deneme_sayisi + 1,
               sonraki_deneme_zamani = clock_timestamp() + make_interval(secs => least(
                 ${KONAMAMA_TABAN_ARALIK_SN} * power(2, least(deneme_sayisi, 20)),
                 ${KONAMAMA_UST_ARALIK_SN})),
               son_hata = ${sonHata}
         where id = ${kimlik}::uuid`;
    },
    eskileriSil: (enCok) =>
      istemci.$executeRaw`delete from outbox_olay where id in (
          select id from outbox_olay
           where aktarim_zamani < clock_timestamp() - make_interval(days => ${AKTARILMIS_SAKLAMA_GUN})
           limit ${enCok}
             for update skip locked)`,
    olculer: async () => {
      const [satir] = await istemci.$queryRaw<
        {
          en_eski_denenmemis_yas_sn: number | null;
          denenmis_bekleyen_sayisi: number;
        }[]
      >`select extract(epoch from clock_timestamp() - min(olusturma_zamani)
                 filter (where deneme_sayisi = 0))::float8 as en_eski_denenmemis_yas_sn,
               (count(*) filter (where deneme_sayisi > 0))::int as denenmis_bekleyen_sayisi
          from outbox_olay
         where aktarim_zamani is null`;
      return {
        enEskiDenenmemisYasSn: satir?.en_eski_denenmemis_yas_sn ?? null,
        denenmisBekleyenSayisi: satir?.denenmis_bekleyen_sayisi ?? 0,
      };
    },
  };
}

// Ortak tablonun repository'si ortak kodun kaydıyla Unit of Work'e tanıtılır (KR-011).
export function outboxOlayRepoKaydet(registrar: Registrar): void {
  registrar.register(OUTBOX_OLAY_REPO, outboxOlayRepo);
}
