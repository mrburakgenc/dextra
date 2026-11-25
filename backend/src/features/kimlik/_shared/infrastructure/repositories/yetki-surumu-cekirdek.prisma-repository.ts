// YetkiSurumuCekirdekRepo'nun gerçeklemesi: genel sayaç satırına işlemin istemcisiyle, yetki
// kapısından geçmeden erişir (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { YetkiSurumuCekirdekRepo } from '../../domain/repositories/i-yetki-surumu-cekirdek.repository.js';

// Genel sayaç tek satırdır; kimliği yalnız 1 olabilir (yetki_surumu_tek_satir_denetim).
const GENEL_SAYAC_ID = 1;

export function yetkiSurumuCekirdekRepo(
  istemci: RepoIstemcisi,
): YetkiSurumuCekirdekRepo {
  return {
    kilitle: async (artir) => {
      await istemci.yetkiSurumu.update({
        where: { id: GENEL_SAYAC_ID },
        data: { sayac: { increment: artir ? 1 : 0 } },
      });
    },
  };
}
