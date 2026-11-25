// IYetenekRepo'nun gerçeklemesi: yetenek ve izin kayıtlarını işlemin istemcisiyle okur. Sorguyu kendisi
// yazar; satır süzgecini, kolon seçimini ve okumayı kapatan işlevi yetki kapısının okuma yüzünden alır
// (TS-007 "Yapı").
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IYetenekRepo } from '../../domain/repositories/i-yetenek.repository.js';

function yon({ yon }: Siralama): 'asc' | 'desc' {
  return yon === 'artan' ? 'asc' : 'desc';
}

// Sıralama alanları sorgu şemasındakilerdir; başka alan şemadan geçmez.
function yetenekSirasi(siralama: Siralama) {
  switch (siralama.alan) {
    case 'olusturmaZamani':
      return { olusturmaZamani: yon(siralama) };
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${siralama.alan}`);
}

// Liste yalnız canlı yetenekleri verir; silinme süzgeci sorgunundur, kişinin baktığı kolonlara girmez
// (TS-002 AK-42): silinme zamanını göremeyen yetenek de listeye katılır. Kimlik süzgeçleri ve sıralanan
// kolon yetkinin bakılan kolonlarıdır; baktıkları kolonu göremeyen yetenek katılmaz. Sıranın sonunda
// kimlik vardır.
export function yetenekOkumaPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<IYetenekRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: async ({ grupId, rolId, izinId, siralama, atla, al }) => {
      const suzulen = {
        ...(grupId === undefined ? {} : { grupId }),
        ...(rolId === undefined ? {} : { rolId }),
        ...(izinId === undefined ? {} : { izinId }),
      };
      const yetki = kapi.yetki('Yetenek', {
        bakilan: [
          ...Object.keys(suzulen),
          ...(siralama === undefined ? [] : [siralama.alan]),
        ],
      });
      const satirlar = await istemci.yetenek.findMany({
        where: { AND: [{ silinmeZamani: null, ...suzulen }, yetki.satirlar] },
        orderBy: [
          ...(siralama === undefined ? [] : [yetenekSirasi(siralama)]),
          { id: 'asc' },
        ],
        skip: atla,
        take: al,
        select: yetki.kolonlar,
      });
      return yetki.kayitlar(satirlar, (where, select) =>
        istemci.yetenek.findMany({ where, select }),
      );
    },
    tek: async (id) => {
      const yetki = kapi.yetki('Yetenek', { bakilan: [] });
      const satirlar = await istemci.yetenek.findMany({
        where: { AND: [{ id }, yetki.satirlar] },
        select: yetki.kolonlar,
      });
      const [kayit] = await yetki.kayitlar(satirlar, (where, select) =>
        istemci.yetenek.findMany({ where, select }),
      );
      if (kayit === undefined) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      return kayit;
    },
    // Kimliğe göre süzme her okuma kuralında serbesttir (AK-38).
    izin: async (id) => {
      const yetki = kapi.yetki('Izin', { bakilan: [] });
      const satirlar = await istemci.izin.findMany({
        where: { AND: [{ id }, yetki.satirlar] },
        select: yetki.kolonlar,
      });
      const [kayit] = await yetki.kayitlar(satirlar, (where, select) =>
        istemci.izin.findMany({ where, select }),
      );
      return kayit;
    },
  });
}
