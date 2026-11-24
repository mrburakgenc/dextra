import { Inject, Injectable } from '@nestjs/common';
import type { RepoIstemcisi } from '../database/registrar.js';
import { type IstekBaglami, istekBaglami } from '../http/istek-baglami.js';
import { KodluHata } from '../http/kodlu-hata.js';
import { KAYNAK_KATALOGU, type KaynakKatalogu } from './kaynak-katalogu.js';
import {
  type KosulOgesi,
  kosuluCevir,
  type PrismaKosulu,
} from './sart-cevirici.js';
import type { YetenekKurali } from './yetenek-derleyici.js';

// Kapının döndürdüğü kayıt: yalnız isteyenin görebildiği kolonlar.
export type Kayit = Readonly<Record<string, unknown>>;

export interface Siralama {
  readonly alan: string;
  readonly yon: 'artan' | 'azalan';
}

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
  findMany(args: object): Promise<Record<string, unknown>[]>;
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
@Injectable()
export class OkumaKapisi {
  constructor(
    @Inject(KAYNAK_KATALOGU) private readonly katalog: KaynakKatalogu,
  ) {}

  async liste(
    istemci: RepoIstemcisi,
    kaynak: string,
    istek: ListeIstegi = {},
  ): Promise<Kayit[]> {
    const { alanlar, vekil } = this.kaynak(istemci, kaynak);
    const ceviri = kosuluCevir(istek.kosul ?? [], alanlar);
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
    return this.oku(kaynak, alanlar, vekil, {
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
    const { alanlar, vekil } = this.kaynak(istemci, kaynak);
    const [kayit] = await this.oku(kaynak, alanlar, vekil, {
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
  ): { alanlar: readonly string[]; vekil: OkumaVekili } {
    const alanlar = this.katalog.alanlar(kaynak);
    // Prisma istemcisinde modelin vekili, model adının ilk harfi küçük hâlidir.
    const vekil = (istemci as unknown as Partial<Record<string, OkumaVekili>>)[
      kaynak.charAt(0).toLowerCase() + kaynak.slice(1)
    ];
    if (alanlar === undefined || vekil === undefined) {
      throw new Error(`Kaynak kataloğunda olmayan kaynak: ${kaynak}`);
    }
    return { alanlar, vekil };
  }

  private async oku(
    kaynak: string,
    alanlar: readonly string[],
    vekil: OkumaVekili,
    okuma: Okuma,
  ): Promise<Kayit[]> {
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
        okuma.bakilan.every((alan) => kolonlar.includes(alan)),
      );
    const ilkKume = kumeAnahtari(katilanlar[0]?.kolonlar ?? []);
    const ortakKolonlar = katilanlar.every(
      ({ kolonlar }) => kumeAnahtari(kolonlar) === ilkKume,
    )
      ? (katilanlar[0]?.kolonlar ?? [])
      : undefined;

    // Prisma 7.10.1, "ve"nin içindeki boş "veya"yı koşulsuz sayar (WHERE 1=1; GV-033'te ölçüldü). Bu
    // yüzden kural yoksa satır süzgeci hiçbir satıra uymayan boş kimlik listesidir.
    const satirSuzgeci =
      katilanlar.length === 0
        ? { id: { in: [] } }
        : { OR: katilanlar.map(({ kural }) => kural.conditions ?? {}) };
    const sayfa = await vekil.findMany({
      where: { AND: [okuma.kosul, satirSuzgeci] },
      orderBy: [
        ...okuma.siralama.map(({ alan, yon }) => ({
          [alan]: yon === 'artan' ? 'asc' : 'desc',
        })),
        { id: 'asc' },
      ],
      ...(okuma.sayfa === undefined
        ? {}
        : { skip: okuma.sayfa.atla, take: okuma.sayfa.al }),
      select: secim(ortakKolonlar ?? []),
    });

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
        const satirlar = await vekil.findMany({
          where: { AND: [{ id: { in: idler } }, kural.conditions ?? {}] },
          select: secim(kolonlar),
        });
        for (const satir of satirlar) {
          Object.assign(birlesik.get(satir['id']) ?? {}, sec(satir, kolonlar));
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
