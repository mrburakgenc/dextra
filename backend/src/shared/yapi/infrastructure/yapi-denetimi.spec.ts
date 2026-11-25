// Yapı denetiminin testi: her kural geçici klasörde kurulan doğru ve yanlış örneklerle sınanır; sonra
// gerçek depoda bütün alt özelliklerin, ortak kodun bütün konularının ve feature içi ortak klasörün
// ihlali olmadığı, sınanan adlar yazılarak sınanır.
// Koşturma: pnpm -C backend test src/shared/yapi/infrastructure/yapi-denetimi.spec.ts --reporter=verbose
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bekleyenler,
  featureKokunuDenetle,
  ortakKoduDenetle,
  testIceAktarmasiniDenetle,
  type YapiKurali,
  yapiyiDenetle,
} from './yapi-denetimi.js';

// Kurallara uyan küçük bir alt özellik (ornek/alt): bir komut, bir sorgu, varlık, değer nesnesi,
// repository arayüzü, port, gerçekleme ve denetleyici.
const DOGRU = [
  'alt/alt.module.ts',
  'alt/domain/entities/alt.entity.ts',
  'alt/domain/entities/alt.entity.spec.ts',
  'alt/domain/value-objects/alt-adi.ts',
  'alt/domain/repositories/i-alt.repository.ts',
  'alt/domain/alt-ozetleyici.port.ts',
  'alt/application/_shared/liste.ts',
  'alt/application/commands/alt-yaz/alt-yaz.command.ts',
  'alt/application/commands/alt-yaz/alt-yaz.handler.ts',
  'alt/application/commands/alt-yaz/alt-yaz.result.ts',
  'alt/application/commands/alt-yaz/alt-yaz.handler.spec.ts',
  'alt/application/queries/alt-oku/alt-oku.query.ts',
  'alt/application/queries/alt-oku/alt-oku.handler.ts',
  'alt/infrastructure/repositories/alt.prisma-repository.ts',
  'alt/presentation/alt.controller.ts',
];

// Doğru örneğin içeriği olan dosyaları; öbürleri boştur. Repository sorguyu yetki yüzünün süzgeci ve
// okumayı kapatan işleviyle yazar (TS-007 "Yapı").
const DOGRU_ICERIK: Record<string, string> = {
  'alt/infrastructure/repositories/alt.prisma-repository.ts': [
    "const yetki = kapi.yetki('Alt', { bakilan: [] });",
    'const satirlar = await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar });',
    'return yetki.kayitlar(satirlar, (where, select) => istemci.alt.findMany({ where, select }));',
  ].join('\n'),
};

let kok: string;
let sayac = 0;

// Yeni bir features klasörüne ornek/<dosyalar> kurar ve yolunu döner; içerik dosya adından metnedir.
function kur(
  dosyalar: readonly string[],
  icerik: Record<string, string> = {},
): string {
  sayac += 1;
  const features = join(kok, String(sayac));
  for (const dosya of dosyalar) {
    const yol = join(features, 'ornek', dosya);
    mkdirSync(dirname(yol), { recursive: true });
    writeFileSync(yol, icerik[dosya] ?? DOGRU_ICERIK[dosya] ?? '');
  }
  return features;
}

beforeAll(() => {
  kok = mkdtempSync(join(tmpdir(), 'yapi-denetimi-'));
});

afterAll(() => {
  rmSync(kok, { recursive: true, force: true });
});

describe('yapı denetimi: örnekler', () => {
  it('kurallara uyan alt özellik ihlalsizdir', () => {
    expect(yapiyiDenetle(kur(DOGRU))).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
  });

  it('adı "." ile başlayan girdi (işletim sisteminin, aracın bıraktığı) sayılmaz', () => {
    const features = kur([...DOGRU, 'alt/.DS_Store', 'alt/.claude/x']);
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
  });

  it('komutu olmayan alt özellikte varlık aranmaz; adı "_" ile başlayan klasör alt özellik sayılmaz', () => {
    const features = kur([
      'alt/application/queries/alt-oku/alt-oku.query.ts',
      'alt/application/queries/alt-oku/alt-oku.handler.ts',
      '_shared/her-sey.ts',
    ]);
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
  });

  it('commands ve queries klasörü olmayan alt özellik de sınanır', () => {
    const features = kur(['alt/alt.module.ts', 'alt/application/x.handler.ts']);
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'b',
            yol: 'ornek/alt/application/x.handler.ts',
            neden: expect.any(String) as string,
          },
        ],
      },
    ]);
  });

  it.each<[string, YapiKurali, { ekle?: string[]; cikar?: string[] }, string]>([
    [
      'kökte izinsiz dosya',
      'a',
      { ekle: ['alt/yardimci.ts'] },
      'alt/yardimci.ts',
    ],
    [
      'kökte izinsiz klasör',
      'a',
      { ekle: ['alt/interface/alt.controller.ts'] },
      'alt/interface',
    ],
    [
      'modül adı alt özelliğin adı değil',
      'a',
      { ekle: ['alt/baska.module.ts'] },
      'alt/baska.module.ts',
    ],
    [
      'application altında izinsiz klasör',
      'b',
      { ekle: ['alt/application/handlers/alt.handler.ts'] },
      'alt/application/handlers',
    ],
    [
      'application kökünde dosya',
      'b',
      { ekle: ['alt/application/alt.query.ts'] },
      'alt/application/alt.query.ts',
    ],
    [
      'commands altında iş klasörü dışında dosya',
      'b',
      { ekle: ['alt/application/commands/alt-sil.handler.ts'] },
      'alt/application/commands/alt-sil.handler.ts',
    ],
    [
      'komutun işleyicisi eksik',
      'b',
      { cikar: ['alt/application/commands/alt-yaz/alt-yaz.handler.ts'] },
      'alt/application/commands/alt-yaz/alt-yaz.handler.ts',
    ],
    [
      'sorgunun sorgu dosyası eksik',
      'b',
      { cikar: ['alt/application/queries/alt-oku/alt-oku.query.ts'] },
      'alt/application/queries/alt-oku/alt-oku.query.ts',
    ],
    [
      'dosya öneki klasör adından farklı',
      'b',
      { ekle: ['alt/application/commands/alt-yaz/baska.result.ts'] },
      'alt/application/commands/alt-yaz/baska.result.ts',
    ],
    [
      'iş klasöründe izinsiz sonek',
      'b',
      { ekle: ['alt/application/queries/alt-oku/alt-oku.schema.ts'] },
      'alt/application/queries/alt-oku/alt-oku.schema.ts',
    ],
    [
      'iş klasöründe alt klasör',
      'b',
      { ekle: ['alt/application/commands/alt-yaz/ek/x.ts'] },
      'alt/application/commands/alt-yaz/ek',
    ],
    [
      'domain kökünde port olmayan dosya',
      'c',
      { ekle: ['alt/domain/alt.repository.ts'] },
      'alt/domain/alt.repository.ts',
    ],
    [
      'domain altında izinsiz klasör',
      'c',
      { ekle: ['alt/domain/validators/ad.ts'] },
      'alt/domain/validators',
    ],
    [
      'repositories altında i- öneki yok',
      'c',
      { ekle: ['alt/domain/repositories/alt.repository.ts'] },
      'alt/domain/repositories/alt.repository.ts',
    ],
    [
      'repository arayüzü repositories dışında',
      'c',
      { ekle: ['alt/domain/services/i-alt.repository.ts'] },
      'alt/domain/services/i-alt.repository.ts',
    ],
    [
      'komutu olan alt özellikte varlık yok',
      'c',
      { cikar: ['alt/domain/entities/alt.entity.ts'] },
      'alt/domain/entities',
    ],
    [
      'repository gerçeklemesi infrastructure kökünde',
      'd',
      { ekle: ['alt/infrastructure/alt-yazma.bellek-repository.ts'] },
      'alt/infrastructure/alt-yazma.bellek-repository.ts',
    ],
    [
      'repository gerçeklemesi başka klasörde',
      'd',
      { ekle: ['alt/infrastructure/kapi/alt.repository.ts'] },
      'alt/infrastructure/kapi/alt.repository.ts',
    ],
    [
      'repositories altında adı kalıba uymayan gerçekleme',
      'd',
      { ekle: ['alt/infrastructure/repositories/alt-yazici.kapi.ts'] },
      'alt/infrastructure/repositories/alt-yazici.kapi.ts',
    ],
    [
      'sunumda şema dosyası',
      'e',
      { ekle: ['alt/presentation/alt-yaz.schema.ts'] },
      'alt/presentation/alt-yaz.schema.ts',
    ],
  ])(
    '%s kural %s ile yakalanır',
    (_ad, kural, { ekle = [], cikar = [] }, yol) => {
      const features = kur([
        ...DOGRU.filter((d) => !cikar.includes(d)),
        ...ekle,
      ]);
      expect(yapiyiDenetle(features)).toEqual([
        {
          ad: 'ornek/alt',
          ihlaller: [
            { kural, yol: `ornek/${yol}`, neden: expect.any(String) as string },
          ],
        },
      ]);
    },
  );
});

// TS-007 "Adlar, denetim ve geçiş": j Prisma repository'sinde vekil çağrısı, k okumada yetki süzgeci,
// bekleyenler eski yüzü çağıran alt özellikler.
describe('yapı denetimi: repository ve yetki yüzü', () => {
  const OKUMA = 'alt/infrastructure/repositories/alt.prisma-repository.ts';
  const YAZMA =
    'alt/infrastructure/repositories/alt-yazma.prisma-repository.ts';
  const KAPI_ICE_AKTARMASI =
    "import { YazmaKapisi } from '../../../../../shared/yetki/infrastructure/yazma-kapisi.js';\n";

  it('yeni biçimli okuma ve yazma repository ihlalsizdir ve alt özellik bekleyen değildir', () => {
    const features = kur([...DOGRU, YAZMA], {
      [YAZMA]:
        KAPI_ICE_AKTARMASI +
        "return this.kapi.deyimleSil(islem, isAdi, 'Alt', id, (vt, where, veri) => vt.alt.updateMany({ where, data: veri }));",
    });
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
    expect(bekleyenler(features)).toEqual([]);
  });

  it('Prisma vekili çağrısı olmayan prisma-repository dosyası kural j ile yakalanır', () => {
    const features = kur(DOGRU, {
      [OKUMA]: "return kapi.yetki('Alt', { bakilan: [] });",
    });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'j',
            yol: `ornek/${OKUMA}`,
            neden: expect.any(String) as string,
          },
        ],
      },
    ]);
  });

  it('yetki süzgecini taşımayan okuma deyimi kural k ile yakalanır; süzgeçli deyim ve yeniden okuma geçer', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        DOGRU_ICERIK[OKUMA],
        'const sayi = await istemci.alt.count({ where: { id } });',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'k',
            yol: `ornek/${OKUMA}`,
            neden: 'okuma deyimi yetki süzgecini taşımıyor: count (satır 4)',
          },
        ],
      },
    ]);
  });

  it('okumayı kapatan çağrının ilk bağımsız değişkenindeki süzgeçsiz okuma kural k ile yakalanır; yalnız yeniden okuma muaftır', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'return yetki.kayitlar(await istemci.alt.findMany({ where: { id } }), (where, select) => istemci.alt.findMany({ where, select }));',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'k',
            yol: `ornek/${OKUMA}`,
            neden: 'okuma deyimi yetki süzgecini taşımıyor: findMany (satır 2)',
          },
        ],
      },
    ]);
  });

  it('okumayı kapatan çağrının ilk bağımsız değişkenindeki süzgeçli okuma geçer', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'return yetki.kayitlar(await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar }), (where, select) => istemci.alt.findMany({ where, select }));',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
  });

  it('süzgeçle aynı adlı yerel değişken süzgeç sayılmaz; kural k ile yakalanır', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'const satirlar = { id };',
        'const kayitlar = await istemci.alt.findMany({ where: satirlar, select: yetki.kolonlar });',
        'return yetki.kayitlar(kayitlar, (where, select) => istemci.alt.findMany({ where, select }));',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'k',
            yol: `ornek/${OKUMA}`,
            neden: 'okuma deyimi yetki süzgecini taşımıyor: findMany (satır 3)',
          },
        ],
      },
    ]);
  });

  it.each([
    [
      'süzgeçli okuma kapatan çağrı olmadan döner',
      [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'return istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar });',
      ],
      'findMany (satır 2)',
    ],
    [
      'iki süzgeçli okumadan yalnız sonraki kapatılır',
      [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'const a = await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar });',
        'const b = await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar });',
        'return yetki.kayitlar(b, (where, select) => istemci.alt.findMany({ where, select }));',
      ],
      'findMany (satır 2)',
    ],
  ])('%s: kural l ile yakalanır', (_ad, satirlar, deyim) => {
    const features = kur(DOGRU, { [OKUMA]: satirlar.join('\n') });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'l',
            yol: `ornek/${OKUMA}`,
            neden: `süzgeçli okuma okumayı kapatan çağrıyla kapanmıyor: ${deyim}`,
          },
        ],
      },
    ]);
  });

  it('her süzgeçli okuma kendi kapatan çağrısıyla kapanınca kural l geçer', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [DOGRU_ICERIK[OKUMA], DOGRU_ICERIK[OKUMA]].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
  });

  it('çekirdek repository okumasında yetki süzgeci aranmaz', () => {
    const features = kurSrc({
      'kimlik/parola/infrastructure/repositories/parola.prisma-repository.ts':
        'return istemci.kullanici.findUnique({ where: { kullaniciAdi } });',
    });
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'kimlik/parola', ihlaller: [] },
    ]);
  });

  it('eski yüzü çağıran alt özellik adıyla bekleyendir; Prisma çağrısı olmayan dosyası kural j ile, eski yüz çağrısı kural m ile yakalanır', () => {
    const features = kur(DOGRU, {
      [OKUMA]:
        "import type { OkumaKapisi } from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';\n" +
        "return kapi.liste(istemci, 'Alt', { sayfa });",
    });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'j',
            yol: `ornek/${OKUMA}`,
            neden: expect.any(String) as string,
          },
          {
            kural: 'm',
            yol: `ornek/${OKUMA}`,
            neden: 'eski yüzü çağırır; alt özellik bekleyendir',
          },
        ],
      },
    ]);
    expect(bekleyenler(features)).toEqual(['ornek/alt']);
  });

  // TS-007 "Adlar, denetim ve geçiş": geçiş bitti; bekleyen alt özellik, .kapi-repository.ts adı ve
  // feature'ın test kodunu ya da eski yüzün adını içe aktarması ihlaldir.
  it.each<[string, YapiKurali, string, string]>([
    [
      'işleyicisi eski yüzü çağıran (bekleyen) alt özellik',
      'm',
      'alt/application/queries/alt-oku/alt-oku.handler.ts',
      "import { OkumaKapisi } from '../../../../../../shared/yetki/infrastructure/okuma-kapisi.js';\n" +
        "return this.kapi.tek(istemci, 'Alt', id);",
    ],
    [
      '.kapi-repository.ts adlı yazma repository',
      'n',
      'alt/infrastructure/repositories/alt-yazma.kapi-repository.ts',
      '',
    ],
    [
      'test yardımcısını içe aktaran feature dosyası',
      'o',
      'alt/infrastructure/repositories/alt-yazma.prisma-repository.ts',
      "import { yardimci } from '../../../../../../test/yardimci/baska.js';\n" +
        "return this.kapi.deyimleSil(islem, isAdi, 'Alt', id, (vt, where) => vt.alt.deleteMany({ where }));",
    ],
    [
      'eski yüzün adını içe aktaran feature dosyası',
      'o',
      'alt/application/_shared/liste.ts',
      "import type {\n  ListeIstegi,\n} from '../../../../../shared/yetki/infrastructure/okuma-kapisi.js';",
    ],
  ])('%s kural %s ile yakalanır', (_ad, kural, dosya, metin) => {
    const features = kur([...DOGRU, dosya], { [dosya]: metin });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          { kural, yol: `ornek/${dosya}`, neden: expect.any(String) as string },
        ],
      },
    ]);
  });

  it('tip bağımsız değişkenli kapatan çağrı (kayitlar<Tip>(…)) tanınır: okuma kapanır, yeniden okuma muaftır', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'const satirlar = await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar });',
        'return yetki.kayitlar<Gorunum<AltSatiri>>(satirlar, (where, select) => istemci.alt.findMany({ where, select }));',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
  });

  it('tip bağımsız değişkenli kapatan çağrının ilk bağımsız değişkenindeki süzgeçsiz okuma kural k ile yakalanır; yalnız yeniden okuma muaftır', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'return yetki.kayitlar<AltSatiri>(await istemci.alt.findMany({ where: { id } }), (where, select) => istemci.alt.findMany({ where, select }));',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'k',
            yol: `ornek/${OKUMA}`,
            neden: 'okuma deyimi yetki süzgecini taşımıyor: findMany (satır 2)',
          },
        ],
      },
    ]);
  });

  it('sonraki okuma kapatan çağrının ilk bağımsız değişkenine satır içi yazılınca önceki süzgeçli okuma kapanmış sayılmaz; kural l ile yakalanır', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'const a = await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar });',
        'return yetki.kayitlar(await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar }), (where, select) => istemci.alt.findMany({ where, select }));',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      {
        ad: 'ornek/alt',
        ihlaller: [
          {
            kural: 'l',
            yol: `ornek/${OKUMA}`,
            neden:
              'süzgeçli okuma okumayı kapatan çağrıyla kapanmıyor: findMany (satır 2)',
          },
        ],
      },
    ]);
  });

  it('önceki okuma kendi kapatan çağrısıyla, sonraki satır içi okuma kendi çağrısıyla kapanınca kural l geçer', () => {
    const features = kur(DOGRU, {
      [OKUMA]: [
        "const yetki = kapi.yetki('Alt', { bakilan: [] });",
        'const a = await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar });',
        'const ka = await yetki.kayitlar(a, (where, select) => istemci.alt.findMany({ where, select }));',
        'return yetki.kayitlar(await istemci.alt.findMany({ where: yetki.satirlar, select: yetki.kolonlar }), (where, select) => istemci.alt.findMany({ where, select }));',
      ].join('\n'),
    });
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', ihlaller: [] },
    ]);
  });
});

// Kurallara uyan küçük bir src: katmanlı iki konu (konu, baska), katman klasörü olmayan dört istisna,
// yalnız üretilen kodu taşıyan veritabanı konusu ve feature içi ortak klasör (ornek/_shared).
// Dosya adı → içerik.
const DOGRU_ORTAK: Record<string, string> = {
  'shared/konu/konu.module.ts': "import { Queue } from 'bullmq';",
  'shared/konu/olay.module.ts': '',
  'shared/konu/domain/i-konu.contract.ts':
    "import { randomUUID } from 'node:crypto';\nimport type { Tip } from './tip.js';",
  'shared/konu/domain/tip.ts':
    "import type { Sonuc } from '../../domain/sonuc.js';\nexport { B } from '../../baska/domain/b.js';",
  'shared/konu/domain/olay/i-olay.repository.ts':
    "import { RepoBelirteci } from '../../../database/domain/repo-belirteci.js';",
  'shared/konu/application/hizmet.ts':
    "import { Injectable } from '@nestjs/common';\nimport { z } from 'zod';\n" +
    "import type { Tip } from '../domain/tip.js';\n" +
    "import { UnitOfWork } from '../../database/infrastructure/unit-of-work.js';",
  'shared/konu/infrastructure/konu.prisma-repository.ts':
    "import type { Prisma } from '../../database/generated/client.js';\nimport { Queue } from 'bullmq';",
  'shared/baska/domain/b.ts': '',
  'shared/database/generated/client.ts': "import pg from 'pg';",
  'shared/database/iz/generated/client.ts': '',
  'shared/domain/sonuc.ts': '',
  'shared/filters/hata-suzgeci.ts': '',
  'shared/kimlik/domain/i-giris.contract.ts': '',
  'shared/kimlik/application/i-giris.port.ts': "import { z } from 'zod';",
  'shared/observability/iz/i-outbox-iz.repository.ts': '',
  'shared/observability/iz/outbox-iz.prisma-repository.ts': '',
  'features/ornek/_shared/ornek-cekirdek.module.ts': '',
  'features/ornek/_shared/domain/repositories/i-cekirdek.repository.ts':
    "import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';",
  'features/ornek/_shared/application/parca.ts':
    "import { Islem } from '../../../../shared/database/domain/islem.js';",
  'features/ornek/_shared/infrastructure/repositories/cekirdek.prisma-repository.ts':
    'return istemci.kullanici.findUnique({ where: { id } });',
  'features/ornek/alt/yardimci.ts': "import { Queue } from 'bullmq';",
};

const ORTAK_KONULAR = [
  'shared/baska',
  'shared/database',
  'shared/domain',
  'shared/filters',
  'shared/kimlik',
  'shared/konu',
  'shared/observability',
  'features/ornek/_ortak',
  'features/ornek/_shared',
];

// Yeni bir src klasörüne verilen dosyaları içerikleriyle kurar ve yolunu döner.
function kurSrc(dosyalar: Record<string, string>): string {
  sayac += 1;
  const src = join(kok, String(sayac));
  for (const [dosya, metin] of Object.entries(dosyalar)) {
    const yol = join(src, dosya);
    mkdirSync(dirname(yol), { recursive: true });
    writeFileSync(yol, metin);
  }
  return src;
}

describe('yapı denetimi: ortak kod örnekleri', () => {
  it('kurallara uyan ortak kod ihlalsizdir; her konu ve her feature içi ortak klasör sınanır', () => {
    const src = kurSrc({
      ...DOGRU_ORTAK,
      'features/ornek/_ortak/domain/x.ts': '',
    });
    expect(ortakKoduDenetle(src)).toEqual(
      ORTAK_KONULAR.map((ad) => ({ ad, ihlaller: [] })),
    );
  });

  it.each<[string, YapiKurali, Record<string, string>, string]>([
    [
      'konunun kökünde izinsiz klasör',
      'f',
      { 'shared/konu/olay/olay.ts': '' },
      'shared/konu/olay',
    ],
    [
      'konunun kökünde modül olmayan dosya',
      'f',
      { 'shared/konu/komut-baglami.ts': '' },
      'shared/konu/komut-baglami.ts',
    ],
    [
      'yalnız üretilen kodu taşımayan klasör kökte',
      'f',
      { 'shared/database/iz/baglanti.ts': '' },
      'shared/database/iz',
    ],
    [
      'feature içi ortak klasörün kökünde modül olmayan dosya',
      'f',
      { 'features/ornek/_shared/yardimci.ts': '' },
      'features/ornek/_shared/yardimci.ts',
    ],
    [
      'domain çatıyı içe aktarır',
      'g',
      {
        'shared/konu/domain/a.ts':
          "import { Injectable } from '@nestjs/common';",
      },
      'shared/konu/domain/a.ts',
    ],
    [
      'domain kendi konusunun application dosyasını içe aktarır',
      'g',
      {
        'shared/konu/domain/a.ts':
          "import { H } from '../application/hizmet.js';",
      },
      'shared/konu/domain/a.ts',
    ],
    [
      'domain başka konunun infrastructure dosyasını dışa aktarır',
      'g',
      {
        'shared/konu/domain/a.ts':
          "export { Y } from '../../baska/infrastructure/y.js';",
      },
      'shared/konu/domain/a.ts',
    ],
    [
      'istisna konunun domain dosyası paket içe aktarır',
      'g',
      {
        'shared/kimlik/domain/i-giris.contract.ts': "import { z } from 'zod';",
      },
      'shared/kimlik/domain/i-giris.contract.ts',
    ],
    [
      'feature içi ortak domain dinamik içe aktarır',
      'g',
      {
        'features/ornek/_shared/domain/a.ts':
          "export const yukle = () => import('../infrastructure/b.js');",
      },
      'features/ornek/_shared/domain/a.ts',
    ],
    [
      'application üretilen veritabanı istemcisini içe aktarır',
      'h',
      {
        'shared/konu/application/b.ts':
          "import type { Prisma } from '../../database/generated/client.js';",
      },
      'shared/konu/application/b.ts',
    ],
    [
      'application Prisma paketini içe aktarır',
      'h',
      {
        'shared/konu/application/b.ts':
          "import { PrismaClient } from '@prisma/client';",
      },
      'shared/konu/application/b.ts',
    ],
    [
      'application veritabanı sürücüsünü içe aktarır',
      'h',
      { 'shared/konu/application/b.ts': "import pg from 'pg';" },
      'shared/konu/application/b.ts',
    ],
    [
      'application kuyruk kitaplığını içe aktarır',
      'h',
      { 'shared/konu/application/b.ts': "import { Queue } from 'bullmq';" },
      'shared/konu/application/b.ts',
    ],
    [
      'feature içi ortak application kuyruk kitaplığının alt yolunu içe aktarır',
      'h',
      {
        'features/ornek/_shared/application/b.ts':
          "import type { Job } from 'bullmq/dist/esm/classes/job.js';",
      },
      'features/ornek/_shared/application/b.ts',
    ],
    [
      'sözleşmenin adında i- öneki yok',
      'i',
      { 'shared/kimlik/domain/giris.contract.ts': '' },
      'shared/kimlik/domain/giris.contract.ts',
    ],
    [
      'repository arayüzünün adında i- öneki yok',
      'i',
      { 'shared/konu/domain/konu.repository.ts': '' },
      'shared/konu/domain/konu.repository.ts',
    ],
    [
      'katman klasörü olmayan alt alanda repository adı kalıba uymuyor',
      'i',
      { 'shared/observability/iz/outbox-iz.repository.ts': '' },
      'shared/observability/iz/outbox-iz.repository.ts',
    ],
    [
      'feature içi ortak klasörde repository adı kalıba uymuyor',
      'i',
      {
        'features/ornek/_shared/domain/repositories/cekirdek.repository.ts': '',
      },
      'features/ornek/_shared/domain/repositories/cekirdek.repository.ts',
    ],
    [
      'feature içi ortak klasörde Prisma vekili çağrısı olmayan prisma-repository',
      'j',
      {
        'features/ornek/_shared/infrastructure/repositories/cekirdek.prisma-repository.ts':
          'return kayitlar;',
      },
      'features/ornek/_shared/infrastructure/repositories/cekirdek.prisma-repository.ts',
    ],
    [
      'feature içi ortak klasörde .kapi-repository.ts adı',
      'n',
      {
        'features/ornek/_shared/infrastructure/repositories/cekirdek-yazma.kapi-repository.ts':
          '',
      },
      'features/ornek/_shared/infrastructure/repositories/cekirdek-yazma.kapi-repository.ts',
    ],
    [
      'feature içi ortak klasör test yardımcısını içe aktarır',
      'o',
      {
        'features/ornek/_shared/application/parca.ts':
          "import { yardimci } from '../../../../../test/yardimci/baska.js';",
      },
      'features/ornek/_shared/application/parca.ts',
    ],
  ])('%s kural %s ile yakalanır', (_ad, kural, ekle, yol) => {
    const raporlar = ortakKoduDenetle(kurSrc({ ...DOGRU_ORTAK, ...ekle }));
    expect(raporlar.flatMap((r) => r.ihlaller)).toEqual([
      { kural, yol, neden: expect.any(String) as string },
    ]);
  });
});

// Feature'ın kökünde doğrudan duran dosyalar n ve o'dan geçer; src'nin hiçbir dosyası test klasöründen
// içe aktarmaz (p). Test klasörü içe aktarılan yolun çözüldüğü yerle tanınır, adla değil.
describe('yapı denetimi: feature kökü ve test klasörü', () => {
  // Dört düzey yukarıdaki test klasörü. Örnek metinlerde açık yazılmaz: denetim metin düzeyindedir ve bu
  // dosya da src'de dört düzey derindedir; açık yazılsa gerçek depoda bu dosya kural p'ye takılırdı.
  const TEST_KLASORU = '../../../../test';

  it("kurallara uyan feature kökü ve src'nin içinde kalan içe aktarmalar ihlalsizdir", () => {
    const src = kurSrc({
      ...DOGRU_ORTAK,
      'features/ornek/ornek.module.ts':
        "import { AltModule } from './alt/alt.module.js';\nimport { T } from '../../shared/test/t.js';",
      'main.ts': "import { AppModule } from './app.module.js';",
      'shared/konu/infrastructure/x.spec.ts':
        "import type { Tip } from '../domain/tip.js';",
    });
    expect(featureKokunuDenetle(join(src, 'features'))).toEqual([]);
    expect(testIceAktarmasiniDenetle(src)).toEqual([]);
  });

  it.each<[string, YapiKurali, Record<string, string>, string]>([
    [
      'feature kökünde .kapi-repository.ts adı',
      'n',
      { 'features/ornek/ornek-yazma.kapi-repository.ts': '' },
      'ornek/ornek-yazma.kapi-repository.ts',
    ],
    [
      'feature kökündeki modül test yardımcısını içe aktarır',
      'o',
      {
        'features/ornek/ornek.module.ts':
          "import { yardimci } from '../../../test/yardimci/baska.js';",
      },
      'ornek/ornek.module.ts',
    ],
    [
      'feature kökündeki modül eski yüzün adını içe aktarır',
      'o',
      {
        'features/ornek/ornek.module.ts':
          "import type { ListeIstegi } from '../../shared/yetki/infrastructure/okuma-kapisi.js';",
      },
      'ornek/ornek.module.ts',
    ],
  ])('%s kural %s ile yakalanır', (_ad, kural, ekle, yol) => {
    const src = kurSrc({ ...DOGRU_ORTAK, ...ekle });
    expect(featureKokunuDenetle(join(src, 'features'))).toEqual([
      { kural, yol, neden: expect.any(String) as string },
    ]);
  });

  it.each<[string, Record<string, string>, string]>([
    [
      'ortak kodun spec dosyası test yardımcısını içe aktarır',
      {
        'shared/konu/infrastructure/x.spec.ts': `import { EskiOkumaKapisi } from '${TEST_KLASORU}/yardimci/eski-yuz.js';`,
      },
      'shared/konu/infrastructure/x.spec.ts',
    ],
    [
      'src kökündeki dosya test klasörünü dinamik içe aktarır',
      { 'main.ts': "const y = await import('../test/yardimci/x.js');" },
      'main.ts',
    ],
    [
      'alt özellik dosyası test klasöründen dışa aktarır',
      {
        'features/ornek/alt/yardimci.ts': `export { y } from '${TEST_KLASORU}/yardimci/x.js';`,
      },
      'features/ornek/alt/yardimci.ts',
    ],
  ])('%s kural p ile yakalanır', (_ad, ekle, yol) => {
    const src = kurSrc({ ...DOGRU_ORTAK, ...ekle });
    expect(testIceAktarmasiniDenetle(src)).toEqual([
      { kural: 'p', yol, neden: expect.any(String) as string },
    ]);
  });
});

describe('yapı denetimi: gerçek depo', () => {
  it('bütün alt özellikler sınanır ve ihlal yoktur', () => {
    const features = fileURLToPath(
      new URL('../../../features', import.meta.url),
    );
    const raporlar = yapiyiDenetle(features);
    process.stdout.write(
      `sınanan alt özellik (${String(raporlar.length)}): ${raporlar.map((r) => r.ad).join(', ')}\n`,
    );
    expect(raporlar.map((r) => r.ad)).toEqual([
      'kimlik/grup',
      'kimlik/kullanici',
      'kimlik/oturum',
      'kimlik/parola',
      'kimlik/rol',
      'kimlik/uyelik',
      'kimlik/yetenek',
    ]);
    expect(raporlar.flatMap((r) => r.ihlaller)).toEqual([]);
  });

  // Geçiş bitti (TS-007 "Aşamalar" 7): eski yüzü çağıran alt özellik kalmaz; sıfır değilse test kırmızıdır.
  it('eski yüzü çağıran (bekleyen) alt özellik yoktur; varsa adlarıyla yazılır', () => {
    const features = fileURLToPath(
      new URL('../../../features', import.meta.url),
    );
    const bekleyen = bekleyenler(features);
    process.stdout.write(
      `bekleyen: ${String(bekleyen.length)}${bekleyen.length > 0 ? ` (${bekleyen.join(', ')})` : ''}\n`,
    );
    expect(bekleyen).toEqual([]);
  });

  it('ortak kodun bütün konuları ve feature içi ortak klasör sınanır ve ihlal yoktur', () => {
    const src = fileURLToPath(new URL('../../..', import.meta.url));
    const raporlar = ortakKoduDenetle(src);
    process.stdout.write(
      `sınanan konu (${String(raporlar.length)}): ${raporlar.map((r) => r.ad).join(', ')}\n`,
    );
    expect(raporlar.map((r) => r.ad)).toEqual([
      'shared/database',
      'shared/domain',
      'shared/filters',
      'shared/guvenlik',
      'shared/http',
      'shared/kimlik',
      'shared/messaging',
      'shared/observability',
      'shared/tohum',
      'shared/yapi',
      'shared/yetki',
      'features/kimlik/_shared',
    ]);
    expect(raporlar.flatMap((r) => r.ihlaller)).toEqual([]);
  });

  it("feature'ların kökündeki dosyalarda ihlal yoktur", () => {
    const features = fileURLToPath(
      new URL('../../../features', import.meta.url),
    );
    expect(featureKokunuDenetle(features)).toEqual([]);
  });

  it('kaynak kodunun hiçbir dosyası test klasöründen içe aktarmaz', () => {
    const src = fileURLToPath(new URL('../../..', import.meta.url));
    expect(testIceAktarmasiniDenetle(src)).toEqual([]);
  });
});
