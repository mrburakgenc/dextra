// IOturumYonetimOkumaRepo'nun gerçeklemesi: oturum kayıtlarını işlemin istemcisiyle okur. Sorguyu
// kendisi yazar; satır süzgecini, kolon seçimini ve okumayı kapatan işlevi yetki kapısının okuma
// yüzünden alır (TS-007 "Yapı").
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../../shared/database/infrastructure/registrar.js';
import { KodluHata } from '../../../../../shared/http/domain/kodlu-hata.js';
import type { Siralama } from '../../../../../shared/yetki/domain/okuma-tipleri.js';
import type { SatirSuzgeci } from '../../../../../shared/yetki/infrastructure/model-tipleri.js';
import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';
import { HAREKETSIZLIK_SINIRI_MS } from '../../domain/entities/oturum.entity.js';
import type {
  IOturumYonetimOkumaRepo,
  OturumGorunumu,
} from '../../domain/repositories/i-oturum-yonetim.repository.js';

// Bir okumanın koşulu ve baktığı kolonlar.
interface Parca {
  readonly kosul: SatirSuzgeci<'Oturum'>;
  readonly bakilan: readonly string[];
}

// Açıklık süzgecinin parçaları (TS-002 "Veri modeli"; oturum denetimiyle aynı tanım). Açık oturum:
// kapatılmamış, mutlak bitişi geçmemiş ve son döndürmesinden beri hareketsizlik sınırı dolmamış.
// Açık olmayanlar bunun tersidir ve üç ayrık parçaya bölünür: kapatılmış; kapatılmamış ve mutlak
// bitişi geçmiş; kapatılmamış, mutlak bitişi geçmemiş ve hareketsizlik sınırı dolmuş. Her parça ayrı
// okunur ve yalnız kendi baktığı kolonları yetkiye verir: bir parçanın kolonlarını gören kural o
// parçanın okumasına katılır.
function aciklikParcalari(acik: boolean, simdi: Date): Parca[] {
  const sinir = new Date(simdi.getTime() - HAREKETSIZLIK_SINIRI_MS);
  if (acik) {
    return [
      {
        kosul: {
          kapatilmaZamani: null,
          mutlakBitisZamani: { gt: simdi },
          sonDondurmeZamani: { gt: sinir },
        },
        bakilan: ['kapatilmaZamani', 'mutlakBitisZamani', 'sonDondurmeZamani'],
      },
    ];
  }
  return [
    {
      kosul: { kapatilmaZamani: { not: null } },
      bakilan: ['kapatilmaZamani'],
    },
    {
      kosul: { kapatilmaZamani: null, mutlakBitisZamani: { lte: simdi } },
      bakilan: ['kapatilmaZamani', 'mutlakBitisZamani'],
    },
    {
      kosul: {
        kapatilmaZamani: null,
        mutlakBitisZamani: { gt: simdi },
        sonDondurmeZamani: { lte: sinir },
      },
      bakilan: ['kapatilmaZamani', 'mutlakBitisZamani', 'sonDondurmeZamani'],
    },
  ];
}

function yon({ yon }: Siralama): 'asc' | 'desc' {
  return yon === 'artan' ? 'asc' : 'desc';
}

// Sıralama alanları sorgu şemasındakilerdir; başka alan şemadan geçmez.
function oturumSirasi(siralama: Siralama) {
  switch (siralama.alan) {
    case 'baslangicZamani':
      return { baslangicZamani: yon(siralama) };
    case 'sonDondurmeZamani':
      return { sonDondurmeZamani: yon(siralama) };
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${siralama.alan}`);
}

// Kaydın sıralanan alandaki zamanı. Sıralanan alan bakılan kolondur: okumaya katılan her kural onu
// görür ve kayıtta vardır.
function sirasi(kayit: OturumGorunumu, alan: string): number {
  switch (alan) {
    case 'baslangicZamani':
      return Number(kayit.baslangicZamani);
    case 'sonDondurmeZamani':
      return Number(kayit.sonDondurmeZamani);
  }
  throw new Error(`Sıralama için bilinmeyen alan: ${alan}`);
}

// Sorgunun sırasıyla (alan, sonra kimlik artan) a, b'den önce mi.
function once(
  a: OturumGorunumu,
  b: OturumGorunumu,
  { alan, yon }: Siralama,
): boolean {
  const fark = sirasi(a, alan) - sirasi(b, alan);
  if (fark !== 0) {
    return yon === 'artan' ? fark < 0 : fark > 0;
  }
  return a.id < b.id;
}

// Her biri sorgunun sırasıyla gelen ayrık listeleri sırayı koruyarak birleştirir. İlk n çıktı yalnız
// listelerin ilk n öğesine bağlıdır; bu yüzden her parçadan ilk (atla + al) kayıt istenip birleşimden
// sayfa kesilince sayfalar birbiriyle tutarlıdır.
function birlestir(
  listeler: readonly OturumGorunumu[][],
  siralama: Siralama,
): OturumGorunumu[] {
  const kalanlar = listeler.map((liste) => [...liste]);
  const sonuc: OturumGorunumu[] = [];
  for (;;) {
    let secilen: OturumGorunumu[] | undefined;
    for (const kalan of kalanlar) {
      const [bas] = kalan;
      const [enIyi] = secilen ?? [];
      if (
        bas !== undefined &&
        (enIyi === undefined || once(bas, enIyi, siralama))
      ) {
        secilen = kalan;
      }
    }
    const kayit = secilen?.shift();
    if (kayit === undefined) {
      return sonuc;
    }
    sonuc.push(kayit);
  }
}

// Süzülen ve sıralanan kolonlar yetkinin bakılan kolonlarıdır; sıranın sonunda kimlik vardır. Kişinin
// verdiği süzgeçlerin tipini uç şeması doğrular (TS-002 AK-44).
export function oturumYonetimOkumaPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<IOturumYonetimOkumaRepo> {
  return (istemci: RepoIstemcisi) => {
    const oku = async (
      { kosul, bakilan }: Parca,
      kullaniciId: string | undefined,
      siralama: Siralama,
      atla: number,
      al: number,
    ): Promise<OturumGorunumu[]> => {
      const yetki = kapi.yetki('Oturum', {
        bakilan: [
          ...(kullaniciId === undefined ? [] : ['kullaniciId']),
          ...bakilan,
          siralama.alan,
        ],
      });
      const satirlar = await istemci.oturum.findMany({
        where: {
          AND: [
            kullaniciId === undefined ? {} : { kullaniciId },
            kosul,
            yetki.satirlar,
          ],
        },
        orderBy: [oturumSirasi(siralama), { id: 'asc' }],
        skip: atla,
        take: al,
        select: yetki.kolonlar,
      });
      return yetki.kayitlar(satirlar, (where, select) =>
        istemci.oturum.findMany({ where, select }),
      );
    };
    return {
      liste: async ({ kullaniciId, acik, simdi, siralama, atla, al }) => {
        const parcalar =
          acik === undefined
            ? [{ kosul: {}, bakilan: [] }]
            : aciklikParcalari(acik, simdi);
        const [tekParca] = parcalar;
        if (parcalar.length === 1 && tekParca !== undefined) {
          return oku(tekParca, kullaniciId, siralama, atla, al);
        }
        const listeler: OturumGorunumu[][] = [];
        for (const parca of parcalar) {
          listeler.push(await oku(parca, kullaniciId, siralama, 0, atla + al));
        }
        return birlestir(listeler, siralama).slice(atla, atla + al);
      },
      tek: async (id) => {
        const yetki = kapi.yetki('Oturum', { bakilan: [] });
        const satirlar = await istemci.oturum.findMany({
          where: { AND: [{ id }, yetki.satirlar] },
          select: yetki.kolonlar,
        });
        const [kayit] = await yetki.kayitlar(satirlar, (where, select) =>
          istemci.oturum.findMany({ where, select }),
        );
        if (kayit === undefined) {
          throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
        }
        return kayit;
      },
    };
  };
}
