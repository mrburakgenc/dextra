// Yetenek içeriği alanlarının birim testi: değer nesnelerine taşınan kurallar, aynı girdide kuralların
// şemada yazıldığı zamanki (presentation/yetenek-yaz.schema.ts) hâliyle aynı sonucu ve aynı sorunları
// (yol, kod, ileti, sıra) verir. Eski şema aşağıda aynen durur.
import { z } from 'zod';
import { yetenekOlusturKomutuSemasi } from '../commands/yetenek-olustur/yetenek-olustur.command.js';
import { yetenekYenileGovdesiSemasi } from '../commands/yetenek-yenile/yetenek-yenile.command.js';

const sabitDeger = z.union([z.string(), z.number(), z.boolean()]);
const sartOgesi = z.strictObject({
  alan: z.string(),
  islec: z.enum([
    'esit',
    'esit_degil',
    'listede',
    'listede_degil',
    'kucuk',
    'kucuk_esit',
    'buyuk',
    'buyuk_esit',
  ]),
  deger: z.union([
    sabitDeger,
    z.array(sabitDeger).min(1),
    z.strictObject({
      yerTutucu: z.enum(['isteyen', 'yetenek_grubu', 'yetenek_grubu_ve_alti']),
    }),
  ]),
});
const icerikAlanlari = {
  sart: z.array(sartOgesi).min(1).nullable(),
  butunKayitlar: z.boolean(),
  butunBirimler: z.boolean(),
  kolonlar: z.array(z.string()).min(1).nullable(),
  butunKolonlar: z.boolean(),
};
function sinirlariDenetle<
  T extends z.ZodType<{
    sart: unknown;
    butunKayitlar: boolean;
    kolonlar: unknown;
    butunKolonlar: boolean;
  }>,
>(sema: T): T {
  return sema
    .refine((g) => !(g.butunKayitlar && g.sart !== null), {
      message: 'bütün kayıtlar işareti şartla birlikte yazılamaz',
      path: ['sart'],
    })
    .refine((g) => !(g.butunKolonlar && g.kolonlar !== null), {
      message: 'bütün kolonlar işareti kolon listesiyle birlikte yazılamaz',
      path: ['kolonlar'],
    });
}
const eskiYaz = sinirlariDenetle(
  z.strictObject({
    grupId: z.uuid(),
    rolId: z.uuid(),
    izinId: z.uuid(),
    ...icerikAlanlari,
  }),
);
const eskiYenile = sinirlariDenetle(z.strictObject(icerikAlanlari));

const ICERIK_ANAHTARLARI = [
  'sart',
  'butunKayitlar',
  'butunBirimler',
  'kolonlar',
  'butunKolonlar',
];

// Başarıda yeni şemanın çıktısı eski çıktının içerik alanlarının `icerik` altına alınmış hâlidir.
function ozet(sonuc: z.ZodSafeParseResult<unknown>, eski: boolean) {
  if (!sonuc.success) {
    return {
      sorunlar: sonuc.error.issues.map((s) => ({
        path: s.path,
        code: s.code,
        message: s.message,
      })),
    };
  }
  if (!eski) {
    return { deger: sonuc.data };
  }
  const veri = sonuc.data as Record<string, unknown>;
  return {
    deger: {
      ...Object.fromEntries(
        Object.entries(veri).filter(([k]) => !ICERIK_ANAHTARLARI.includes(k)),
      ),
      icerik: Object.fromEntries(
        Object.entries(veri).filter(([k]) => ICERIK_ANAHTARLARI.includes(k)),
      ),
    },
  };
}

const ID = '11111111-1111-4111-8111-111111111111';
const BAGLANTI = { grupId: ID, rolId: ID, izinId: ID };
const ICERIK = {
  sart: null,
  butunKayitlar: true,
  butunBirimler: false,
  kolonlar: null,
  butunKolonlar: true,
};
const OGE = { alan: 'ad', islec: 'esit', deger: 'x' };

// İçerik girdileri; yaz gövdesinde bağlantıyla, yenile gövdesinde yalnız kendisiyle denenir.
const ICERIKLER: [string, unknown][] = [
  ['işaretler', ICERIK],
  [
    'içerikler',
    {
      ...ICERIK,
      butunKayitlar: false,
      butunKolonlar: false,
      sart: [OGE, { alan: 'yas', islec: 'listede', deger: [1, 2] }],
      kolonlar: ['ad'],
    },
  ],
  ['ikisi de yok', { ...ICERIK, butunKayitlar: false, butunKolonlar: false }],
  ['boş şart', { ...ICERIK, butunKayitlar: false, sart: [] }],
  ['boş kolonlar', { ...ICERIK, butunKolonlar: false, kolonlar: [] }],
  ['boş şart ve bütün kayıtlar', { ...ICERIK, sart: [] }],
  ['boş kolonlar ve bütün kolonlar', { ...ICERIK, kolonlar: [] }],
  ['şart ve bütün kayıtlar', { ...ICERIK, sart: [OGE] }],
  ['kolonlar ve bütün kolonlar', { ...ICERIK, kolonlar: ['ad'] }],
  ['iki sınır da çelişik', { ...ICERIK, sart: [OGE], kolonlar: ['ad'] }],
  [
    'boş şart değeri',
    { ...ICERIK, butunKayitlar: false, sart: [{ ...OGE, deger: [] }] },
  ],
  [
    'boş şart değeri ve bütün kayıtlar',
    { ...ICERIK, sart: [{ ...OGE, deger: [] }] },
  ],
  [
    'iç içe liste şart değeri',
    { ...ICERIK, butunKayitlar: false, sart: [{ ...OGE, deger: [[]] }] },
  ],
  [
    'yer tutucu',
    {
      ...ICERIK,
      butunKayitlar: false,
      sart: [{ ...OGE, deger: { yerTutucu: 'isteyen' } }],
    },
  ],
  [
    'bilinmeyen yer tutucu',
    {
      ...ICERIK,
      butunKayitlar: false,
      sart: [{ ...OGE, deger: { yerTutucu: 'x' } }],
    },
  ],
  [
    'şart öğesinde fazla alan',
    { ...ICERIK, butunKayitlar: false, sart: [{ ...OGE, x: 1 }] },
  ],
  [
    'şart öğesinde bilinmeyen işleç',
    { ...ICERIK, butunKayitlar: false, sart: [{ ...OGE, islec: 'gibi' }] },
  ],
  ['metin olmayan kolon', { ...ICERIK, butunKolonlar: false, kolonlar: [1] }],
  [
    'metin olmayan kolon ve boş şart',
    { ...ICERIK, butunKolonlar: false, kolonlar: [1], sart: [] },
  ],
  [
    'eksik işaret ve boş şart',
    { ...ICERIK, butunBirimler: undefined, sart: [] },
  ],
  ['eksik şart', { ...ICERIK, sart: undefined }],
  ['fazla alan', { ...ICERIK, fazla: true }],
  ['fazla alan ve çelişik sınır', { ...ICERIK, fazla: true, sart: [OGE] }],
  ['fazla alan ve boş şart', { ...ICERIK, fazla: true, sart: [] }],
];

const GOVDELER: [string, unknown][] = [
  ...ICERIKLER.map(([ad, icerik]): [string, unknown] => [
    ad,
    { ...BAGLANTI, ...(icerik as object) },
  ]),
  [
    'geçersiz kimlik ve çelişik sınır',
    { ...BAGLANTI, grupId: 'x', ...ICERIK, sart: [OGE] },
  ],
  [
    'geçersiz kimlik ve boş kolonlar',
    { ...BAGLANTI, izinId: 'x', ...ICERIK, butunKolonlar: false, kolonlar: [] },
  ],
  [
    'eksik kimlik ve çelişik sınır',
    { ...ICERIK, rolId: ID, izinId: ID, sart: [OGE] },
  ],
  ['boş gövde', {}],
  ['null', null],
  ['metin', 'x'],
];

describe('yetenek içeriği alanları', () => {
  it.each(GOVDELER)(
    'yaz gövdesi (%s): sonuç eski şemanınkiyle aynı',
    (_ad, govde) => {
      expect(ozet(yetenekOlusturKomutuSemasi.safeParse(govde), false)).toEqual(
        ozet(eskiYaz.safeParse(govde), true),
      );
    },
  );

  it.each([
    ...ICERIKLER,
    [
      'bağlantı alanı (fazla alan) ve çelişik sınır',
      { ...BAGLANTI, ...ICERIK, sart: [OGE] },
    ],
    ['null', null],
  ] as [string, unknown][])(
    'yenile gövdesi (%s): sonuç eski şemanınkiyle aynı',
    (_ad, govde) => {
      expect(ozet(yetenekYenileGovdesiSemasi.safeParse(govde), false)).toEqual(
        ozet(eskiYenile.safeParse(govde), true),
      );
    },
  );

  it('sorunların yolu, kodu ve iletisi bugünküyle aynı', () => {
    expect(
      ozet(
        yetenekOlusturKomutuSemasi.safeParse({
          ...BAGLANTI,
          grupId: 'x',
          ...ICERIK,
          sart: [],
          kolonlar: ['ad'],
        }),
        false,
      ),
    ).toEqual({
      sorunlar: [
        { path: ['grupId'], code: 'invalid_format', message: 'Invalid UUID' },
        {
          path: ['sart'],
          code: 'too_small',
          message: 'Too small: expected array to have >=1 items',
        },
        {
          path: ['sart'],
          code: 'custom',
          message: 'bütün kayıtlar işareti şartla birlikte yazılamaz',
        },
        {
          path: ['kolonlar'],
          code: 'custom',
          message: 'bütün kolonlar işareti kolon listesiyle birlikte yazılamaz',
        },
      ],
    });
  });

  it('boş şart değerinin sorunu şart öğesinin değer yolundadır', () => {
    expect(
      ozet(
        yetenekYenileGovdesiSemasi.safeParse({
          ...ICERIK,
          butunKayitlar: false,
          sart: [OGE, { ...OGE, deger: [] }],
        }),
        false,
      ),
    ).toEqual({
      sorunlar: [
        {
          path: ['sart', 1, 'deger'],
          code: 'too_small',
          message: 'Too small: expected array to have >=1 items',
        },
      ],
    });
  });

  it('geçerli gövdede içerik alanları değer nesnesi olarak `icerik` altında durur', () => {
    expect(
      yetenekOlusturKomutuSemasi.parse({ ...BAGLANTI, ...ICERIK }),
    ).toEqual({ ...BAGLANTI, icerik: ICERIK });
  });
});
