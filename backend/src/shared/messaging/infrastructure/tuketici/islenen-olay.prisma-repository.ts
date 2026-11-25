import type {
  Registrar,
  RepoIstemcisi,
} from '../../../database/infrastructure/registrar.js';
import {
  ISLENEN_OLAY_REPO,
  type IslenenOlayRepo,
} from '../../domain/tuketici/i-islenen-olay.repository.js';

// Prisma'nın model arayüzünde koşullu ON CONFLICT DO UPDATE yoktur; sorgular ham SQL'dir.
// Zamanlar veritabanının saatiyle (clock_timestamp) yazılır ve karşılaştırılır.
function islenenOlayRepo(istemci: RepoIstemcisi): IslenenOlayRepo {
  return {
    sahiplen: async (tuketici, olayId, sahipId, sureSn) => {
      // Çakışan ekleme öbür işlemin bitmesini bekler, sonra koşulu onaylanmış satırda sınar.
      const alinan = await istemci.$queryRaw<unknown[]>`
        insert into islenen_olay (tuketici, olay_id, durum, sahiplenme_bitis_zamani, sahip_id)
        values (${tuketici}, ${olayId}::uuid, 'isleniyor',
                clock_timestamp() + make_interval(secs => ${sureSn}), ${sahipId}::uuid)
        on conflict (tuketici, olay_id) do update
           set sahiplenme_bitis_zamani = excluded.sahiplenme_bitis_zamani,
               sahip_id = excluded.sahip_id
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
    tamamla: async (tuketici, olayId, sahipId) => {
      await istemci.$executeRaw`
        update islenen_olay set durum = 'tamamlandi', tamamlanma_zamani = clock_timestamp()
         where tuketici = ${tuketici} and olay_id = ${olayId}::uuid
           and sahip_id = ${sahipId}::uuid`;
    },
    birak: async (tuketici, olayId, sahipId) => {
      await istemci.$executeRaw`
        delete from islenen_olay
         where tuketici = ${tuketici} and olay_id = ${olayId}::uuid and durum = 'isleniyor'
           and sahip_id = ${sahipId}::uuid`;
    },
  };
}

// Ortak tablonun repository'si ortak kodun kaydıyla Unit of Work'e tanıtılır (KR-011).
export function islenenOlayRepoKaydet(registrar: Registrar): void {
  registrar.register(ISLENEN_OLAY_REPO, islenenOlayRepo);
}
