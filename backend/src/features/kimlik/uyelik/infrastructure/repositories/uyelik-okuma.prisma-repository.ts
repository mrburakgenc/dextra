// IUyelikOkumaRepo'nun gerçeklemesi: üyelik kayıtlarını işlemin istemcisiyle okur. Sorguyu kendisi
// yazar; satır süzgecini, kolon seçimini ve okumayı kapatan işlevi yetki kapısının okuma yüzünden alır
// (TS-007 "Yapı").
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IUyelikOkumaRepo } from '../../domain/repositories/i-uyelik.repository.js';

function yon({ yon }: Siralama): 'asc' | 'desc' {
  return yon === 'artan' ? 'asc' : 'desc';
}

// Sıralama alanları sorgu şemasındakilerdir; başka alan şemadan geçmez.
function uyelikSirasi(siralama: Siralama) {
  switch (siralama.alan) {
    case 'olusturmaZamani':
      return { olusturmaZamani: yon(siralama) };
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${siralama.alan}`);
}

// Süzülen ve sıralanan kolonlar yetkinin bakılan kolonlarıdır; sıranın sonunda kimlik vardır. Liste
// yalnız canlı kayıtları verir; silinme süzgeci sorgunundur, kişinin baktığı kolonlara girmez (TS-002
// AK-42). Kişinin verdiği süzgeçlerin tipini uç şeması doğrular (AK-44).
export function uyelikOkumaPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<IUyelikOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: async ({ kullaniciId, grupId, rolId, siralama, atla, al }) => {
      const yetki = kapi.yetki('Uyelik', {
        bakilan: [
          ...(kullaniciId === undefined ? [] : ['kullaniciId']),
          ...(grupId === undefined ? [] : ['grupId']),
          ...(rolId === undefined ? [] : ['rolId']),
          ...(siralama === undefined ? [] : [siralama.alan]),
        ],
      });
      const satirlar = await istemci.uyelik.findMany({
        where: {
          AND: [
            {
              silinmeZamani: null,
              ...(kullaniciId === undefined ? {} : { kullaniciId }),
              ...(grupId === undefined ? {} : { grupId }),
              ...(rolId === undefined ? {} : { rolId }),
            },
            yetki.satirlar,
          ],
        },
        orderBy: [
          ...(siralama === undefined ? [] : [uyelikSirasi(siralama)]),
          { id: 'asc' },
        ],
        skip: atla,
        take: al,
        select: yetki.kolonlar,
      });
      return yetki.kayitlar(satirlar, (where, select) =>
        istemci.uyelik.findMany({ where, select }),
      );
    },
    tek: async (id) => {
      const yetki = kapi.yetki('Uyelik', { bakilan: [] });
      const satirlar = await istemci.uyelik.findMany({
        where: { AND: [{ id }, yetki.satirlar] },
        select: yetki.kolonlar,
      });
      const [kayit] = await yetki.kayitlar(satirlar, (where, select) =>
        istemci.uyelik.findMany({ where, select }),
      );
      if (kayit === undefined) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      return kayit;
    },
  });
}
