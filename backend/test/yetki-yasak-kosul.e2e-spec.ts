// Yasağın "kesin tutmuyor" koşulu (TS-008 "Aşamalar" 2, "Derleme"; kapanan AU-5). Koşturma:
//   pnpm -C backend test:e2e test/yetki-yasak-kosul.e2e-spec.ts --reporter=verbose
// Göçleri uygulanmış geçici veritabanında, gerçek sorguyla koşar. Kaynak Kullanici'dir: telefon boş
// olabilen metin, pasifZamani boş olabilen zaman, yetkiSurumu boş olamayan sayıdır. Göçlerin tohumladığı
// satırlar sonucu bozmasın diye her sorgu testin kendi satırlarının kimlikleriyle daraltılır.
import { PrismaPg } from '@prisma/adapter-pg';
import type { Islec } from '../src/shared/kimlik/domain/i-yetki-verisi.contract.js';
import { PrismaClient } from '../src/shared/database/generated/client.js';
import {
  type CozulmusSartOgesi,
  type PrismaKosulu,
  kesinTutmuyorKosulu,
  sartiCevir,
} from '../src/shared/yetki/application/sart-cevirici.js';
import { prismaKaynakKatalogu } from '../src/shared/yetki/infrastructure/prisma-kaynak-katalogu.js';
import { createTestDatabase, type TestDatabase } from './test-database.js';

const BOS_OLABILIRLIK =
  prismaKaynakKatalogu(['Kullanici']).bosOlabilirlik('Kullanici') ?? {};
const ALANLAR = Object.keys(BOS_OLABILIRLIK);

const ONCE = '2026-01-01T00:00:00.000Z';
const ESIK = '2026-06-01T00:00:00.000Z';
const SONRA = '2026-12-01T00:00:00.000Z';

let db: TestDatabase;
let prisma: PrismaClient;
let sira = 0;

// Testin kendi satırları: her çağrı yeni kimliklerle yazar.
async function satirlar(
  degerler: readonly {
    readonly telefon?: string | null;
    readonly pasifZamani?: string | null;
  }[],
): Promise<string[]> {
  const kimlikler = degerler.map(() => {
    sira += 1;
    return `7a000000-0000-4000-8000-${String(sira).padStart(12, '0')}`;
  });
  await prisma.kullanici.createMany({
    data: degerler.map((d, i) => ({
      id: kimlikler[i] ?? '',
      gorunenAd: `kisi ${String(i)}`,
      telefon: d.telefon ?? null,
      pasifZamani: d.pasifZamani ?? null,
    })),
  });
  return kimlikler;
}

// Koşulun verilen satırlardan getirdiklerinin kimlikleri, sıralı.
async function getirilen(
  kimlikler: readonly string[],
  kosul: PrismaKosulu,
): Promise<string[]> {
  const bulunan = await prisma.kullanici.findMany({
    where: { AND: [{ id: { in: [...kimlikler] } }, kosul] },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return bulunan.map((s) => s.id);
}

function sartKosulu(sart: readonly CozulmusSartOgesi[]): PrismaKosulu {
  const ceviri = sartiCevir(sart, ALANLAR);
  if (!('kosul' in ceviri)) {
    throw new Error(ceviri.neden);
  }
  return ceviri.kosul;
}

beforeAll(async () => {
  db = await createTestDatabase([], { migrations: true });
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
  });
}, 60_000);

afterAll(async () => {
  await prisma.$disconnect();
  await db.drop();
});

it('katalog: telefon ve pasifZamani boş olabilir, yetkiSurumu olamaz', () => {
  expect(BOS_OLABILIRLIK).toMatchObject({
    telefon: true,
    pasifZamani: true,
    yetkiSurumu: false,
  });
});

// Ölçüm: veritabanı istemcisinin olumsuzlaması boş değerli satırda ne yapıyor. Satırlar: "a" (telefon
// a, pasif SONRA), "b" (telefon b, pasif ONCE), "bos" (ikisi de boş), "yarim" (telefon boş, pasif
// SONRA). Beklentiler ölçülen sonuçtur; boş değerli satırın gelip gelmediği adla yazılır.
describe('ölçüm: olumsuzlama ve boş değer', () => {
  let a: string;
  let b: string;
  let bos: string;
  let yarim: string;
  let ad: Record<string, string>;

  beforeAll(async () => {
    [a = '', b = '', bos = '', yarim = ''] = await satirlar([
      { telefon: 'olcum-a', pasifZamani: SONRA },
      { telefon: 'olcum-b', pasifZamani: ONCE },
      {},
      { pasifZamani: SONRA },
    ]);
    ad = { [a]: 'a', [b]: 'b', [bos]: 'bos', [yarim]: 'yarim' };
  });

  async function olc(kosul: PrismaKosulu): Promise<string[]> {
    const kimlikler = await getirilen([a, b, bos, yarim], kosul);
    return kimlikler.map((k) => ad[k] ?? k);
  }

  it.each<[string, PrismaKosulu, string[]]>([
    [
      'genel değil (NOT eşit)',
      { NOT: { telefon: { equals: 'olcum-a' } } },
      ['b'],
    ],
    ['alan düzeyinde değil (not)', { telefon: { not: 'olcum-a' } }, ['b']],
    [
      'alan düzeyinde değil, iç süzgeç (not: { equals })',
      { telefon: { not: { equals: 'olcum-a' } } },
      ['b'],
    ],
    ['listede değil (notIn)', { telefon: { notIn: ['olcum-a'] } }, ['b']],
    [
      'genel değil (NOT listede)',
      { NOT: { telefon: { in: ['olcum-a'] } } },
      ['b'],
    ],
    ['küçük (lt)', { pasifZamani: { lt: ESIK } }, ['b']],
    ['küçük eşit (lte)', { pasifZamani: { lte: ESIK } }, ['b']],
    ['büyük (gt)', { pasifZamani: { gt: ESIK } }, ['a', 'yarim']],
    ['büyük eşit (gte)', { pasifZamani: { gte: ESIK } }, ['a', 'yarim']],
    ['genel değil (NOT büyük)', { NOT: { pasifZamani: { gt: ESIK } } }, ['b']],
    [
      'değil ya da boş',
      { OR: [{ telefon: { not: 'olcum-a' } }, { telefon: { equals: null } }] },
      ['b', 'bos', 'yarim'],
    ],
    [
      'genel değil, iç içe ve: NOT (telefon = a ve pasif > eşik)',
      {
        NOT: {
          AND: [
            { telefon: { equals: 'olcum-a' } },
            { pasifZamani: { gt: ESIK } },
          ],
        },
      },
      ['b'],
    ],
    [
      'genel değil, iç içe ve: NOT (telefon = b ve pasif > eşik)',
      {
        NOT: {
          AND: [
            { telefon: { equals: 'olcum-b' } },
            { pasifZamani: { gt: ESIK } },
          ],
        },
      },
      ['a', 'b'],
    ],
    [
      'genel değil, iç içe ve: NOT (telefon = a ve pasif < eşik)',
      {
        NOT: {
          AND: [
            { telefon: { equals: 'olcum-a' } },
            { pasifZamani: { lt: ESIK } },
          ],
        },
      },
      ['a', 'b', 'yarim'],
    ],
    [
      'genel değil, iç içe veya: NOT (telefon = a veya pasif < eşik)',
      {
        NOT: {
          OR: [
            { telefon: { equals: 'olcum-a' } },
            { pasifZamani: { lt: ESIK } },
          ],
        },
      },
      [],
    ],
    // Öğesiz mantık biçimlerinin hepsi koşulsuzdur: hiçbiri "hiçbir kayıt" anlamına gelmez.
    ['öğesiz veya (OR: [])', { OR: [] }, ['a', 'b', 'bos', 'yarim']],
    ['öğesiz ve (AND: [])', { AND: [] }, ['a', 'b', 'bos', 'yarim']],
    ['boş koşul ({})', {}, ['a', 'b', 'bos', 'yarim']],
    ['öğesiz değil (NOT: {})', { NOT: {} }, ['a', 'b', 'bos', 'yarim']],
    [
      'değil, öğesiz ve (NOT: { AND: [] })',
      { NOT: { AND: [] } },
      ['a', 'b', 'bos', 'yarim'],
    ],
    [
      'öğesiz değil listesi (NOT: [{}])',
      { NOT: [{}] },
      ['a', 'b', 'bos', 'yarim'],
    ],
    [
      've içinde öğesiz veya (AND: [{ OR: [] }])',
      { AND: [{ OR: [] }] },
      ['a', 'b', 'bos', 'yarim'],
    ],
    [
      'öğesi öğesiz değil olan veya (OR: [{ NOT: {} }])',
      { OR: [{ NOT: {} }] },
      ['a', 'b', 'bos', 'yarim'],
    ],
    // Boş liste: "listede" hiçbir kaydı getirmez; "listede değil" boş değerli satır dahil hepsini getirir.
    ['boş listede, boş olabilen kolon (in: [])', { telefon: { in: [] } }, []],
    ['boş listede, boş olamayan kolon (in: [])', { id: { in: [] } }, []],
    [
      'boş listede değil (notIn: [])',
      { telefon: { notIn: [] } },
      ['a', 'b', 'bos', 'yarim'],
    ],
  ])('%s', async (_ad, kosul, beklenen) => {
    expect(await olc(kosul)).toEqual(beklenen);
  });
});

// Doğruluk tablosu: her yasak şartı için üç satır (şartı sağlayan, sağlamayan, kolonu boş). "Kesin
// tutmuyor" koşulu sağlamayanı ve boşu getirir, sağlayanı getirmez; yasağın kendi şartı yalnız
// sağlayanı getirir. İkisi aynı satırı birlikte hiç getirmez ve birleşimleri bütün satırlardır.
describe('doğruluk tablosu', () => {
  interface Satir {
    readonly telefon?: string;
    readonly pasifZamani?: string;
  }
  const telefon = (
    islec: Islec,
    deger: string | string[],
  ): CozulmusSartOgesi[] => [{ alan: 'telefon', islec, deger }];
  const pasif = (islec: Islec): CozulmusSartOgesi[] => [
    { alan: 'pasifZamani', islec, deger: ESIK },
  ];
  // Sütunlar: ad, şart, sağlayan, sağlamayan, kolonu boş. Kesin büyüklük işlecinde sağlamayan, eşitli
  // olanda sağlayan sınırdadır.
  const durumlar: [string, CozulmusSartOgesi[], Satir, Satir, Satir][] = [
    [
      'esit',
      telefon('esit', 'tel-esit'),
      { telefon: 'tel-esit' },
      { telefon: 'tel-esit-2' },
      {},
    ],
    [
      'esit_degil',
      telefon('esit_degil', 'tel-degil'),
      { telefon: 'tel-degil-2' },
      { telefon: 'tel-degil' },
      {},
    ],
    [
      'listede',
      telefon('listede', ['tel-l1', 'tel-l2']),
      { telefon: 'tel-l2' },
      { telefon: 'tel-l3' },
      {},
    ],
    [
      'listede_degil',
      telefon('listede_degil', ['tel-ld1']),
      { telefon: 'tel-ld2' },
      { telefon: 'tel-ld1' },
      {},
    ],
    ['kucuk', pasif('kucuk'), { pasifZamani: ONCE }, { pasifZamani: ESIK }, {}],
    [
      'kucuk_esit',
      pasif('kucuk_esit'),
      { pasifZamani: ESIK },
      { pasifZamani: SONRA },
      {},
    ],
    [
      'buyuk',
      pasif('buyuk'),
      { pasifZamani: SONRA },
      { pasifZamani: ESIK },
      {},
    ],
    [
      'buyuk_esit',
      pasif('buyuk_esit'),
      { pasifZamani: ESIK },
      { pasifZamani: ONCE },
      {},
    ],
    [
      've (iki öğe)',
      [
        { alan: 'telefon', islec: 'esit', deger: 'tel-ve' },
        { alan: 'pasifZamani', islec: 'buyuk', deger: ESIK },
      ],
      { telefon: 'tel-ve', pasifZamani: SONRA },
      { telefon: 'tel-ve-2', pasifZamani: SONRA },
      { pasifZamani: SONRA },
    ],
  ];

  it.each(durumlar)(
    '%s: kesin tutmuyor sağlamayanı ve boşu getirir, sağlayanı getirmez',
    async (_ad, sart, saglayan, saglamayan, bosSatir) => {
      const [s = '', d = '', bos = ''] = await satirlar([
        saglayan,
        saglamayan,
        bosSatir,
      ]);
      const hepsi = [s, d, bos];
      const tutan = await getirilen(hepsi, sartKosulu(sart));
      const tutmayan = await getirilen(
        hepsi,
        kesinTutmuyorKosulu(sart, BOS_OLABILIRLIK),
      );

      expect(tutan).toEqual([s]);
      expect(tutmayan).toEqual([d, bos].sort());
      expect(tutan.filter((k) => tutmayan.includes(k))).toEqual([]);
      expect([...tutan, ...tutmayan].sort()).toEqual([...hepsi].sort());
    },
  );

  it('ve şartında ikinci öğenin kolonu boş olan satır da getirilir', async () => {
    const sart: CozulmusSartOgesi[] = [
      { alan: 'telefon', islec: 'esit', deger: 'tel-ve-b' },
      { alan: 'pasifZamani', islec: 'buyuk', deger: ESIK },
    ];
    const [bos = ''] = await satirlar([{ telefon: 'tel-ve-b' }]);
    expect(await getirilen([bos], sartKosulu(sart))).toEqual([]);
    expect(
      await getirilen([bos], kesinTutmuyorKosulu(sart, BOS_OLABILIRLIK)),
    ).toEqual([bos]);
  });
});

it('koşulsuz yasağın kesin tutmuyor koşulu 0 satır getirir', async () => {
  const kimlikler = await satirlar([
    { telefon: 'tel-kosulsuz' },
    {},
    { pasifZamani: SONRA },
  ]);
  expect(
    await getirilen(kimlikler, kesinTutmuyorKosulu([], BOS_OLABILIRLIK)),
  ).toEqual([]);
  expect(
    await prisma.kullanici.count({
      where: kesinTutmuyorKosulu([], BOS_OLABILIRLIK),
    }),
  ).toBe(0);
});
