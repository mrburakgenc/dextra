// Dosya düzenini TS-005'e karşı denetleyen iki işlev; hiçbir şey yazmaz. yapiyiDenetle alt özellikleri
// ("Yapı"; features/<feature>/<alt>) dolaşır, ihlalleri features klasörüne göreli yolla döndürür.
// ortakKoduDenetle ortak kodun konularını (shared/<konu>) ve feature içi ortak klasörleri
// (features/<feature>/_<ad>) "Ortak kodun ve feature içi ortak klasörün düzeni"ne karşı denetler,
// ihlalleri src klasörüne göreli yolla döndürür. bekleyenler yetki kapısının kaynak adıyla çalışan eski
// yüzünü hâlâ çağıran alt özellikleri adlarıyla döndürür; geçiş bittiği için böyle bir alt özellik
// kural m ile de ihlaldir (TS-007 "Adlar, denetim ve geçiş"). featureKokunuDenetle feature'ın kökünde
// doğrudan duran dosyalara n ve o'yu uygular; testIceAktarmasiniDenetle src'nin bütün dosyalarına p'yi.
// guardSirasiniDenetle, ucIsaretleriniDenetle, isteyenAlaniniDenetle ve caprazKesenKopyayiDenetle
// KU-010, KU-011, KU-013 ve KU-009'u (q, r, s, t) kaynak metniyle sınar.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

// Alt özellik: a kök, b application, c domain, d infrastructure, e presentation, j Prisma
// repository'sinde Prisma vekili çağrısı, k feature repository'sinin okumasında yetki süzgeci, l süzgeçli
// okumanın okumayı kapatan çağrıyla kapanması, m eski yüzün çağrısı (bekleyen alt özellik).
// Ortak kod: f konunun kökü, g domain'in içe aktarması, h application'ın içe aktarması,
// i sözleşme ve repository arayüzü dosyasının adı, j feature içi ortak klasörde Prisma vekili çağrısı.
// İkisinde ve feature'ın kökünde, feature altında: n .kapi-repository.ts adı, o test kodunun ya da eski
// yüzün adının içe aktarılması. src'nin her yerinde: p test klasörünün içe aktarılması.
// Uygulama ve feature'lar: q genel guard'ların sırası (KU-010), r ucun işareti (KU-011), s isteği yapanı
// gösteren alan (KU-013), t çapraz kesen yeteneğin feature'daki kopyası (KU-009).
export type YapiKurali =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't';

export interface Ihlal {
  readonly kural: YapiKurali;
  readonly yol: string;
  readonly neden: string;
}

export interface AltOzellikRaporu {
  // <feature>/<alt>
  readonly ad: string;
  readonly ihlaller: readonly Ihlal[];
}

export interface KonuRaporu {
  // shared/<konu> ya da features/<feature>/_<ad>
  readonly ad: string;
  readonly ihlaller: readonly Ihlal[];
}

const KOK_KLASORLERI = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
];
const UYGULAMA_KLASORLERI = ['commands', 'queries', '_shared'];
const ALAN_KLASORLERI = [
  'entities',
  'value-objects',
  'repositories',
  'services',
  'errors',
];
const IS_TURLERI = [
  { klasor: 'commands', sonek: 'command' },
  { klasor: 'queries', sonek: 'query' },
];

// Yetkiden bağımsız sistem işlerinin feature içindeki repository'leri (TS-002 "Çekirdek yollar";
// TS-007 "Kapsam dışı"): okumaları yetki süzgeci taşımaz. Yol features klasörüne görelidir.
const CEKIRDEK_REPOSITORYLER = [
  'kimlik/oturum/infrastructure/repositories/oturum.prisma-repository.ts',
  'kimlik/oturum/infrastructure/repositories/oturum-denetimi.prisma-repository.ts',
  'kimlik/parola/infrastructure/repositories/parola.prisma-repository.ts',
];

// Prisma vekili çağrısı: istemci.model.deyim(.
const PRISMA_VEKILI_CAGRISI =
  /\b[a-z]\w*\.[a-z]\w*\.(?:findMany|findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|count|aggregate|groupBy|create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\s*\(/;
const OKUMA_DEYIMI =
  /\.(findMany|findFirst|findFirstOrThrow|findUnique|findUniqueOrThrow|count|aggregate|groupBy)\s*\(/g;
// Yetki yüzünün okuma süzgecinin ve okumayı kapatan işlevinin adları (OkumaYetkisi). Süzgeç yetki yüzünün
// alanıdır (yetki.satirlar); aynı adlı yerel değişken süzgeç sayılmaz.
const YETKI_SUZGECI = /\.satirlar\b/;
// Tip bağımsız değişkenli yazım da (kayitlar<Tip>(…), bir düzey iç içe tiple) kapatan çağrıdır.
const OKUMAYI_KAPATAN = /\.kayitlar\s*(?:<(?:[^<>()]|<[^<>()]*>)*>\s*)?\(/g;
// Eski yüz: yetki kapısını içe aktaran dosyada liste, tek, olustur, guncelle, niyet ya da sil çağrısı.
const YETKI_KAPISI = /yetki\/infrastructure\/(?:okuma|yazma)-kapisi\.js['"]/;
const ESKI_YUZ_CAGRISI = /\.(?:liste|tek|olustur|guncelle|niyet|sil)\s*\(/;

function eskiYuzuCagirir(metin: string): boolean {
  return YETKI_KAPISI.test(metin) && ESKI_YUZ_CAGRISI.test(metin);
}

// Eski yüzün test yardımcısına taşınan adlarının adla içe ya da dışa aktarılması.
const ESKI_YUZ_ADI =
  /\b(?:import|export)\s+(?:type\s+)?\{[^}]*?\b(EskiOkumaKapisi|EskiYazmaKapisi|ListeIstegi|modelAdi)\b/g;

// Dosyanın içe aktardığı, src dışındaki test klasörüne (backend/test) çözülen göreli yollar. yol src'ye
// görelidir.
function testIceAktarmalari(yol: string, metin: string): string[] {
  return [...metin.matchAll(ICE_AKTARMA)]
    .map(([, kaynak = '']) => kaynak)
    .filter(
      (kaynak) =>
        kaynak.startsWith('.') &&
        posix.join(posix.dirname(yol), kaynak).startsWith('../test/'),
    );
}

// Feature altındaki dosyanın kural n ve o ihlalleri: .kapi-repository.ts adı; test kodunu ya da eski
// yüzün adını içe aktarması. yol src'ye görelidir.
function featureDosyasiIhlalleri(
  yol: string,
  metin: string,
): { kural: YapiKurali; neden: string }[] {
  return [
    ...(yol.endsWith('.kapi-repository.ts')
      ? [
          {
            kural: 'n' as const,
            neden: '.kapi-repository.ts adı kalktı; .prisma-repository.ts olur',
          },
        ]
      : []),
    ...testIceAktarmalari(yol, metin).map((kaynak) => ({
      kural: 'o' as const,
      neden: `feature test kodunu içe aktarır: ${kaynak}`,
    })),
    ...[...metin.matchAll(ESKI_YUZ_ADI)].map(([, ad = '']) => ({
      kural: 'o' as const,
      neden: `feature eski yüzün adını içe aktarır: ${ad}`,
    })),
  ];
}

// Metinde acilis konumundaki "("nun kapandığı konum; kapanmıyorsa metnin sonu. Metin düzeyindedir:
// dizge ve yorum içindeki parantezler de sayılır.
function kapanis(metin: string, acilis: number): number {
  let derinlik = 0;
  for (let i = acilis; i < metin.length; i += 1) {
    if (metin[i] === '(') {
      derinlik += 1;
    } else if (metin[i] === ')') {
      derinlik -= 1;
      if (derinlik === 0) {
        return i;
      }
    }
  }
  return metin.length;
}

// Desene uyan çağrılar: deyim adı, çağrının başı, "("nun ve onu kapatan ")"nın konumu.
function cagrilar(metin: string, desen: RegExp) {
  return [...metin.matchAll(desen)].map((m) => {
    const acilis = m.index + m[0].length - 1;
    return {
      ad: m[1] ?? '',
      bas: m.index,
      acilis,
      son: kapanis(metin, acilis),
    };
  });
}

// acilis konumunda açılan çağrının ikinci bağımsız değişkeninin aralığı: ilk düzeydeki ilk virgülden
// kapanışa; ikinci bağımsız değişken yoksa boş aralık. Metin düzeyindedir.
function ikinciArguman(metin: string, acilis: number): [number, number] {
  const son = kapanis(metin, acilis);
  let derinlik = 0;
  for (let i = acilis + 1; i < son; i += 1) {
    if ('([{'.includes(metin.charAt(i))) {
      derinlik += 1;
    } else if (')]}'.includes(metin.charAt(i))) {
      derinlik -= 1;
    } else if (metin[i] === ',' && derinlik === 0) {
      return [i, son];
    }
  }
  return [son, son];
}

// Feature repository'sinin okuma ihlalleri (deyim adı ve satırı). k: bağımsız değişkenlerinde yetki
// süzgeci geçmeyen okuma; okumayı kapatan çağrının ikinci bağımsız değişkeni (yeniden okuma işlevi)
// muaftır. l: süzgeci taşıyıp kendi kapatan çağrısıyla eşlenmeyen okuma. Bir kapatan çağrı yalnız bir
// okumayı kapatır: önce ilk bağımsız değişkeninde duran ilk süzgeçli okumayla eşlenir; o okumalardan
// biri olmayan okuma, kendisinden sonra ve süzgeçli bir sonraki okumadan önce başlayan, eşlenmemiş ilk
// kapatan çağrıyla eşlenir.
function okumaIhlalleri(
  metin: string,
): { kural: 'k' | 'l'; deyim: string }[] {
  const kapatanlar = cagrilar(metin, OKUMAYI_KAPATAN);
  const okumalar = cagrilar(metin, OKUMA_DEYIMI).filter(
    (o) =>
      !kapatanlar.some((k) => {
        const [bas, son] = ikinciArguman(metin, k.acilis);
        return bas < o.bas && o.bas < son;
      }),
  );
  const suzgecli = okumalar.filter((o) =>
    YETKI_SUZGECI.test(metin.slice(o.acilis, o.son)),
  );
  const deyim = (o: { ad: string; bas: number }): string =>
    `${o.ad} (satır ${String(metin.slice(0, o.bas).split('\n').length)})`;
  const icindeki = (o: { bas: number }) =>
    kapatanlar.find((k) => k.acilis < o.bas && o.bas < k.son);
  const eslenen = new Set<(typeof kapatanlar)[number]>();
  const kapanan = new Set<(typeof suzgecli)[number]>();
  for (const o of suzgecli) {
    const k = icindeki(o);
    if (k !== undefined && !eslenen.has(k)) {
      eslenen.add(k);
      kapanan.add(o);
    }
  }
  suzgecli.forEach((o, i) => {
    if (icindeki(o) !== undefined) {
      return;
    }
    const sonraki = suzgecli[i + 1]?.bas ?? metin.length;
    const k = kapatanlar.find(
      (k) => !eslenen.has(k) && o.son < k.bas && k.bas < sonraki,
    );
    if (k !== undefined) {
      eslenen.add(k);
      kapanan.add(o);
    }
  });
  return [
    ...okumalar
      .filter((o) => !suzgecli.includes(o))
      .map((o) => ({ kural: 'k' as const, deyim: deyim(o) })),
    ...suzgecli
      .filter((o) => !kapanan.has(o))
      .map((o) => ({ kural: 'l' as const, deyim: deyim(o) })),
  ];
}

interface Icerik {
  readonly klasorler: string[];
  readonly dosyalar: string[];
}

// Klasörün doğrudan içeriği; klasör yoksa boştur. Adı "." ile başlayan girdiler (işletim sisteminin ve
// araçların bıraktığı .DS_Store, .claude gibi) kaynak değildir, sayılmaz.
function icerik(klasor: string): Icerik {
  if (!existsSync(klasor)) {
    return { klasorler: [], dosyalar: [] };
  }
  const girdiler = readdirSync(klasor, { withFileTypes: true }).filter(
    (g) => !g.name.startsWith('.'),
  );
  return {
    klasorler: girdiler.filter((g) => g.isDirectory()).map((g) => g.name),
    dosyalar: girdiler.filter((g) => !g.isDirectory()).map((g) => g.name),
  };
}

// Klasörün altındaki bütün dosyalar, klasöre göreli ve "/" ile ayrılmış yollarıyla.
function butunDosyalar(klasor: string): string[] {
  const { klasorler, dosyalar } = icerik(klasor);
  return [
    ...dosyalar,
    ...klasorler.flatMap((k) =>
      butunDosyalar(join(klasor, k)).map((y) => `${k}/${y}`),
    ),
  ];
}

// İş klasöründe durabilecek dosya: <iş>.<sonek>.ts, <iş>.handler.ts, <iş>.result.ts ya da <iş>…spec.ts.
function isDosyasiMi(dosya: string, is: string, sonek: string): boolean {
  return (
    [`${is}.${sonek}.ts`, `${is}.handler.ts`, `${is}.result.ts`].includes(
      dosya,
    ) ||
    (dosya.startsWith(`${is}.`) && dosya.endsWith('.spec.ts'))
  );
}

function altOzelligiDenetle(
  klasor: string,
  ad: string,
  alt: string,
): AltOzellikRaporu {
  const ihlaller: Ihlal[] = [];
  const ekle = (kural: YapiKurali, yol: string, neden: string): void => {
    ihlaller.push({ kural, yol: `${ad}/${yol}`, neden });
  };

  // a) Kökte yalnız dört katman klasörü ve <alt>.module.ts.
  const kok = icerik(klasor);
  for (const k of kok.klasorler.filter((k) => !KOK_KLASORLERI.includes(k))) {
    ekle('a', k, 'alt özelliğin kökünde izinsiz klasör');
  }
  for (const d of kok.dosyalar.filter((d) => d !== `${alt}.module.ts`)) {
    ekle('a', d, `alt özelliğin kökünde yalnız ${alt}.module.ts durur`);
  }

  // b) application altında yalnız commands, queries, _shared; her iş kendi klasöründe.
  const uygulama = icerik(join(klasor, 'application'));
  for (const k of uygulama.klasorler.filter(
    (k) => !UYGULAMA_KLASORLERI.includes(k),
  )) {
    ekle('b', `application/${k}`, 'application altında izinsiz klasör');
  }
  for (const d of uygulama.dosyalar) {
    ekle('b', `application/${d}`, 'application kökünde dosya durmaz');
  }
  for (const { klasor: tur, sonek } of IS_TURLERI) {
    const isler = icerik(join(klasor, 'application', tur));
    for (const d of isler.dosyalar) {
      ekle('b', `application/${tur}/${d}`, 'her iş kendi klasöründedir');
    }
    for (const is of isler.klasorler) {
      const yol = `application/${tur}/${is}`;
      const isIcerigi = icerik(join(klasor, yol));
      for (const k of isIcerigi.klasorler) {
        ekle('b', `${yol}/${k}`, 'iş klasöründe alt klasör olmaz');
      }
      for (const gerekli of [`${is}.${sonek}.ts`, `${is}.handler.ts`]) {
        if (!isIcerigi.dosyalar.includes(gerekli)) {
          ekle('b', `${yol}/${gerekli}`, 'işin zorunlu dosyası eksik');
        }
      }
      for (const d of isIcerigi.dosyalar.filter(
        (d) => !isDosyasiMi(d, is, sonek),
      )) {
        ekle('b', `${yol}/${d}`, 'iş klasöründe izinsiz dosya');
      }
    }
  }

  // c) domain kökünde yalnız <ad>.port.ts; izinli alt klasörler; repository arayüzü yalnız
  // repositories/i-<ad>.repository.ts; komutu olan alt özellikte en az bir varlık.
  const alanKlasoru = join(klasor, 'domain');
  const alan = icerik(alanKlasoru);
  for (const d of alan.dosyalar.filter((d) => !d.endsWith('.port.ts'))) {
    ekle('c', `domain/${d}`, 'domain kökünde yalnız <ad>.port.ts durur');
  }
  for (const k of alan.klasorler) {
    if (!ALAN_KLASORLERI.includes(k)) {
      ekle('c', `domain/${k}`, 'domain altında izinsiz klasör');
    } else if (k === 'repositories') {
      for (const y of butunDosyalar(join(alanKlasoru, k))) {
        if (!/^i-[a-z0-9-]+\.repository\.ts$/.test(y)) {
          ekle(
            'c',
            `domain/${k}/${y}`,
            'repositories altında yalnız i-<ad>.repository.ts durur',
          );
        }
      }
    } else {
      for (const y of butunDosyalar(join(alanKlasoru, k))) {
        if (y.endsWith('.repository.ts')) {
          ekle(
            'c',
            `domain/${k}/${y}`,
            'repository arayüzü yalnız domain/repositories altında durur',
          );
        }
      }
    }
  }
  const komutlarVar = uygulama.klasorler.includes('commands');
  if (
    komutlarVar &&
    !icerik(join(alanKlasoru, 'entities')).dosyalar.some((d) =>
      /^[a-z0-9-]+\.entity\.ts$/.test(d),
    )
  ) {
    ekle(
      'c',
      'domain/entities',
      'komutu olan alt özellikte en az bir <ad>.entity.ts bulunur',
    );
  }

  // d) Repository gerçeklemeleri infrastructure/repositories altında; oradaki her dosya
  // <ad>.<teknoloji>-repository.ts adını (ya da onun .spec.ts'ini) taşır.
  for (const y of butunDosyalar(join(klasor, 'infrastructure'))) {
    if (y.startsWith('repositories/')) {
      if (
        !/^repositories\/[a-z0-9-]+\.[a-z0-9]+-repository(\.spec)?\.ts$/.test(y)
      ) {
        ekle(
          'd',
          `infrastructure/${y}`,
          'repositories altında yalnız <ad>.<teknoloji>-repository.ts durur',
        );
      }
    } else if (y.endsWith('repository.ts')) {
      ekle(
        'd',
        `infrastructure/${y}`,
        'repository gerçeklemesi infrastructure/repositories altında durur',
      );
    }
  }

  // j) Adında prisma-repository geçen dosya en az bir Prisma vekili çağrısı taşır.
  // k) Çekirdek olmayan repository'nin her okuma deyimi yetki süzgecini taşır.
  // l) Çekirdek olmayan repository'de yetki süzgecini taşıyan her okuma, okumayı kapatan çağrıyla kapanır.
  for (const y of butunDosyalar(join(klasor, 'infrastructure'))) {
    if (y.endsWith('.spec.ts')) {
      continue;
    }
    const metin = readFileSync(join(klasor, 'infrastructure', y), 'utf8');
    if (y.includes('prisma-repository') && !PRISMA_VEKILI_CAGRISI.test(metin)) {
      ekle(
        'j',
        `infrastructure/${y}`,
        'Prisma repository dosyasında Prisma vekili çağrısı yok',
      );
    }
    if (
      y.startsWith('repositories/') &&
      y.endsWith('-repository.ts') &&
      !CEKIRDEK_REPOSITORYLER.includes(`${ad}/infrastructure/${y}`)
    ) {
      for (const { kural, deyim } of okumaIhlalleri(metin)) {
        ekle(
          kural,
          `infrastructure/${y}`,
          kural === 'k'
            ? `okuma deyimi yetki süzgecini taşımıyor: ${deyim}`
            : `süzgeçli okuma okumayı kapatan çağrıyla kapanmıyor: ${deyim}`,
        );
      }
    }
  }

  // m) Spec dışındaki hiçbir dosya eski yüzü çağırmaz: çağıran alt özellik bekleyendir (TS-007 "Adlar,
  // denetim ve geçiş"; geçiş bitti).
  // n) .kapi-repository.ts adlı dosya durmaz; yazma repository'si <ad>-yazma.prisma-repository.ts'dir.
  // o) Test kodu ve eski yüzün adları içe aktarılmaz.
  for (const y of butunDosyalar(klasor)) {
    const metin = readFileSync(join(klasor, y), 'utf8');
    if (!y.endsWith('.spec.ts') && eskiYuzuCagirir(metin)) {
      ekle('m', y, 'eski yüzü çağırır; alt özellik bekleyendir');
    }
    for (const { kural, neden } of featureDosyasiIhlalleri(
      `features/${ad}/${y}`,
      metin,
    )) {
      ekle(kural, y, neden);
    }
  }

  // e) Sunumda şema dosyası yok.
  for (const y of butunDosyalar(join(klasor, 'presentation'))) {
    if (y.endsWith('.schema.ts')) {
      ekle(
        'e',
        `presentation/${y}`,
        'sunumda şema dosyası durmaz; şema komutun ya da sorgunun yanındadır',
      );
    }
  }

  return { ad, ihlaller };
}

// Adı "_" ile başlayan klasörler (feature içi ortak kod) alt özellik değildir; onları
// ortakKoduDenetle sınar.
function altOzellikler(
  featuresKlasoru: string,
): { klasor: string; ad: string; alt: string }[] {
  return icerik(featuresKlasoru)
    .klasorler.sort()
    .flatMap((feature) =>
      icerik(join(featuresKlasoru, feature))
        .klasorler.filter((alt) => !alt.startsWith('_'))
        .sort()
        .map((alt) => ({
          klasor: join(featuresKlasoru, feature, alt),
          ad: `${feature}/${alt}`,
          alt,
        })),
    );
}

export function yapiyiDenetle(featuresKlasoru: string): AltOzellikRaporu[] {
  return altOzellikler(featuresKlasoru).map(({ klasor, ad, alt }) =>
    altOzelligiDenetle(klasor, ad, alt),
  );
}

// Eski yüzü çağıran alt özellikler (<feature>/<alt>); geçiş bittiği için boştur (sayısı gerçek depoda
// sıfır olarak sınanır; her biri kural m ile de ihlaldir).
export function bekleyenler(featuresKlasoru: string): string[] {
  return altOzellikler(featuresKlasoru)
    .filter(({ klasor }) =>
      butunDosyalar(klasor).some(
        (y) =>
          !y.endsWith('.spec.ts') &&
          eskiYuzuCagirir(readFileSync(join(klasor, y), 'utf8')),
      ),
    )
    .map(({ ad }) => ad);
}

// Feature'ın kökünde doğrudan duran dosyalar (features/<feature>/<dosya>; örnek <feature>.module.ts) alt
// özellik de feature içi ortak klasör de değildir; n ve o onlara burada uygulanır. Yol features klasörüne
// görelidir.
export function featureKokunuDenetle(featuresKlasoru: string): Ihlal[] {
  return icerik(featuresKlasoru)
    .klasorler.sort()
    .flatMap((feature) =>
      icerik(join(featuresKlasoru, feature))
        .dosyalar.sort()
        .flatMap((d) =>
          featureDosyasiIhlalleri(
            `features/${feature}/${d}`,
            readFileSync(join(featuresKlasoru, feature, d), 'utf8'),
          ).map(({ kural, neden }) => ({
            kural,
            yol: `${feature}/${d}`,
            neden,
          })),
        ),
    );
}

// p) src'nin hiçbir dosyası (spec dosyaları dahil) src dışındaki test klasöründen içe aktarmaz. Yol src
// klasörüne görelidir.
export function testIceAktarmasiniDenetle(srcKlasoru: string): Ihlal[] {
  return kaynaklar(srcKlasoru).flatMap((y) =>
    testIceAktarmalari(y, readFileSync(join(srcKlasoru, y), 'utf8')).map(
      (kaynak) => ({
        kural: 'p' as const,
        yol: y,
        neden: `kaynak kodu test klasöründen içe aktarır: ${kaynak}`,
      }),
    ),
  );
}

const KONU_KLASORLERI = ['domain', 'application', 'infrastructure'];
// Kökünde katman klasörü olmayan konular: TS-005 ağacında adıyla sayılan istisnalar (gözlemlenebilirliğin
// alt alanları, süzgeçler, ortak sonuç tipi, kimliğin sözleşmeleri). Öbür kurallar bunlarda da geçer.
const KOK_KURALI_DISI = [
  'shared/observability',
  'shared/filters',
  'shared/domain',
  'shared/kimlik',
];
// import ... from '…', export ... from '…', import '…' ve import('…').
const ICE_AKTARMA = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

// Konunun kaynak dosyaları, konuya göreli. Üretilen kod (generated klasörleri; veritabanı istemcisi)
// kaynak değildir, sayılmaz.
function kaynaklar(klasor: string): string[] {
  return butunDosyalar(klasor).filter(
    (y) => !y.split('/').includes('generated'),
  );
}

// src'ye göreli yolun katmanı: shared/domain/…, shared/<konu>/<katman>/… ve
// features/<feature>/<alt ya da _ortak>/<katman>/….
function katman(yol: string): string | undefined {
  const p = yol.split('/');
  if (p[0] === 'shared') {
    return p[1] === 'domain' ? 'domain' : p[2];
  }
  return p[0] === 'features' ? p[3] : undefined;
}

function konuyuDenetle(srcKlasoru: string, konu: string): KonuRaporu {
  const ihlaller: Ihlal[] = [];
  const ekle = (kural: YapiKurali, yol: string, neden: string): void => {
    ihlaller.push({ kural, yol: `${konu}/${yol}`, neden });
  };
  const klasor = join(srcKlasoru, konu);
  const dosyalar = kaynaklar(klasor);

  // f) Kökte yalnız domain, application, infrastructure ve <ad>.module.ts. Kaynak dosyası olmayan
  // klasör (yalnız üretilen kodu taşıyan) sayılmaz.
  if (!KOK_KURALI_DISI.includes(konu)) {
    const kok = icerik(klasor);
    for (const k of kok.klasorler.filter(
      (k) =>
        !KONU_KLASORLERI.includes(k) &&
        dosyalar.some((y) => y.startsWith(`${k}/`)),
    )) {
      ekle('f', k, 'konunun kökünde izinsiz klasör');
    }
    for (const d of kok.dosyalar.filter((d) => !d.endsWith('.module.ts'))) {
      ekle(
        'f',
        d,
        'konunun kökünde klasör dışında yalnız <ad>.module.ts durur',
      );
    }
  }

  for (const y of dosyalar) {
    // i) Sözleşme i-<ad>.contract.ts, repository arayüzü i-<ad>.repository.ts adını taşır.
    const ad = posix.basename(y);
    for (const tur of ['contract', 'repository']) {
      if (
        ad.endsWith(`.${tur}.ts`) &&
        !new RegExp(`^i-[a-z0-9-]+\\.${tur}\\.ts$`).test(ad)
      ) {
        ekle('i', y, `${tur} dosyası i-<ad>.${tur}.ts adını taşır`);
      }
    }

    // j) Feature içi ortak klasörde adında prisma-repository geçen dosya en az bir Prisma vekili
    // çağrısı taşır.
    if (
      konu.startsWith('features/') &&
      ad.includes('prisma-repository') &&
      !ad.endsWith('.spec.ts') &&
      !PRISMA_VEKILI_CAGRISI.test(readFileSync(join(klasor, y), 'utf8'))
    ) {
      ekle('j', y, 'Prisma repository dosyasında Prisma vekili çağrısı yok');
    }

    // n) ve o) Feature içi ortak klasörde .kapi-repository.ts adı yok; test kodu ve eski yüzün adları
    // içe aktarılmaz.
    const yol = `${konu}/${y}`;
    if (konu.startsWith('features/')) {
      const metin = readFileSync(join(klasor, y), 'utf8');
      for (const { kural, neden } of featureDosyasiIhlalleri(yol, metin)) {
        ekle(kural, y, neden);
      }
    }

    // g) domain yalnız domain dosyalarını ve dilin modüllerini (node:) içe aktarır.
    // h) application veritabanı istemcisini ve kuyruk kitaplığını içe aktarmaz.
    const dosyaKatmani = katman(yol);
    if (dosyaKatmani !== 'domain' && dosyaKatmani !== 'application') {
      continue;
    }
    const metin = readFileSync(join(klasor, y), 'utf8');
    for (const [, kaynak = ''] of metin.matchAll(ICE_AKTARMA)) {
      const hedef = kaynak.startsWith('.')
        ? posix.join(posix.dirname(yol), kaynak)
        : undefined;
      if (dosyaKatmani === 'domain') {
        if (
          !kaynak.startsWith('node:') &&
          (hedef === undefined || katman(hedef) !== 'domain')
        ) {
          ekle('g', y, `domain domain dışından içe aktarır: ${kaynak}`);
        }
      } else if (/^bullmq($|\/)/.test(kaynak)) {
        ekle('h', y, `application kuyruk kitaplığını içe aktarır: ${kaynak}`);
      } else if (
        /^(@prisma\/|pg($|\/))/.test(kaynak) ||
        hedef?.split('/').includes('generated')
      ) {
        ekle(
          'h',
          y,
          `application veritabanı istemcisini içe aktarır: ${kaynak}`,
        );
      }
    }
  }

  return { ad: konu, ihlaller };
}

// Ortak kodun her konusu (shared/<konu>) ve her feature'ın içindeki ortak klasör (adı "_" ile başlayan).
export function ortakKoduDenetle(srcKlasoru: string): KonuRaporu[] {
  const features = join(srcKlasoru, 'features');
  const konular = [
    ...icerik(join(srcKlasoru, 'shared'))
      .klasorler.sort()
      .map((k) => `shared/${k}`),
    ...icerik(features)
      .klasorler.sort()
      .flatMap((feature) =>
        icerik(join(features, feature))
          .klasorler.filter((k) => k.startsWith('_'))
          .sort()
          .map((k) => `features/${feature}/${k}`),
      ),
  ];
  return konular.map((konu) => konuyuDenetle(srcKlasoru, konu));
}

// Metnin yorumsuz hâli: metin tek geçişte okunur; blok yorumlar ve satır yorumları silinir, dizgeler
// (tek tırnak, çift tırnak, şablon dizgesi) ve kod olduğu gibi kalır. Dizge ya da satır yorumu içindeki
// `/*` blok yorum başlatmaz. Ters bölüden sonraki karakter her yerde olduğu gibi alınır, yorum ya da
// dizge başlatmaz ve bitirmez (`/https?:\/\//` yorum değildir). Tek ve çift tırnaklı dizge satır
// sonunda biter. Tam bir ayrıştırıcı değildir; bilinen artıklar: düzenli ifade değişmezi kod olarak
// okunur, içindeki tırnak (`/^[^']+$/`) satır sonuna kadar sahte bir dizge açar. Bu zararsızdır, çünkü
// dizge çıktıda kalır (yalnız yorumlar silinir) ve satır sonunda biter; yalnız aynı satırda sonra
// gelen bir dizgenin içindeki `/*` ya da `//` o zaman yorum sayılabilir. Şablon dizgesinin `${…}`
// bölümü dizge sayılır; içinde iç içe şablon dizgesi varsa eşleşme kayar.
function yorumsuz(metin: string): string {
  let cikti = '';
  let i = 0;
  while (i < metin.length) {
    const ilk = metin[i] ?? '';
    const iki = metin.slice(i, i + 2);
    if (iki === '//') {
      const son = metin.indexOf('\n', i);
      i = son === -1 ? metin.length : son;
    } else if (iki === '/*') {
      const son = metin.indexOf('*/', i + 2);
      i = son === -1 ? metin.length : son + 2;
    } else if (ilk === "'" || ilk === '"' || ilk === '`') {
      let j = i + 1;
      while (
        j < metin.length &&
        metin[j] !== ilk &&
        (ilk === '`' || metin[j] !== '\n')
      ) {
        j += metin[j] === '\\' ? 2 : 1;
      }
      cikti += metin.slice(i, j + 1);
      i = j + 1;
    } else {
      const uzunluk = ilk === '\\' ? 2 : 1;
      cikti += metin.slice(i, i + uzunluk);
      i += uzunluk;
    }
  }
  return cikti;
}

// features altındaki uygulama kodu (spec dışındaki .ts dosyaları), src'ye göreli yolu ve yorumsuz
// metniyle.
function featureKodu(srcKlasoru: string): { yol: string; metin: string }[] {
  return kaynaklar(join(srcKlasoru, 'features'))
    .filter((y) => y.endsWith('.ts') && !y.endsWith('.spec.ts'))
    .map((y) => ({
      yol: `features/${y}`,
      metin: yorumsuz(readFileSync(join(srcKlasoru, 'features', y), 'utf8')),
    }));
}

// Uygulama genelinde bağlanan yetenek: { provide: APP_GUARD, use…: Ad }. Ad useClass ya da useExisting
// ile verilmediyse boştur.
const GENEL_BAGLAMA =
  /provide:\s*(APP_GUARD|APP_FILTER|APP_INTERCEPTOR|APP_PIPE)\b(?:[^}]*?\buse(?:Class|Existing):\s*(\w+))?/g;

// q) app.module'de genel guard'lar önce KimlikGuard, sonra YetkiGuard sırasıyla bağlanır ve YetkiGuard
// sondadır; kimlikten önce ya da ikisinin arasında başka guard durabilir (KU-010). Feature guard
// bağlamaz: @UseGuards( ve APP_GUARD bağlaması yoktur.
export function guardSirasiniDenetle(srcKlasoru: string): Ihlal[] {
  const guardlar = [
    ...yorumsuz(readFileSync(join(srcKlasoru, 'app.module.ts'), 'utf8')).matchAll(
      GENEL_BAGLAMA,
    ),
  ]
    .filter(([, tur]) => tur === 'APP_GUARD')
    .map(([, , ad = '']) => ad);
  const sira = `genel guard sırası: ${guardlar.join(', ')}`;
  const kimlik = guardlar.indexOf('KimlikGuard');
  const yetki = guardlar.indexOf('YetkiGuard');
  const nedenler =
    kimlik === -1 || yetki === -1
      ? [`KimlikGuard ve YetkiGuard genel guard olarak bağlanır; ${sira}`]
      : kimlik > yetki
        ? [`KimlikGuard YetkiGuard'dan önce bağlanır; ${sira}`]
        : yetki !== guardlar.length - 1
          ? [`YetkiGuard son genel guard'dır; ${sira}`]
          : [];
  return [
    ...nedenler.map((neden) => ({
      kural: 'q' as const,
      yol: 'app.module.ts',
      neden,
    })),
    ...featureKodu(srcKlasoru).flatMap(({ yol, metin }) =>
      /@UseGuards\s*\(/.test(metin) ||
      [...metin.matchAll(GENEL_BAGLAMA)].some(([, tur]) => tur === 'APP_GUARD')
        ? [
            {
              kural: 'q' as const,
              yol,
              neden:
                "feature guard bağlar (@UseGuards ya da APP_GUARD); guard zinciri app.module'dedir",
            },
          ]
        : [],
    ),
  ];
}

const HTTP_YONTEMLERI = [
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'Head',
  'Options',
  'All',
];
const UC_ISARETLERI = ['Izin', 'YalnizKendisi', 'HerkeseAcik'];

// Metindeki arka arkaya yazılmış işaret (dekoratör) öbekleri: işaretlerin adları, öbekten hemen sonra
// gelen yöntemin adı (yoksa boş) ve öbeğin başı.
function isaretObekleri(
  metin: string,
): { adlar: string[]; yontem: string; bas: number }[] {
  const obekler: { adlar: string[]; yontem: string; bas: number }[] = [];
  const isaret = /@(\w+)\s*/y;
  let bas = metin.indexOf('@');
  while (bas !== -1) {
    const adlar: string[] = [];
    let i = bas;
    isaret.lastIndex = i;
    for (let m = isaret.exec(metin); m !== null; m = isaret.exec(metin)) {
      adlar.push(m[1] ?? '');
      i = isaret.lastIndex;
      if (metin[i] === '(') {
        i = kapanis(metin, i) + 1;
      }
      i += /^\s*/.exec(metin.slice(i))?.[0].length ?? 0;
      isaret.lastIndex = i;
    }
    const yontem =
      /^(?:(?:public|protected|private|static|async)\s+)*(\w+)\s*[(<]/.exec(
        metin.slice(i),
      )?.[1] ?? '';
    obekler.push({ adlar, yontem, bas });
    bas = metin.indexOf('@', Math.max(i, bas + 1));
  }
  return obekler;
}

// r) features altındaki her denetleyicinin HTTP yöntemi işareti taşıyan her yöntemi (uç) üç işaretten
// tam birini taşır (KU-011). uclar sınanan uçlardır (<Sınıf>.<yöntem>). Açılış denetiminin
// (shared/guvenlik IsaretDenetimi) metin düzeyindeki karşılığıdır; o denetim yalnız uygulama açılırken
// koşar.
export function ucIsaretleriniDenetle(srcKlasoru: string): {
  uclar: string[];
  ihlaller: Ihlal[];
} {
  const uclar: string[] = [];
  const ihlaller: Ihlal[] = [];
  for (const { yol, metin } of featureKodu(srcKlasoru)) {
    if (!/@Controller\s*\(/.test(metin)) {
      continue;
    }
    for (const { adlar, yontem, bas } of isaretObekleri(metin)) {
      if (yontem === '' || !adlar.some((a) => HTTP_YONTEMLERI.includes(a))) {
        continue;
      }
      const sinif =
        [...metin.slice(0, bas).matchAll(/\bclass\s+(\w+)/g)].at(-1)?.[1] ?? '';
      const uc = `${sinif}.${yontem}`;
      uclar.push(uc);
      const sayi = adlar.filter((a) => UC_ISARETLERI.includes(a)).length;
      if (sayi !== 1) {
        ihlaller.push({
          kural: 'r',
          yol,
          neden: `${uc} ucu üç işaretten (HerkeseAcik, YalnizKendisi, Izin) tam birini taşımalı; ${String(sayi)} işaret var`,
        });
      }
    }
  }
  return { uclar, ihlaller };
}

// İsteği yapanı gösteren, komut ve sorgu şemasında ve sunumda yasak adlar (KU-013 "İhlal örneği").
const ISTEYEN_ADLARI = ['requesterId', 'isteyenId'];

// s) features altında application ve presentation dosyalarının kodunda (yorumlar dışında) isteği
// yapanı gösteren ad geçmez (KU-013). Ad yerel değişkende de ihlal sayılır; yerel için başka ad kullanılır.
export function isteyenAlaniniDenetle(srcKlasoru: string): Ihlal[] {
  const ad = new RegExp(`\\b(${ISTEYEN_ADLARI.join('|')})\\b`);
  return featureKodu(srcKlasoru).flatMap(({ yol, metin }) => {
    const bulunan = ad.exec(metin)?.[1];
    const katmani = katman(yol);
    return bulunan !== undefined &&
      (katmani === 'application' || katmani === 'presentation')
      ? [
          {
            kural: 's' as const,
            yol,
            neden: `isteği yapanı gösteren alan: ${bulunan}; isteyen oturumdan okunur`,
          },
        ]
      : [];
  });
}

// t) features altında guard (CanActivate), hata süzgeci (ExceptionFilter, @Catch) gerçeklenmez; genel
// süzgeç, interceptor ve boru bağlanmaz (KU-009). Feature'ın APP_GUARD bağlaması q'dadır.
export function caprazKesenKopyayiDenetle(srcKlasoru: string): Ihlal[] {
  return featureKodu(srcKlasoru).flatMap(({ yol, metin }) =>
    [
      ...[
        ...metin.matchAll(
          /\bclass\s+(\w+)[^{]*\bimplements\b[^{]*\b(CanActivate|ExceptionFilter)\b/g,
        ),
      ].map(([, sinif = '', arayuz = '']) => `${sinif} ${arayuz} gerçekler`),
      ...(/@Catch\s*\(/.test(metin) ? ['@Catch işareti taşır'] : []),
      ...[...metin.matchAll(GENEL_BAGLAMA)]
        .filter(([, tur]) => tur !== 'APP_GUARD')
        .map(([, tur = '']) => `${tur} bağlar`),
    ].map((ne) => ({
      kural: 't' as const,
      yol,
      neden: `feature çapraz kesen yeteneğin kopyasını kurar: ${ne}; yalnız shared altında yaşar`,
    })),
  );
}
