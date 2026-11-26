import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../database/generated/client.js';
import {
  type IstekBaglami,
  istekBaglami,
} from '../../observability/istek-baglami/istek-baglami.js';
import type { PrismaKosulu } from '../application/sart-cevirici.js';
import type {
  DerlenmisKural,
  YetenekKurali,
} from '../application/yetenek-derleyici.js';
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
  // Şartsız kolon yasaklarından sonra kalan kolonlar.
  readonly kolonlar: readonly string[];
  // Kuralın dalı: şartı ile ona uygulanan yasakların "kesin tutmuyor" koşullarının "ve"si; tanımsızsa
  // koşulsuz. Yasağı olmayan kuralda kuralın şartıdır.
  readonly kosul: PrismaKosulu | undefined;
  // Kurala uygulanan şartlı kolon yasakları, kuralın kolonlarından kapattıklarıyla.
  readonly sartliYasaklar: readonly {
    readonly kesinTutmuyor: PrismaKosulu;
    readonly kolonlar: readonly string[];
  }[];
  readonly yasakli: boolean;
}

// Hiçbir kayda uymayan koşul (Prisma 7.10.1: öğesiz mantık biçimleri koşulsuzdur, boş liste değil).
const HICBIR_KAYIT: PrismaKosulu = { id: { in: [] } };

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
//
// Yasaklar (TS-008 "Okuma"; KU-017, KU-018): izin kuralına, muaf değilse, ondan düşük öncelikli olmayan
// okuma yasakları uygulanır (eşitlikte yasak kazanır; bozuk yasak koşulsuz, öncelik 100 kayıt yasağı
// olarak derlenmiştir). Kuralın dalı yasakların "kesin tutmuyor" koşullarıyla daralır (katilimi);
// şartsız yasakla bakılan ya da kimlikten başka bütün kolonunu kaybeden kural katılmaz. Yasağı olan
// kişide kolonlar her zaman kural başına yeniden okunur; şartlı kolon yasaklarının kapattığı kolonlar,
// onları kapatan yasak kümesi başına bir deyimde o yasakların "kesin tutmuyor" koşullarıyla okunur.
// Yasağı olmayan kişide koşul ve sorgular yasaklardan önceki hâliyle aynıdır (TS-008 Değişmez 1).
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
    const yasaklar = yetki.butunKurallar.filter(
      (k) => k.giremez && k.subject === kaynak && k.action === OKUMA_EYLEMI,
    );
    const izinler = new Map(yetki.butunKurallar.map((k) => [k.yetenekId, k]));
    const katilanlar: Katilan[] = yetki.kurallar
      .filter((k) => k.subject === kaynak && k.action === OKUMA_EYLEMI)
      .flatMap((kural) => {
        // Muaf izne yasak uygulanmaz (KU-018); öbürüne ondan düşük öncelikli olmayan yasaklar uygulanır.
        const izin = izinler.get(kural.yetenekId);
        const uygulanan =
          izin?.yasaktanMuaf === true
            ? []
            : yasaklar.filter((y) => y.oncelik >= (izin?.oncelik ?? 0));
        const katilan = katilimi(kural, alanlar, bakilan, uygulanan);
        return katilan === undefined ? [] : [katilan];
      });
    // Yasağı olan kişide kısa yol kapanır (TS-008 "Kapasite").
    const yasakli = katilanlar.some((k) => k.yasakli);
    const ilkKume = kumeAnahtari(katilanlar[0]?.kolonlar ?? []);
    const ortakKolonlar =
      !yasakli &&
      katilanlar.every(({ kolonlar }) => kumeAnahtari(kolonlar) === ilkKume)
        ? (katilanlar[0]?.kolonlar ?? [])
        : undefined;

    // Prisma 7.10.1, "ve"nin içindeki boş "veya"yı koşulsuz sayar (WHERE 1=1; GV-033'te ölçüldü). Bu
    // yüzden kural yoksa satır süzgeci hiçbir satıra uymayan boş kimlik listesidir. "Veya"nın içindeki
    // boş koşulu ise yok sayar; bu yüzden koşulsuz kural "veya"ya konmaz, süzgeci koşulsuz yapar
    // (TS-002 AK-52).
    const satirSuzgeci =
      katilanlar.length === 0
        ? { id: { in: [] } }
        : katilanlar.some(({ kosul }) => kosul === undefined)
          ? {}
          : { OR: katilanlar.map(({ kosul }) => kosul ?? {}) };

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
          for (const { kosul, kolonlar, sartliYasaklar } of katilanlar) {
            const kosulla = (ek: readonly PrismaKosulu[]) => ({
              AND: [{ id: { in: idler } }, kosul ?? {}, ...ek],
            });
            // Şartlı yasağın kapattığı kolonlar, onları kapatan yasak kümesine göre gruplanır; grup
            // başına bir deyimde kümedeki bütün yasakların "kesin tutmuyor" koşuluyla okunur: kolonun
            // değeri ile onu kapatabilen her yasağın kararı aynı anlık görüntüden gelir (TS-008
            // "Kapasite", AU-33). Kolonlar örtüşmüyorsa grup yasak başına birdir.
            const gruplar = new Map<
              string,
              { readonly kosullar: PrismaKosulu[]; readonly kolonlar: string[] }
            >();
            for (const kolon of kolonlar) {
              const kapatan = sartliYasaklar.filter((y) =>
                y.kolonlar.includes(kolon),
              );
              if (kapatan.length > 0) {
                const anahtar = kapatan
                  .map((y) => sartliYasaklar.indexOf(y))
                  .join();
                const grup = gruplar.get(anahtar) ?? {
                  kosullar: kapatan.map((y) => y.kesinTutmuyor),
                  kolonlar: [],
                };
                grup.kolonlar.push(kolon);
                gruplar.set(anahtar, grup);
              }
            }
            const kapali = new Set(sartliYasaklar.flatMap((y) => y.kolonlar));
            const serbest = kolonlar.filter((k) => !kapali.has(k));
            const satirlar = await yenidenOku(kosulla([]), secim(serbest));
            const grupOkumalari: {
              readonly kolonlar: readonly string[];
              readonly satirlar: Map<unknown, Record<string, unknown>>;
            }[] = [];
            for (const grup of gruplar.values()) {
              const okunan = await yenidenOku(
                kosulla(grup.kosullar),
                secim(grup.kolonlar),
              );
              grupOkumalari.push({
                kolonlar: grup.kolonlar,
                satirlar: new Map(okunan.map((s) => [s['id'], s])),
              });
            }
            for (const satir of satirlar) {
              const gorunen = sec(satir, serbest);
              // Grubun kolonları, grubun deyiminde dönen kayıtta görünür.
              for (const okuma of grupOkumalari) {
                const okunan = okuma.satirlar.get(satir['id']);
                if (okunan !== undefined) {
                  Object.assign(gorunen, sec(okunan, okuma.kolonlar));
                }
              }
              Object.assign(birlesik.get(satir['id']) ?? {}, gorunen);
            }
          }
          // İki sorgu arasında görünmez olan kayıt hiçbir kuraldan kolon almaz ve atılır; kolonsuz
          // kural derlenmediği için görünen kayıt en az bir kolon taşır. Yasağı olan kişide kayıt
          // kimlikten başka bir kolon taşımalıdır (TS-008 "Tanım").
          kayitlar = [...birlesik.values()].filter(
            (kayit) => Object.keys(kayit).length > (yasakli ? 1 : 0),
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

// İzin kuralının bu okumaya katılımı (TS-008 "Okuma"); katılmıyorsa tanımsız. Yasaklar kurala uygulanan
// okuma yasaklarıdır. Kolon listesi olmayan yasak kaydı, olan yasak listedeki kolonları kapatır;
// koşulsuz kayıt yasağı kuralı bütünüyle, şartsız kolon yasağı kolonlarını bütün kayıtlarda kapatır.
// Dal, kuralın şartı ile kayıt yasaklarının, bakılan kolonu kapatan şartlı yasakların ve (kuralın her
// kolonu şartlı yasakla kapanabiliyorsa) en az bir kolonu açık bırakan yasakların "kesin tutmuyor"
// koşullarının "ve"sidir. Derlenmiş yasağın kolon listesinde kimlik yoktur (yasak-bicimi.ts).
function katilimi(
  kural: YetenekKurali,
  alanlar: readonly string[],
  bakilan: readonly string[],
  yasaklar: readonly DerlenmisKural[],
): Katilan | undefined {
  const tumKolonlar =
    kural.fields === undefined
      ? alanlar
      : [...new Set(['id', ...[kural.fields].flat()])];
  if (yasaklar.length === 0) {
    return bakilan.every((alan) => tumKolonlar.includes(alan))
      ? {
          kural,
          kolonlar: tumKolonlar,
          kosul: kural.conditions as PrismaKosulu | undefined,
          sartliYasaklar: [],
          yasakli: false,
        }
      : undefined;
  }
  const kesinTutmuyor = (y: DerlenmisKural): PrismaKosulu =>
    y.kesinTutmuyor ?? HICBIR_KAYIT;
  const kayitYasaklari = yasaklar.filter((y) => y.fields === undefined);
  if (kayitYasaklari.some((y) => y.conditions === undefined)) {
    return undefined;
  }
  const kolonYasaklari = yasaklar.filter((y) => y.fields !== undefined);
  const sartsizKapali = new Set(
    kolonYasaklari
      .filter((y) => y.conditions === undefined)
      .flatMap((y) => [y.fields ?? []].flat()),
  );
  const kolonlar = tumKolonlar.filter((k) => !sartsizKapali.has(k));
  const digerKolonlar = kolonlar.filter((k) => k !== 'id');
  if (
    digerKolonlar.length === 0 ||
    !bakilan.every((alan) => kolonlar.includes(alan))
  ) {
    return undefined;
  }
  const sartliYasaklar = kolonYasaklari
    .filter((y) => y.conditions !== undefined)
    .map((y) => ({
      kesinTutmuyor: kesinTutmuyor(y),
      kolonlar: [y.fields ?? []].flat().filter((k) => kolonlar.includes(k)),
    }))
    .filter((y) => y.kolonlar.length > 0);
  const kapatanlar = (kolon: string): PrismaKosulu[] =>
    sartliYasaklar
      .filter((y) => y.kolonlar.includes(kolon))
      .map((y) => y.kesinTutmuyor);
  const kalanlar = digerKolonlar.map(kapatanlar);
  const parcalar = [
    ...(kural.conditions === undefined
      ? []
      : [kural.conditions as PrismaKosulu]),
    ...kayitYasaklari.map(kesinTutmuyor),
    ...new Set(bakilan.flatMap(kapatanlar)),
    ...(kalanlar.every((k) => k.length > 0)
      ? [{ OR: kalanlar.map((k) => (k.length === 1 ? k[0] : { AND: k })) }]
      : []),
  ];
  return {
    kural,
    kolonlar,
    kosul:
      parcalar.length === 0
        ? undefined
        : parcalar.length === 1
          ? parcalar[0]
          : { AND: parcalar },
    sartliYasaklar,
    yasakli: true,
  };
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
