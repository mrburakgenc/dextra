// IRolOkumaRepo'nun gerçeklemesi: rol ve izin kayıtlarını işlemin istemcisiyle okur. Sorguyu kendisi
// yazar; satır süzgecini, kolon seçimini ve okumayı kapatan işlevi yetki kapısının okuma yüzünden alır
// (TS-007 "Yapı").
import type { RepoIstemcisi } from '../../../../../shared/database/infrastructure/registrar.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import type { IRolOkumaRepo } from '../../domain/repositories/i-rol.repository.js';

function yon({ yon }: Siralama): 'asc' | 'desc' {
  return yon === 'artan' ? 'asc' : 'desc';
}

// Sıralama alanları sorgu şemalarındakilerdir; başka alan şemadan geçmez.
function rolSirasi(siralama: Siralama) {
  switch (siralama.alan) {
    case 'ad':
      return { ad: yon(siralama) };
    case 'kod':
      return { kod: yon(siralama) };
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${siralama.alan}`);
}

function izinSirasi(siralama: Siralama) {
  switch (siralama.alan) {
    case 'kaynak':
      return { kaynak: yon(siralama) };
    case 'eylem':
      return { eylem: yon(siralama) };
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${siralama.alan}`);
}

// Sıralanan kolon yetkinin bakılan kolonudur: onu göremeyen kural okumaya katılmaz. Sıranın sonunda
// kimlik vardır; sayfalar birbiriyle tutarlıdır. Liste yalnız canlı rolleri verir; silinme süzgeci
// sorgunundur, kişinin baktığı kolonlara girmez (TS-002 AK-42).
export function rolOkumaPrismaRepository(
  istemci: RepoIstemcisi,
  kapi: OkumaKapisi,
): IRolOkumaRepo {
  return {
    roller: async (siralama, sayfa) => {
      const yetki = kapi.yetki('Rol', {
        bakilan: siralama.map(({ alan }) => alan),
      });
      const satirlar = await istemci.rol.findMany({
        where: { AND: [{ silinmeZamani: null }, yetki.satirlar] },
        orderBy: [...siralama.map(rolSirasi), { id: 'asc' }],
        skip: sayfa.atla,
        take: sayfa.al,
        select: yetki.kolonlar,
      });
      return yetki.kayitlar(satirlar, (where, select) =>
        istemci.rol.findMany({ where, select }),
      );
    },
    rol: async (id) => {
      const yetki = kapi.yetki('Rol', { bakilan: [] });
      const satirlar = await istemci.rol.findMany({
        where: { AND: [{ id }, yetki.satirlar] },
        select: yetki.kolonlar,
      });
      const [kayit] = await yetki.kayitlar(satirlar, (where, select) =>
        istemci.rol.findMany({ where, select }),
      );
      if (kayit === undefined) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      return kayit;
    },
    izinler: async (siralama, sayfa) => {
      const yetki = kapi.yetki('Izin', {
        bakilan: siralama.map(({ alan }) => alan),
      });
      const satirlar = await istemci.izin.findMany({
        where: yetki.satirlar,
        orderBy: [...siralama.map(izinSirasi), { id: 'asc' }],
        skip: sayfa.atla,
        take: sayfa.al,
        select: yetki.kolonlar,
      });
      return yetki.kayitlar(satirlar, (where, select) =>
        istemci.izin.findMany({ where, select }),
      );
    },
  };
}
