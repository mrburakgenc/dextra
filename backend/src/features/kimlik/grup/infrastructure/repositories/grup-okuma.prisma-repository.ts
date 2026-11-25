// IGrupOkumaRepo'nun gerçeklemesi: grup kayıtlarını işlemin istemcisiyle okur. Sorguyu kendisi yazar;
// satır süzgecini, kolon seçimini ve okumayı kapatan işlevi yetki kapısının okuma yüzünden alır
// (TS-007 "Yapı").
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IGrupOkumaRepo } from '../../domain/repositories/i-grup.repository.js';

function yon({ yon }: Siralama): 'asc' | 'desc' {
  return yon === 'artan' ? 'asc' : 'desc';
}

// Sıralama alanları sorgu şemasındakilerdir; başka alan şemadan geçmez.
function grupSirasi(siralama: Siralama) {
  switch (siralama.alan) {
    case 'ad':
      return { ad: yon(siralama) };
    case 'olusturmaZamani':
      return { olusturmaZamani: yon(siralama) };
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${siralama.alan}`);
}

// Liste düzdür: her kayıt ustGrupId taşır, ağacı ekran kurar. Süzülen üst grup ve sıralanan kolon
// yetkinin bakılan kolonlarıdır; sıranın sonunda kimlik vardır. Liste yalnız canlı kayıtları verir;
// silinme süzgeci sorgunundur, kişinin baktığı kolonlara girmez (TS-002 AK-42). Tek kayıt silinmiş
// grubu da verir.
export function grupOkumaPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<IGrupOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: async ({ ustGrupId, siralama, atla, al }) => {
      const yetki = kapi.yetki('Grup', {
        bakilan: [
          ...(ustGrupId === undefined ? [] : ['ustGrupId']),
          ...(siralama === undefined ? [] : [siralama.alan]),
        ],
      });
      const satirlar = await istemci.grup.findMany({
        where: {
          AND: [
            {
              silinmeZamani: null,
              ...(ustGrupId === undefined ? {} : { ustGrupId }),
            },
            yetki.satirlar,
          ],
        },
        orderBy: [
          ...(siralama === undefined ? [] : [grupSirasi(siralama)]),
          { id: 'asc' },
        ],
        skip: atla,
        take: al,
        select: yetki.kolonlar,
      });
      return yetki.kayitlar(satirlar, (where, select) =>
        istemci.grup.findMany({ where, select }),
      );
    },
    tek: async (id) => {
      const yetki = kapi.yetki('Grup', { bakilan: [] });
      const satirlar = await istemci.grup.findMany({
        where: { AND: [{ id }, yetki.satirlar] },
        select: yetki.kolonlar,
      });
      const [kayit] = await yetki.kayitlar(satirlar, (where, select) =>
        istemci.grup.findMany({ where, select }),
      );
      if (kayit === undefined) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      return kayit;
    },
  });
}
