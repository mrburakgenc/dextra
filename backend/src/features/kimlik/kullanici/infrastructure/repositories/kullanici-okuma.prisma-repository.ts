// IKullaniciOkumaRepo'nun gerçeklemesi: kullanıcı kayıtlarını işlemin istemcisiyle okur. Sorguyu kendisi
// yazar; satır süzgecini, kolon seçimini ve okumayı kapatan işlevi yetki kapısının okuma yüzünden alır
// (TS-007 "Yapı").
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IKullaniciOkumaRepo } from '../../domain/repositories/i-kullanici.repository.js';

function yon({ yon }: Siralama): 'asc' | 'desc' {
  return yon === 'artan' ? 'asc' : 'desc';
}

// Sıralama alanları sorgu şemasındakilerdir; başka alan şemadan geçmez.
function kullaniciSirasi(siralama: Siralama) {
  switch (siralama.alan) {
    case 'gorunenAd':
      return { gorunenAd: yon(siralama) };
    case 'kullaniciAdi':
      return { kullaniciAdi: yon(siralama) };
    case 'olusturmaZamani':
      return { olusturmaZamani: yon(siralama) };
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${siralama.alan}`);
}

// Süzülen ve sıralanan kolon yetkinin bakılan kolonudur: onu göremeyen kural okumaya katılmaz. Sıranın
// sonunda kimlik vardır; sayfalar birbiriyle tutarlıdır.
export function kullaniciOkumaPrismaRepository(
  istemci: RepoIstemcisi,
  kapi: OkumaKapisi,
): IKullaniciOkumaRepo {
  return {
    liste: async ({ pasif, siralama, atla, al }) => {
      const yetki = kapi.yetki('Kullanici', {
        bakilan: [
          ...(pasif === undefined ? [] : ['pasifZamani']),
          ...(siralama === undefined ? [] : [siralama.alan]),
        ],
      });
      const satirlar = await istemci.kullanici.findMany({
        where: {
          AND: [
            pasif === undefined
              ? {}
              : { pasifZamani: pasif ? { not: null } : { equals: null } },
            yetki.satirlar,
          ],
        },
        orderBy: [
          ...(siralama === undefined ? [] : [kullaniciSirasi(siralama)]),
          { id: 'asc' },
        ],
        skip: atla,
        take: al,
        select: yetki.kolonlar,
      });
      return yetki.kayitlar(satirlar, (where, select) =>
        istemci.kullanici.findMany({ where, select }),
      );
    },
    tek: async (id) => {
      const yetki = kapi.yetki('Kullanici', { bakilan: [] });
      const satirlar = await istemci.kullanici.findMany({
        where: { AND: [{ id }, yetki.satirlar] },
        select: yetki.kolonlar,
      });
      const [kayit] = await yetki.kayitlar(satirlar, (where, select) =>
        istemci.kullanici.findMany({ where, select }),
      );
      if (kayit === undefined) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      return kayit;
    },
  };
}
