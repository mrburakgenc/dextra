// KullaniciCekirdekRepo'nun gerçeklemesi: kullanici tablosuna işlemin istemcisiyle, yetki kapısından
// geçmeden erişir (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { KullaniciCekirdekRepo } from '../../domain/repositories/i-kullanici-cekirdek.repository.js';

export function kullaniciCekirdekRepo(
  istemci: RepoIstemcisi,
): KullaniciCekirdekRepo {
  return {
    kilitle: async (id) => {
      await istemci.kullanici.update({
        where: { id },
        data: { yetkiSurumu: { increment: 0 } },
        select: { id: true },
      });
    },
    surumuArtir: async (id) => {
      const satir = await istemci.kullanici.update({
        where: { id },
        data: { yetkiSurumu: { increment: 1 } },
        select: { yetkiSurumu: true },
      });
      return satir.yetkiSurumu;
    },
    ekle: (kullanici) =>
      istemci.kullanici.create({
        data: kullanici,
        select: { yetkiSurumu: true, olusturmaZamani: true },
      }),
    sistemAktoruVarMi: async (gorunenAd) =>
      (await istemci.kullanici.findFirst({
        where: { sistemAktoru: true, gorunenAd },
        select: { id: true },
      })) !== null,
  };
}
