// Yapı denetiminin testi: her kural geçici klasörde kurulan doğru ve yanlış örneklerle sınanır; sonra
// gerçek depoda taşınmış alt özelliklerin ihlali olmadığı, taşınmamışların adları yazılarak sınanır.
// Koşturma: pnpm -C backend test src/shared/yapi/yapi-denetimi.spec.ts --reporter=verbose
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type YapiKurali, yapiyiDenetle } from './yapi-denetimi.js';

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

let kok: string;
let sayac = 0;

// Yeni bir features klasörüne ornek/<dosyalar> kurar ve yolunu döner.
function kur(dosyalar: readonly string[]): string {
  sayac += 1;
  const features = join(kok, String(sayac));
  for (const dosya of dosyalar) {
    const yol = join(features, 'ornek', dosya);
    mkdirSync(dirname(yol), { recursive: true });
    writeFileSync(yol, '');
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
  it('kurallara uyan alt özellik ihlalsizdir ve taşınmış sayılır', () => {
    expect(yapiyiDenetle(kur(DOGRU))).toEqual([
      { ad: 'ornek/alt', tasinmis: true, ihlaller: [] },
    ]);
  });

  it('adı "." ile başlayan girdi (işletim sisteminin, aracın bıraktığı) sayılmaz', () => {
    const features = kur([...DOGRU, 'alt/.DS_Store', 'alt/.claude/x']);
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', tasinmis: true, ihlaller: [] },
    ]);
  });

  it('komutu olmayan alt özellikte varlık aranmaz; adı "_" ile başlayan klasör denetlenmez', () => {
    const features = kur([
      'alt/application/queries/alt-oku/alt-oku.query.ts',
      'alt/application/queries/alt-oku/alt-oku.handler.ts',
      '_shared/her-sey.ts',
    ]);
    expect(yapiyiDenetle(features)).toEqual([
      { ad: 'ornek/alt', tasinmis: true, ihlaller: [] },
    ]);
  });

  it('commands ve queries klasörü olmayan alt özellik taşınmamış sayılır', () => {
    const features = kur(['alt/alt.module.ts', 'alt/application/x.handler.ts']);
    expect(yapiyiDenetle(features)).toMatchObject([
      { ad: 'ornek/alt', tasinmis: false },
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
      { ekle: ['alt/infrastructure/alt-yazma.kapi-repository.ts'] },
      'alt/infrastructure/alt-yazma.kapi-repository.ts',
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
          tasinmis: true,
          ihlaller: [
            { kural, yol: `ornek/${yol}`, neden: expect.any(String) as string },
          ],
        },
      ]);
    },
  );
});

describe('yapı denetimi: gerçek depo', () => {
  it('taşınmış alt özelliklerde ihlal yoktur; taşınmamışlar bekleyen olarak yazılır', () => {
    const features = fileURLToPath(new URL('../../features', import.meta.url));
    const raporlar = yapiyiDenetle(features);
    const tasinmis = raporlar.filter((r) => r.tasinmis);
    const bekleyen = raporlar.filter((r) => !r.tasinmis).map((r) => r.ad);
    process.stdout.write(
      `taşınmış (${String(tasinmis.length)}): ${tasinmis.map((r) => r.ad).join(', ')}\n` +
        `bekleyen (${String(bekleyen.length)}): ${bekleyen.join(', ')}\n`,
    );
    expect(tasinmis.map((r) => r.ad)).toContain('kimlik/rol');
    expect(tasinmis.flatMap((r) => r.ihlaller)).toEqual([]);
  });
});
