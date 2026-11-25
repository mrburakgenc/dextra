import { Injectable } from '@nestjs/common';
import type {
  RepoFabrikasi,
  RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { Islem } from '../../../../shared/database/unit-of-work.js';
import type {
  Kayit,
  OkumaKapisi,
  Siralama,
} from '../../../../shared/yetki/okuma-kapisi.js';
import type { KosulOgesi } from '../../../../shared/yetki/sart-cevirici.js';
import { YazmaKapisi } from '../../../../shared/yetki/yazma-kapisi.js';
import { HAREKETSIZLIK_SINIRI_MS } from '../domain/oturum-denetimi.js';
import {
  type OturumKapatmasi,
  type OturumYonetimOkumaRepo,
  OturumYonetimYazmaRepo,
} from '../domain/oturum-yonetim.repository.js';

const KAYNAK = 'Oturum';

@Injectable()
export class OturumKapiYazmaRepo extends OturumYonetimYazmaRepo {
  constructor(private readonly kapi: YazmaKapisi) {
    super();
  }

  kapatNiyeti(
    islem: Islem,
    isAdi: string,
    id: string,
    kapatma?: OturumKapatmasi,
  ): Promise<void> {
    return this.kapi.niyet(islem, isAdi, KAYNAK, 'kapat', id, {
      ...kapatma,
    });
  }
}

// Açıklık süzgecinin parçaları (TS-002 "Veri modeli"; oturum denetimiyle aynı tanım). Açık oturum:
// kapatılmamış, mutlak bitişi geçmemiş ve son döndürmesinden beri hareketsizlik sınırı dolmamış.
// Açık olmayanlar bunun tersidir ve üç ayrık parçaya bölünür, çünkü kapının koşulu yalnız "ve"
// bağlar: kapatılmış; kapatılmamış ve mutlak bitişi geçmiş; kapatılmamış, mutlak bitişi geçmemiş ve
// hareketsizlik sınırı dolmuş.
function aciklikParcalari(acik: boolean, simdi: Date): KosulOgesi[][] {
  const an = simdi.toISOString();
  const sinir = new Date(
    simdi.getTime() - HAREKETSIZLIK_SINIRI_MS,
  ).toISOString();
  const kapatilmamis: KosulOgesi = { alan: 'kapatilmaZamani', islec: 'bos' };
  const bitmemis: KosulOgesi = {
    alan: 'mutlakBitisZamani',
    islec: 'buyuk',
    deger: an,
  };
  if (acik) {
    return [
      [
        kapatilmamis,
        bitmemis,
        { alan: 'sonDondurmeZamani', islec: 'buyuk', deger: sinir },
      ],
    ];
  }
  return [
    [{ alan: 'kapatilmaZamani', islec: 'dolu' }],
    [
      kapatilmamis,
      { alan: 'mutlakBitisZamani', islec: 'kucuk_esit', deger: an },
    ],
    [
      kapatilmamis,
      bitmemis,
      { alan: 'sonDondurmeZamani', islec: 'kucuk_esit', deger: sinir },
    ],
  ];
}

// Kapının sırasıyla (alan, sonra kimlik artan) a, b'den önce mi. Sıralanabilen alanlar zamandır.
function once(a: Kayit, b: Kayit, { alan, yon }: Siralama): boolean {
  const fark = (a[alan] as Date).getTime() - (b[alan] as Date).getTime();
  if (fark !== 0) {
    return yon === 'artan' ? fark < 0 : fark > 0;
  }
  return (a['id'] as string) < (b['id'] as string);
}

// Her biri kapının sırasıyla gelen ayrık listeleri sırayı koruyarak birleştirir. İlk n çıktı yalnız
// listelerin ilk n öğesine bağlıdır; bu yüzden her parçadan ilk (atla + al) kayıt istenip birleşimden
// sayfa kesilince sayfalar birbiriyle tutarlıdır.
function birlestir(listeler: readonly Kayit[][], siralama: Siralama): Kayit[] {
  const kalanlar = listeler.map((liste) => [...liste]);
  const sonuc: Kayit[] = [];
  for (;;) {
    let secilen: Kayit[] | undefined;
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

export function oturumYonetimPrismaRepository(
  kapi: OkumaKapisi,
): RepoFabrikasi<OturumYonetimOkumaRepo> {
  return (istemci: RepoIstemcisi) => ({
    liste: async ({ kullaniciId, acik, simdi, siralama, atla, al }) => {
      const kisi: KosulOgesi[] =
        kullaniciId === undefined
          ? []
          : [{ alan: 'kullaniciId', islec: 'esit', deger: kullaniciId }];
      const parcalar =
        acik === undefined ? [[]] : aciklikParcalari(acik, simdi);
      if (parcalar.length === 1) {
        return kapi.liste(istemci, KAYNAK, {
          kosul: [...kisi, ...(parcalar[0] ?? [])],
          siralama: [siralama],
          sayfa: { atla, al },
        });
      }
      const listeler: Kayit[][] = [];
      for (const parca of parcalar) {
        listeler.push(
          await kapi.liste(istemci, KAYNAK, {
            kosul: [...kisi, ...parca],
            siralama: [siralama],
            sayfa: { atla: 0, al: atla + al },
          }),
        );
      }
      return birlestir(listeler, siralama).slice(atla, atla + al);
    },
    tek: (id) => kapi.tek(istemci, KAYNAK, id),
  });
}
