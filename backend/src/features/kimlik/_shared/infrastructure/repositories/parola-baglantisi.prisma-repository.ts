// ParolaBaglantisiRepo'nun gerçeklemesi: parola_baglantisi tablosuna işlemin istemcisiyle, yetki
// kapısından geçmeden erişir (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/registrar.js';
import type { ParolaBaglantisiRepo } from '../../domain/repositories/i-parola-baglantisi.repository.js';

export function parolaBaglantisiRepo(
  istemci: RepoIstemcisi,
): ParolaBaglantisiRepo {
  return {
    ozetIleBul: (kodOzeti) =>
      istemci.parolaBaglantisi.findUnique({
        where: { kodOzeti },
        select: {
          id: true,
          kullaniciId: true,
          sonGecerlilikZamani: true,
          kullanilmaZamani: true,
        },
      }),
    kullanilmamisi: (kullaniciId) =>
      istemci.parolaBaglantisi.findFirst({
        where: { kullaniciId, kullanilmaZamani: null },
        select: {
          id: true,
          sonGecerlilikZamani: true,
          olusturanId: true,
          olusturmaZamani: true,
        },
      }),
    sil: async (id) => {
      await istemci.parolaBaglantisi.delete({
        where: { id },
        select: { id: true },
      });
    },
    ekle: (baglanti) =>
      istemci.parolaBaglantisi.create({
        data: baglanti,
        select: { olusturmaZamani: true },
      }),
    kullan: async (id, kullanilmaZamani) => {
      const { count } = await istemci.parolaBaglantisi.updateMany({
        where: {
          id,
          kullanilmaZamani: null,
          sonGecerlilikZamani: { gt: kullanilmaZamani },
        },
        data: { kullanilmaZamani },
      });
      return count === 1;
    },
  };
}
