// Çekirdek repository: genel sayaç satırına yetki kapısından geçmeden erişir (KR-010 Seçim 48'in
// adıyla istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır.
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';

// Genel sayaç tek satırdır; kimliği yalnız 1 olabilir (yetki_surumu_tek_satir_denetim).
const GENEL_SAYAC_ID = 1;

export interface YetkiSurumuCekirdekRepo {
  // Satırı anahtar dışı güncelleme kilidiyle (FOR NO KEY UPDATE) kilitler: anahtara dokunmayan bir
  // güncelleme bu kilidi alır (GV-003 ölçümü). Satır yoksa Prisma'nın "kayıt yok" hatası atılır.
  kilitle(artir: boolean): Promise<void>;
}

// Okuma görünümü boştur: genel sayacı işlem dışında okuyan çekirdek kodu bu görevde yoktur.
export const YETKI_SURUMU_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  YetkiSurumuCekirdekRepo
>('YetkiSurumuCekirdekRepo');

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
