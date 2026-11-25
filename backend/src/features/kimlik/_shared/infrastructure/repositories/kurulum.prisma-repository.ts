// KurulumRepo'nun gerçeklemesi: kimlik tohum göçlerinin satırlarını işlemin istemcisiyle, yetki
// kapısından geçmeden yazar ve okur (KR-010 Seçim 48'in adıyla istisnası).
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import type { KurulumRepo } from '../../domain/repositories/i-kurulum.repository.js';
import { kimlikSistemAktoru } from './sistem-aktoru-cekirdek.prisma-repository.js';

// Kök yönetici rolünün saklanan kodu (TS-002 AK-3).
const KOK_YONETICI_ROL_KODU = 'superadmin';

// Genel sayaç tek satırdır; kimliği yalnız 1 olabilir (yetki_surumu_tek_satir_denetim).
const GENEL_SAYAC_ID = 1;

export function kurulumRepo(istemci: RepoIstemcisi): KurulumRepo {
  return {
    genelSayacEkle: async () => {
      await istemci.yetkiSurumu.create({ data: { id: GENEL_SAYAC_ID } });
    },
    grupEkle: (grup) =>
      istemci.grup.create({ data: grup, select: { olusturmaZamani: true } }),
    rolEkle: async (rol) => {
      await istemci.rol.create({ data: rol, select: { id: true } });
    },
    izinEkle: async (izin) => {
      await istemci.izin.create({ data: izin, select: { id: true } });
    },
    yetenekEkle: ({ sart, ...yetenek }) =>
      istemci.yetenek.create({
        data: {
          ...yetenek,
          ...(sart !== null && {
            sart: sart.map(({ alan, islec, deger }) => ({
              alan,
              islec,
              deger,
            })),
          }),
        },
        select: { olusturmaZamani: true },
      }),
    kokYoneticiKumesi: async () => {
      const grup = await istemci.grup.findFirstOrThrow({
        where: { ustGrupId: null, silinmeZamani: null },
        select: { id: true },
      });
      const rol = await istemci.rol.findUniqueOrThrow({
        where: { kod: KOK_YONETICI_ROL_KODU },
        select: { id: true },
      });
      return { grupId: grup.id, rolId: rol.id };
    },
    kimlikSistemAktoru: () => kimlikSistemAktoru(istemci),
  };
}
