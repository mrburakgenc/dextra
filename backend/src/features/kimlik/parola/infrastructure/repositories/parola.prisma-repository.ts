// IParolaRepo'nun gerçeklemesi: çekirdek yol, Unit of Work'ün istemcisiyle (TS-002 "Çekirdek yollar").
import type { RepoIstemcisi } from '../../../../../shared/database/registrar.js';
import { kimlikSistemAktoru } from '../../../_shared/cekirdek/sistem-aktoru.js';
import type { IParolaRepo } from '../../domain/repositories/i-parola.repository.js';

export function parolaPrismaRepository(istemci: RepoIstemcisi): IParolaRepo {
  return {
    kullaniciAdiylaBul: async (kullaniciAdi) => {
      const satir = await istemci.kullanici.findUnique({
        where: { kullaniciAdi },
        select: { id: true },
      });
      return satir?.id ?? null;
    },
    kimlikSistemAktoru: () => kimlikSistemAktoru(istemci),
    girisSirri: async (kullaniciAdi) => {
      const satir = await istemci.kullanici.findUnique({
        where: { kullaniciAdi },
        select: {
          id: true,
          sirri: { select: { parolaOzeti: true, guncellemeZamani: true } },
        },
      });
      if (!satir?.sirri) {
        return null;
      }
      return { kullaniciId: satir.id, ...satir.sirri };
    },
    kisininSirri: (kullaniciId) =>
      istemci.kullaniciSirri.findUnique({
        where: { kullaniciId },
        select: { parolaOzeti: true, guncellemeZamani: true },
      }),
    sirZamani: async (kullaniciId) => {
      const satir = await istemci.kullaniciSirri.findUnique({
        where: { kullaniciId },
        select: { guncellemeZamani: true },
      });
      return satir?.guncellemeZamani ?? null;
    },
    sirYaz: async (kullaniciId, parolaOzeti, guncellemeZamani) => {
      await istemci.kullaniciSirri.upsert({
        where: { kullaniciId },
        create: { kullaniciId, parolaOzeti, guncellemeZamani },
        update: { parolaOzeti, guncellemeZamani },
        select: { kullaniciId: true },
      });
    },
    oturumAcikMi: async (oturumId, kullaniciId) =>
      (await istemci.oturum.findFirst({
        where: { id: oturumId, kullaniciId, kapatilmaZamani: null },
        select: { id: true },
      })) !== null,
  };
}
