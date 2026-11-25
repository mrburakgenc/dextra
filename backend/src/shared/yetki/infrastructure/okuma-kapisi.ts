import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../database/generated/client.js';
import type { RepoIstemcisi } from '../../database/infrastructure/registrar.js';
import {
  type IstekBaglami,
  istekBaglami,
} from '../../observability/istek-baglami/istek-baglami.js';
import { KodluHata } from '../../http/domain/kodlu-hata.js';
import {
  type KosulOgesi,
  kosuluCevir,
  type PrismaKosulu,
} from '../application/sart-cevirici.js';
import type { YetenekKurali } from '../application/yetenek-derleyici.js';
import type { AlanTipi } from '../domain/alan-tipi.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../domain/kaynak-katalogu.js';
import type { Kayit, Siralama } from '../domain/okuma-tipleri.js';
import {
  type KolonSecimi,
  modelAdi,
  type SatirSuzgeci,
} from './model-tipleri.js';

// Çağıranın listeye verdiği koşul, sıralama ve sayfa; koşul yetkinin satır süzgeciyle "ve" ile birleşir.
// yalnizCanli açıkken yalnız silinme zamanı boş kayıtlar gelir (TS-002 AK-42); bu süzgeç kapınındır,
// çağıranın koşulu değildir: baktığı kolon, katılan yetenekler hesabına girmez. Silinme zamanı alanı
// olmayan kaynakta hatadır.
export interface ListeIstegi {
  readonly kosul?: readonly KosulOgesi[];
  readonly siralama?: readonly Siralama[];
  readonly sayfa?: { readonly atla: number; readonly al: number };
  readonly yalnizCanli?: boolean;
}

// Bu istekteki okumalarda kullanılan yetenek ve üyelik kimlikleri ve dönen kayıt sayısı (erişim kaydı
// için; KR-010 Seçim 40).
export interface OkumaBirikimi {
  readonly yetenekIdleri: readonly string[];
  readonly uyelikIdleri: readonly string[];
  readonly kayitSayisi: number;
}

const OKUMA_EYLEMI = 'oku';
const SILINME_ALANI = 'silinmeZamani';

interface Birikim {
  readonly yetenekIdleri: Set<string>;
  readonly uyelikIdleri: Set<string>;
  kayitSayisi: number;
}

// Anahtar isteğin bağlam nesnesidir: birikim o isteğe bağlıdır ve istekle birlikte düşer.
const birikimler = new WeakMap<IstekBaglami, Birikim>();

// Koşan isteğin okuma birikimi; okuma yapılmadıysa boş.
export function okumaBirikimi(): OkumaBirikimi {
  const birikim = birikimler.get(istekBaglami());
  return {
    yetenekIdleri: [...(birikim?.yetenekIdleri ?? [])],
    uyelikIdleri: [...(birikim?.uyelikIdleri ?? [])],
    kayitSayisi: birikim?.kayitSayisi ?? 0,
  };
}

interface OkumaVekili {
  findMany(
    args: object,
  ): Promise<({ readonly id: unknown } & Record<string, unknown>)[]>;
}

interface Katilan {
  readonly kural: YetenekKurali;
  readonly kolonlar: readonly string[];
}

interface Okuma {
  readonly kosul: PrismaKosulu;
  // Çağıranın süzgecinin ve sıralamasının baktığı kolonlar.
  readonly bakilan: readonly string[];
  readonly siralama: readonly Siralama[];
  readonly sayfa?: ListeIstegi['sayfa'];
}

// Okunan kayıt: kimlik her zaman vardır; kişinin göremediği kolon kayıtta yoktur.
export type Gorunum<S extends { readonly id: unknown }> = Pick<S, 'id'> &
  Partial<Omit<S, 'id'>>;

// Bir kaynağın bu istekteki okuma yetkisi (TS-007 "Yapı"). Repository sorguyu kendisi yazar: satır
// süzgecini koşuluna, kolon seçimini seçimine koyar ve okumayı kayitlar ile kapatır; kayitlar
// çağrılmadan dönen satır yetkiden geçmiş sayılmaz.
export interface OkumaYetkisi<M extends Prisma.ModelName> {
  // Okuma kurallarının koşullarından kurulan satır süzgeci; kuralı olmayan kişide hiçbir satıra uymaz.
  readonly satirlar: SatirSuzgeci<M>;
  // Kuralların ortak kolon kümesinin seçimi (kümeler farklıysa yalnız kimlik); kimlik her zaman seçilir.
  readonly kolonlar: KolonSecimi<M>;
  // Okumayı kapatır: kurallar farklı kolon kümeleri veriyorsa sayfadaki kimlikler için kural başına
  // yenidenOku ile yeniden okur ve sonuçları kayıt kimliğinde birleştirir; erişim kaydı birikimini
  // yazar. Kayıtlar sayfanın sırasıyla döner.
  kayitlar<S extends { readonly id: unknown }>(
    sayfa: readonly S[],
    yenidenOku: (
      where: SatirSuzgeci<M>,
      select: KolonSecimi<M>,
    ) => Promise<readonly S[]>,
  ): Promise<Gorunum<S>[]>;
}

// OkumaYetkisi'nin motorun kurduğu genel hâli.
interface GenelOkumaYetkisi {
  readonly satirlar: PrismaKosulu;
  readonly kolonlar: Record<string, true>;
  kayitlar(
    sayfa: readonly Record<string, unknown>[],
    yenidenOku: (
      where: PrismaKosulu,
      select: Record<string, true>,
    ) => Promise<readonly Record<string, unknown>[]>,
  ): Promise<Kayit[]>;
}

// Yetki kapısının okuma yüzü (TS-002 AK-19; KR-010 Seçim 26, 37 ve "Derleme eşlemesi"). Feature
// repository'si kataloğa bildirilmiş bir kaynağı yalnız buradan okur; yetki parametre değildir, istek
// bağlamındaki derlenmiş yetkiden alınır.
//
// Okuma iki adımdır. (1) Sayfa: çağıranın koşulu, okuma kurallarının koşullarının "veya"sıyla "ve"
// bağlanır; sıralama (sonda kimlik) ve sayfa bu tek sorguda veritabanında uygulanır, böylece sayfalar
// birleşik sonuç üzerinde tutarlıdır. (2) Kolonlar: kurallar farklı kolon kümeleri veriyorsa her kural
// kendi koşulu ve kendi kolonlarıyla, yalnız sayfadaki kimlikler için bir sorgu atar; sonuçlar kayıt
// kimliğinde birleşir ve her kayıt yalnız onu gören kuralların kolonlarının birleşimini taşır. Kolon
// kümeleri aynıysa ilk sorgu kolonları doğrudan seçer. Hiç kuralı olmayan kişide sorgu yine gider ve
// veritabanı hiçbir satır döndürmez.
//
// Kayıt kimliği her okuma kuralında görünür (TS-002 AK-38): kolon listesinde olmasa da her cevapta
// bulunur, kimliğe göre süzme ve sıralama her kuralda serbesttir. Bedeli: kimlik zaman sıralı (UUIDv7)
// olduğu için kaydı okuyabilen kişi oluşturma sırasını öğrenir. Çağıranın süzdüğü ya da sıraladığı
// başka bir kolonu göremeyen kural o okumaya katılmaz: süzme ve sıralama görünmeyen kolonu ele vermez
// (KR-010 ikinci çürütme turu kuralları).
//
// İki yüzü vardır (TS-007 "Yapı"). Yeni yüz yetki'dir: repository Prisma sorgusunu kendisi yazar,
// süzgeci, seçimi ve okumayı kapatan işlevi buradan alır. Kaynak adıyla çalışan liste ve tek eski
// yüzdür: modelin vekilini addan bulur ve sorguyu yeni yüzün üstünde kendisi atar; motorun kuralları
// yalnız yetki'dedir.
@Injectable()
export class OkumaKapisi {
  constructor(
    @Inject(KAYNAK_KATALOGU) private readonly katalog: KaynakKatalogu,
  ) {}

  // bakilan, çağıranın süzdüğü ve sıraladığı kolonlardır.
  yetki<M extends Prisma.ModelName>(
    kaynak: M,
    { bakilan }: { readonly bakilan: readonly string[] },
  ): OkumaYetkisi<M> {
    const alanlar = this.katalog.alanlar(kaynak);
    if (alanlar === undefined) {
      throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
    }
    const baglam = istekBaglami();
    const yetki = baglam.yetki;
    if (yetki === undefined) {
      throw new Error('İstek bağlamında derlenmiş yetki yok');
    }
    const katilanlar: Katilan[] = yetki.kurallar
      .filter((k) => k.subject === kaynak && k.action === OKUMA_EYLEMI)
      .map((kural) => ({
        kural,
        kolonlar:
          kural.fields === undefined
            ? alanlar
            : [...new Set(['id', ...[kural.fields].flat()])],
      }))
      .filter(({ kolonlar }) =>
        bakilan.every((alan) => kolonlar.includes(alan)),
      );
    const ilkKume = kumeAnahtari(katilanlar[0]?.kolonlar ?? []);
    const ortakKolonlar = katilanlar.every(
      ({ kolonlar }) => kumeAnahtari(kolonlar) === ilkKume,
    )
      ? (katilanlar[0]?.kolonlar ?? [])
      : undefined;

    // Prisma 7.10.1, "ve"nin içindeki boş "veya"yı koşulsuz sayar (WHERE 1=1; GV-033'te ölçüldü). Bu
    // yüzden kural yoksa satır süzgeci hiçbir satıra uymayan boş kimlik listesidir. "Veya"nın içindeki
    // boş koşulu ise yok sayar; bu yüzden koşulsuz kural "veya"ya konmaz, süzgeci koşulsuz yapar
    // (TS-002 AK-52).
    const satirSuzgeci =
      katilanlar.length === 0
        ? { id: { in: [] } }
        : katilanlar.some(({ kural }) => kural.conditions === undefined)
          ? {}
          : { OR: katilanlar.map(({ kural }) => kural.conditions ?? {}) };

    const genel: GenelOkumaYetkisi = {
      satirlar: satirSuzgeci,
      kolonlar: secim(ortakKolonlar ?? []),
      kayitlar: async (sayfa, yenidenOku) => {
        let kayitlar: Kayit[];
        if (ortakKolonlar !== undefined || sayfa.length === 0) {
          kayitlar = sayfa.map((satir) => sec(satir, ortakKolonlar ?? []));
        } else {
          const idler = sayfa.map((satir) => satir['id']);
          // Map ekleme sırasını korur: kayıtlar sayfanın sırasıyla döner.
          const birlesik = new Map<unknown, Record<string, unknown>>(
            idler.map((id) => [id, {}]),
          );
          for (const { kural, kolonlar } of katilanlar) {
            const satirlar = await yenidenOku(
              { AND: [{ id: { in: idler } }, kural.conditions ?? {}] },
              secim(kolonlar),
            );
            for (const satir of satirlar) {
              Object.assign(
                birlesik.get(satir['id']) ?? {},
                sec(satir, kolonlar),
              );
            }
          }
          // İki sorgu arasında görünmez olan kayıt hiçbir kuraldan kolon almaz ve atılır; kolonsuz
          // kural derlenmediği için görünen kayıt en az bir kolon taşır.
          kayitlar = [...birlesik.values()].filter(
            (kayit) => Object.keys(kayit).length > 0,
          );
        }

        const birikim = birikimler.get(baglam) ?? {
          yetenekIdleri: new Set<string>(),
          uyelikIdleri: new Set<string>(),
          kayitSayisi: 0,
        };
        for (const { kural } of katilanlar) {
          birikim.yetenekIdleri.add(kural.yetenekId);
          const uyelikId = yetki.uyelikler[kural.yetenekId];
          if (uyelikId !== undefined) {
            birikim.uyelikIdleri.add(uyelikId);
          }
        }
        birikim.kayitSayisi += kayitlar.length;
        birikimler.set(baglam, birikim);
        return kayitlar;
      },
    };
    return genel as unknown as OkumaYetkisi<M>;
  }

  async liste(
    istemci: RepoIstemcisi,
    kaynak: string,
    istek: ListeIstegi = {},
  ): Promise<Kayit[]> {
    const { alanlar, tipler, vekil } = this.kaynak(istemci, kaynak);
    const ceviri = kosuluCevir(istek.kosul ?? [], tipler);
    // Tipi uymayan değer istekten gelir (uç şemasından kaçmıştır); veritabanına gitmeden doğrulama
    // hatası olur (TS-002 AK-44). Öbür çeviri hataları kodundur.
    if ('uyumsuz' in ceviri) {
      throw new KodluHata('dogrulama_hatasi', 'İstek doğrulanamadı', [
        { alan: 'kosul', neden: ceviri.uyumsuz },
      ]);
    }
    if ('neden' in ceviri) {
      throw new Error(`Okuma koşulu çevrilemedi: ${ceviri.neden}`);
    }
    const siralama = istek.siralama ?? [];
    for (const { alan } of siralama) {
      if (!alanlar.includes(alan)) {
        throw new Error(`Sıralama için bilinmeyen alan: ${alan}`);
      }
    }
    if (istek.yalnizCanli === true && !alanlar.includes(SILINME_ALANI)) {
      throw new Error(`Silinme zamanı alanı olmayan kaynak: ${kaynak}`);
    }
    return this.oku(kaynak, vekil, {
      kosul:
        istek.yalnizCanli === true
          ? { AND: [ceviri.kosul, { [SILINME_ALANI]: null }] }
          : ceviri.kosul,
      bakilan: [
        ...(istek.kosul ?? []).map((oge) => oge.alan),
        ...siralama.map((oge) => oge.alan),
      ],
      siralama,
      ...(istek.sayfa === undefined ? {} : { sayfa: istek.sayfa }),
    });
  }

  // Görülemeyen ya da var olmayan kayıt için bulunamadi.
  async tek(
    istemci: RepoIstemcisi,
    kaynak: string,
    id: string,
  ): Promise<Kayit> {
    const { vekil } = this.kaynak(istemci, kaynak);
    const [kayit] = await this.oku(kaynak, vekil, {
      kosul: { id: { equals: id } },
      bakilan: [],
      siralama: [],
    });
    if (kayit === undefined) {
      throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
    }
    return kayit;
  }

  private kaynak(
    istemci: RepoIstemcisi,
    kaynak: string,
  ): {
    alanlar: readonly string[];
    tipler: Readonly<Record<string, AlanTipi>>;
    vekil: OkumaVekili;
  } {
    const alanlar = this.katalog.alanlar(kaynak);
    const tipler = this.katalog.alanTipleri(kaynak);
    // Prisma istemcisinde modelin vekili, model adının ilk harfi küçük hâlidir.
    const vekil = (istemci as unknown as Partial<Record<string, OkumaVekili>>)[
      kaynak.charAt(0).toLowerCase() + kaynak.slice(1)
    ];
    if (alanlar === undefined || tipler === undefined || vekil === undefined) {
      throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
    }
    return { alanlar, tipler, vekil };
  }

  // Eski yüzün sorgusu: tek sorguda sayfa, sonra yeni yüzün kapatma işleviyle kayıtlar.
  private async oku(
    kaynak: string,
    vekil: OkumaVekili,
    okuma: Okuma,
  ): Promise<Kayit[]> {
    const yetki = this.yetki(modelAdi(kaynak), { bakilan: okuma.bakilan });
    const sayfa = await vekil.findMany({
      where: { AND: [okuma.kosul, yetki.satirlar] },
      orderBy: [
        ...okuma.siralama.map(({ alan, yon }) => ({
          [alan]: yon === 'artan' ? 'asc' : 'desc',
        })),
        { id: 'asc' },
      ],
      ...(okuma.sayfa === undefined
        ? {}
        : { skip: okuma.sayfa.atla, take: okuma.sayfa.al }),
      select: yetki.kolonlar,
    });
    return yetki.kayitlar(sayfa, (where, select) =>
      vekil.findMany({ where, select }),
    );
  }
}

function kumeAnahtari(kolonlar: readonly string[]): string {
  return JSON.stringify([...new Set(kolonlar)].sort());
}

// Kimlik birleştirme için her zaman seçilir; cevaba yalnız izinli kolonlar girer.
function secim(kolonlar: readonly string[]): Record<string, true> {
  return Object.fromEntries(
    ['id', ...kolonlar].map((kolon) => [kolon, true] as const),
  );
}

function sec(
  satir: Record<string, unknown>,
  kolonlar: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(kolonlar.map((k) => [k, satir[k]]));
}
