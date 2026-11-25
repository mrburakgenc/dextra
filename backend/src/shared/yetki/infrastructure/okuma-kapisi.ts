import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../database/generated/client.js';
import {
  type IstekBaglami,
  istekBaglami,
} from '../../observability/istek-baglami/istek-baglami.js';
import type { PrismaKosulu } from '../application/sart-cevirici.js';
import type { YetenekKurali } from '../application/yetenek-derleyici.js';
import {
  KAYNAK_KATALOGU,
  type KaynakKatalogu,
} from '../domain/kaynak-katalogu.js';
import type { Kayit } from '../domain/okuma-tipleri.js';
import type { KolonSecimi, SatirSuzgeci } from './model-tipleri.js';

// Bu istekteki okumalarda kullanılan yetenek ve üyelik kimlikleri ve dönen kayıt sayısı (erişim kaydı
// için; KR-010 Seçim 40).
export interface OkumaBirikimi {
  readonly yetenekIdleri: readonly string[];
  readonly uyelikIdleri: readonly string[];
  readonly kayitSayisi: number;
}

const OKUMA_EYLEMI = 'oku';

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

interface Katilan {
  readonly kural: YetenekKurali;
  readonly kolonlar: readonly string[];
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

// Yetki kapısının okuma yüzü (TS-007 "Yapı"; KR-010 Seçim 26, 37 ve "Derleme eşlemesi"). Feature
// repository'si kataloğa bildirilmiş bir kaynağın Prisma sorgusunu kendisi yazar; satır süzgecini, kolon
// seçimini ve okumayı kapatan işlevi buradan, yetki'den alır. Yetki parametre değildir, istek
// bağlamındaki derlenmiş yetkiden alınır; motorun kuralları (kuralların seçimi, satır süzgecinin
// kurulması, kolon kümelerinin birleştirilmesi) yalnız buradadır.
//
// Okuma iki adımdır. (1) Sayfa: repository'nin sorgusu kendi koşulunu satır süzgeciyle (okuma
// kurallarının koşullarının "veya"sı) "ve" bağlar; sıralama (sonda kimlik) ve sayfa bu tek sorguda
// veritabanında uygulanır, böylece sayfalar birleşik sonuç üzerinde tutarlıdır. (2) Kolonlar: kurallar
// farklı kolon kümeleri veriyorsa kayitlar her kural için, kendi koşulu ve kendi kolonlarıyla, yalnız
// sayfadaki kimlikleri repository'nin verdiği yeniden okuma deyimiyle okur; sonuçlar kayıt kimliğinde
// birleşir ve her kayıt yalnız onu gören kuralların kolonlarının birleşimini taşır. Kolon kümeleri
// aynıysa ilk sorgu kolonları doğrudan seçer. Hiç kuralı olmayan kişide sorgu yine gider ve veritabanı
// hiçbir satır döndürmez.
//
// Kayıt kimliği her okuma kuralında görünür (TS-002 AK-38): kolon listesinde olmasa da her cevapta
// bulunur, kimliğe göre süzme ve sıralama her kuralda serbesttir. Bedeli: kimlik zaman sıralı (UUIDv7)
// olduğu için kaydı okuyabilen kişi oluşturma sırasını öğrenir. Çağıranın süzdüğü ya da sıraladığı
// başka bir kolonu (bakilan) göremeyen kural o okumaya katılmaz: süzme ve sıralama görünmeyen kolonu
// ele vermez (KR-010 ikinci çürütme turu kuralları).
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
