// KullaniciSirriCekirdekRepo'nun gerçeklemesi: kullanici_sirri tablosuna işlemin istemcisiyle, yetki
// kapısından geçmeden erişir (KR-010 Seçim 48'in adıyla istisnası). Parola özetini dışarı vermez.
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { KullaniciSirriCekirdekRepo } from '../../domain/repositories/i-kullanici-sirri-cekirdek.repository.js';

export function kullaniciSirriCekirdekRepo(
  istemci: RepoIstemcisi,
): KullaniciSirriCekirdekRepo {
  return {
    guncellemeZamani: async (kullaniciId) =>
      (
        await istemci.kullaniciSirri.findUnique({
          where: { kullaniciId },
          select: { guncellemeZamani: true },
        })
      )?.guncellemeZamani ?? null,
    sil: async (kullaniciId) => {
      await istemci.kullaniciSirri.delete({
        where: { kullaniciId },
        select: { kullaniciId: true },
      });
    },
  };
}
