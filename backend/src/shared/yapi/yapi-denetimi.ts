// Alt özelliklerin dosya düzenini TS-005 "Yapı"ya karşı denetleyen işlev: features/<feature>/<alt>
// klasörlerini dolaşır, ihlalleri features klasörüne göreli dosya yoluyla döndürür; hiçbir şey yazmaz.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// a kök, b application, c domain, d infrastructure, e presentation.
export type YapiKurali = 'a' | 'b' | 'c' | 'd' | 'e';

export interface Ihlal {
  readonly kural: YapiKurali;
  readonly yol: string;
  readonly neden: string;
}

export interface AltOzellikRaporu {
  // <feature>/<alt>
  readonly ad: string;
  // İçinde application/commands ya da application/queries var mı (TS-005 "Doğrulama").
  readonly tasinmis: boolean;
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

  return {
    ad,
    tasinmis: komutlarVar || uygulama.klasorler.includes('queries'),
    ihlaller,
  };
}

// Adı "_" ile başlayan alt özellik klasörleri (feature içi ortak kod) denetlenmez.
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
