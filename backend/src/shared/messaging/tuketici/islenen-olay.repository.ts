import {
  type Registrar,
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../database/registrar.js';

// Sahiplenme denemesinin sonucu: satır bu çağrıyla alındı, olay daha önce tamamlandı ya da
// başka bir işçi şu an sahipleniyor.
export type SahiplenmeSonucu = 'sahiplenildi' | 'tamamlandi' | 'isleniyor';

export interface IslenenOlayRepo {
  // Satır yoksa 'isleniyor' olarak ekler; varsa ve sahiplenmesi süresi dolmuş 'isleniyor' ise
  // bitişi yenileyip devralır. Karar tek ifadede verilir: aynı anda iki çağrıdan yalnız biri alır.
  sahiplen(
    tuketici: string,
    olayId: string,
    sureSn: number,
  ): Promise<SahiplenmeSonucu>;
  tamamla(tuketici: string, olayId: string): Promise<void>;
  // Yalnız 'isleniyor' satırı siler; devralan başka işçinin tamamladığı kayda dokunmaz.
  birak(tuketici: string, olayId: string): Promise<void>;
}

// islenen_olay yalnız run içinde kullanılır; işlem dışı okuma görünümü boştur (unknown).
export const ISLENEN_OLAY_REPO = new RepoBelirteci<unknown, IslenenOlayRepo>(
  'IslenenOlayRepo',
);

// Prisma'nın model arayüzünde koşullu ON CONFLICT DO UPDATE yoktur; sorgular ham SQL'dir.
// Zamanlar veritabanının saatiyle (clock_timestamp) yazılır ve karşılaştırılır.
function islenenOlayRepo(istemci: RepoIstemcisi): IslenenOlayRepo {
  return {
    sahiplen: async (tuketici, olayId, sureSn) => {
      // Çakışan ekleme öbür işlemin bitmesini bekler, sonra koşulu onaylanmış satırda sınar.
      const alinan = await istemci.$queryRaw<unknown[]>`
        insert into islenen_olay (tuketici, olay_id, durum, sahiplenme_bitis_zamani)
        values (${tuketici}, ${olayId}::uuid, 'isleniyor',
                clock_timestamp() + make_interval(secs => ${sureSn}))
        on conflict (tuketici, olay_id) do update
           set sahiplenme_bitis_zamani = excluded.sahiplenme_bitis_zamani
         where islenen_olay.durum = 'isleniyor'
           and islenen_olay.sahiplenme_bitis_zamani <= clock_timestamp()
        returning 1`;
      if (alinan.length > 0) {
        return 'sahiplenildi';
      }
      // Alınamadı: yalnız ne yapılacağını seçmek için okunur. Satır bu arada silinmişse de
      // olay şimdilik işlenmez ('isleniyor'); kuyruk yeniden dener.
      const satirlar = await istemci.$queryRaw<{ durum: string }[]>`
        select durum from islenen_olay
         where tuketici = ${tuketici} and olay_id = ${olayId}::uuid`;
      return satirlar[0]?.durum === 'tamamlandi' ? 'tamamlandi' : 'isleniyor';
    },
    tamamla: async (tuketici, olayId) => {
      await istemci.$executeRaw`
        update islenen_olay set durum = 'tamamlandi', tamamlanma_zamani = clock_timestamp()
         where tuketici = ${tuketici} and olay_id = ${olayId}::uuid`;
    },
    birak: async (tuketici, olayId) => {
      await istemci.$executeRaw`
        delete from islenen_olay
         where tuketici = ${tuketici} and olay_id = ${olayId}::uuid and durum = 'isleniyor'`;
    },
  };
}

// Ortak tablonun repository'si ortak kodun kaydıyla Unit of Work'e tanıtılır (KR-011).
export function islenenOlayRepoKaydet(registrar: Registrar): void {
  registrar.register(ISLENEN_OLAY_REPO, islenenOlayRepo);
}
