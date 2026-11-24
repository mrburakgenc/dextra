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

// Satır hatası veren notun yeniden denenmesine kalan aralık: ilk hatada taban, her yeni hatada iki
// katı, üst sınırda durur (TS-003 sözleşme 4).
export const SATIR_HATASI_TABAN_ARALIK_SN = 60;
export const SATIR_HATASI_UST_ARALIK_SN = 3600;
// Aktarılmış notun silinmeden önce durduğu süre (KR-013 Seçim 5).
export const AKTARILMIS_SAKLAMA_GUN = 3;

export interface OutboxIzOlculeri {
  // Hiç denenmemiş (deneme_sayisi 0) ve aktarılmamış en eski notun yaşı; böyle not yoksa null.
  enEskiDenenmemisYasSn: number | null;
  // Denenmiş ama aktarılamamış not sayısı.
  denenmisBekleyenSayisi: number;
}

// İşlem dışı okuma yüzü: yalnız ölçüler; kilit almaz.
export interface OutboxIzOkuma {
  olculer(): Promise<OutboxIzOlculeri>;
}

export interface OutboxIzRepo extends OutboxIzOkuma {
  // Aktarılmamış, sürümü bilinen ve ertelenmemiş en çok `enCok` notu, başka işlemin kilitlediklerini
  // atlayarak kilitler. Sıra güvencesi yoktur.
  aktarilacaklariKilitle(
    enCok: number,
    bilinenSurum: number,
  ): Promise<OutboxIzNotu[]>;
  // Verilen kimlikli notların aktarım zamanını veritabanının saatiyle doldurur.
  aktarildiIsaretle(kimlikler: readonly string[]): Promise<void>;
  // Satır hatası veren notun deneme sayısını bir artırır, sonraki denemeyi ileri atar ve hatanın
  // sınıfını yazar. Not silinmez.
  satirHatasiIsaretle(kimlik: string, sonHata: string): Promise<void>;
  // Aktarımının üzerinden saklama süresi geçmiş en çok `enCok` notu siler, silinen sayıyı döner.
  // Aktarılmamış not yaşına bakılmadan kalır.
  eskileriSil(enCok: number): Promise<number>;
}

// Notlar işlem içinde, kilitlenerek alınır; işlem dışı okuma yalnız ölçüleri verir.
export const OUTBOX_IZ_REPO = new RepoBelirteci<OutboxIzOkuma, OutboxIzRepo>(
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
    // Sağ taraftaki deneme_sayisi artırılmadan önceki değerdir. Üs 20'de kesilir: kalıcı bozuk notta
    // sayı büyüdükçe 2'nin kuvveti double sınırını aşıp hata vermesin (sonuç zaten üst sınırdadır).
    satirHatasiIsaretle: async (kimlik, sonHata) => {
      await istemci.$executeRaw`update outbox_iz
           set deneme_sayisi = deneme_sayisi + 1,
               sonraki_deneme_zamani = clock_timestamp() + make_interval(secs => least(
                 ${SATIR_HATASI_TABAN_ARALIK_SN} * power(2, least(deneme_sayisi, 20)),
                 ${SATIR_HATASI_UST_ARALIK_SN})),
               son_hata = ${sonHata}
         where id = ${kimlik}::uuid`;
    },
    eskileriSil: (enCok) =>
      istemci.$executeRaw`delete from outbox_iz where id in (
          select id from outbox_iz
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
          from outbox_iz
         where aktarim_zamani is null`;
      return {
        enEskiDenenmemisYasSn: satir?.en_eski_denenmemis_yas_sn ?? null,
        denenmisBekleyenSayisi: satir?.denenmis_bekleyen_sayisi ?? 0,
      };
    },
  };
}

// Ortak tablonun repository'si ortak kodun kaydıyla Unit of Work'e tanıtılır (KR-011).
export function outboxIzRepoKaydet(registrar: Registrar): void {
  registrar.register(OUTBOX_IZ_REPO, outboxIzRepo);
}
