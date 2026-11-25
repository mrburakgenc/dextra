// OturumCekirdekRepo'nun gerçeklemesi: oturum tablosuna işlemin istemcisiyle, yetki kapısından
// geçmeden erişir (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { OturumCekirdekRepo } from '../../domain/repositories/i-oturum-cekirdek.repository.js';

export function oturumCekirdekRepo(istemci: RepoIstemcisi): OturumCekirdekRepo {
  return {
    // Kapatılma zamanını uygulama saati verir (TS-002 AK-21): çağrı başına tek zaman, aynı çağrıda
    // kapanan bütün oturumlar onu alır. Dönen satırlar yalnız bu deyimin güncellediklerdir.
    hepsiniKapat: async (kullaniciId, neden) => {
      const kapatilmaZamani = new Date();
      const kapananlar = await istemci.oturum.updateManyAndReturn({
        where: { kullaniciId, kapatilmaZamani: null },
        data: { kapatilmaZamani, kapatilmaNedeni: neden },
        select: { id: true },
      });
      return kapananlar.map(({ id }) => ({ id, kapatilmaZamani }));
    },
  };
}
