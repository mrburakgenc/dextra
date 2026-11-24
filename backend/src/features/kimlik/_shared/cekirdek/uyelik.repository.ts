// Çekirdek repository: uyelik tablosuna yetenek satırı olmadan yazar ve kök kümeyi okur (KR-010
// Seçim 48'in adıyla istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır.
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';

// Temel rolün saklanan kodu (TS-002 AK-3).
const TEMEL_ROL_KODU = 'temel';

export interface YeniUyelik {
  id: string;
  kullaniciId: string;
  grupId: string;
  rolId: string;
}

export interface KapananUyelik {
  id: string;
  silinmeZamani: Date;
}

export interface UyelikCekirdekRepo {
  // Kök grubun (üstü olmayan, silinmemiş tek grup) ve temel rolün kimlikleri; biri yoksa Prisma'nın
  // "kayıt yok" hatası atılır.
  kokKume(): Promise<{ grupId: string; rolId: string }>;
  // Üyeliği yazar; aynı kişide aynı (grup, rol) canlıysa tekil kısıt reddeder (P2002, cakisma).
  ekle(uyelik: YeniUyelik): Promise<{ olusturmaZamani: Date }>;
  // Kişinin bütün canlı üyeliklerine silinme zamanı yazar ve kapananları döner.
  hepsiniKapat(kullaniciId: string): Promise<KapananUyelik[]>;
}

export const UYELIK_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  UyelikCekirdekRepo
>('UyelikCekirdekRepo');

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
