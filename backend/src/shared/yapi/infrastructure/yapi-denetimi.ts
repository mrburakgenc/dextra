// Dosya düzenini TS-005'e karşı denetleyen iki işlev; hiçbir şey yazmaz. yapiyiDenetle alt özellikleri
// ("Yapı"; features/<feature>/<alt>) dolaşır, ihlalleri features klasörüne göreli yolla döndürür.
// ortakKoduDenetle ortak kodun konularını (shared/<konu>) ve feature içi ortak klasörleri
// (features/<feature>/_<ad>) "Ortak kodun ve feature içi ortak klasörün düzeni"ne karşı denetler,
// ihlalleri src klasörüne göreli yolla döndürür.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';

// Alt özellik: a kök, b application, c domain, d infrastructure, e presentation.
// Ortak kod: f konunun kökü, g domain'in içe aktarması, h application'ın içe aktarması,
// i sözleşme ve repository arayüzü dosyasının adı.
export type YapiKurali = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i';

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
export function yapiyiDenetle(featuresKlasoru: string): AltOzellikRaporu[] {
  return icerik(featuresKlasoru)
    .klasorler.sort()
    .flatMap((feature) =>
      icerik(join(featuresKlasoru, feature))
        .klasorler.filter((alt) => !alt.startsWith('_'))
        .sort()
        .map((alt) =>
          altOzelligiDenetle(
            join(featuresKlasoru, feature, alt),
            `${feature}/${alt}`,
            alt,
          ),
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

    // g) domain yalnız domain dosyalarını ve dilin modüllerini (node:) içe aktarır.
    // h) application veritabanı istemcisini ve kuyruk kitaplığını içe aktarmaz.
    const yol = `${konu}/${y}`;
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
