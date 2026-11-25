// UyelikCekirdekRepo'nun gerçeklemesi: uyelik tablosuna işlemin istemcisiyle, yetenek satırı olmadan
// yazar ve kök kümeyi okur (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/registrar.js';
import type { UyelikCekirdekRepo } from '../../domain/repositories/i-uyelik-cekirdek.repository.js';

// Temel rolün saklanan kodu (TS-002 AK-3).
const TEMEL_ROL_KODU = 'temel';

export function uyelikCekirdekRepo(istemci: RepoIstemcisi): UyelikCekirdekRepo {
  return {
    kokKume: async () => {
      const grup = await istemci.grup.findFirstOrThrow({
        where: { ustGrupId: null, silinmeZamani: null },
        select: { id: true },
      });
      const rol = await istemci.rol.findUniqueOrThrow({
        where: { kod: TEMEL_ROL_KODU },
        select: { id: true },
      });
      return { grupId: grup.id, rolId: rol.id };
    },
    ekle: (uyelik) =>
      istemci.uyelik.create({
        data: uyelik,
        select: { olusturmaZamani: true },
      }),
    // Silinme zamanını uygulama saati verir (TS-002 AK-21): çağrı başına tek zaman, aynı çağrıda
    // kapanan bütün üyelikler onu alır. Dönen satırlar yalnız bu deyimin güncellediklerdir.
    hepsiniKapat: async (kullaniciId) => {
      const silinmeZamani = new Date();
      const kapananlar = await istemci.uyelik.updateManyAndReturn({
        where: { kullaniciId, silinmeZamani: null },
        data: { silinmeZamani },
        select: { id: true },
      });
      return kapananlar.map(({ id }) => ({ id, silinmeZamani }));
    },
  };
}
