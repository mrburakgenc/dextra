import type { RepoIstemcisi } from '../../../../shared/database/registrar.js';
import { kimlikSistemAktoru } from '../../_shared/cekirdek/sistem-aktoru.js';
import type { ParolaRepo } from '../domain/parola.repository.js';

export function parolaPrismaRepository(istemci: RepoIstemcisi): ParolaRepo {
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
  };
}
