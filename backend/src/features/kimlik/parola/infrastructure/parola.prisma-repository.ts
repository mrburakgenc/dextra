import type { RepoIstemcisi } from '../../../../shared/database/registrar.js';
import type { ParolaRepo } from '../domain/parola.repository.js';

// Kimlik feature'ının sistem aktörünün görünen adı (TS-002 AK-2); aktörün giriş bilgisi yoktur ve
// tabloda onu ayıran başka bir alan bulunmaz.
const KIMLIK_SISTEM_AKTORU_ADI = 'kimlik';

export function parolaPrismaRepository(istemci: RepoIstemcisi): ParolaRepo {
  return {
    kullaniciAdiylaBul: async (kullaniciAdi) => {
      const satir = await istemci.kullanici.findUnique({
        where: { kullaniciAdi },
        select: { id: true },
      });
      return satir?.id ?? null;
    },
    kimlikSistemAktoru: async () => {
      const satir = await istemci.kullanici.findFirstOrThrow({
        where: { sistemAktoru: true, gorunenAd: KIMLIK_SISTEM_AKTORU_ADI },
        select: { id: true },
      });
      return satir.id;
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
