import { accessibleBy } from '@casl/prisma/runtime';
import type {
  SartOgesi,
  YetenekSatiri,
} from '../kimlik/yetki-verisi.contract.js';
import type { AlanTipi } from './alan-tipleri.js';
import type { KaynakKatalogu } from './kaynak-katalogu.js';
import { yetenekleriDerle } from './yetenek-derleyici.js';

const TALEP_TIPLERI: Record<string, AlanTipi> = {
  id: 'kimlik',
  durum: 'metin',
  tutar: 'sayi',
  sahibiId: 'kimlik',
  grupId: 'kimlik',
  acil: 'mantiksal',
  sonTarih: 'zaman',
  ekler: 'obur',
};

const KATALOG: KaynakKatalogu = {
  alanlar: (tur) => (tur === 'Talep' ? Object.keys(TALEP_TIPLERI) : undefined),
  alanTipleri: (tur) => (tur === 'Talep' ? TALEP_TIPLERI : undefined),
};

const KIMLIK = '60000000-0000-4000-8000-000000000001';

const ISTEYEN = 'kisi-1';

function satir(degisen: Partial<YetenekSatiri>): YetenekSatiri {
  return {
    yetenekId: 'y1',
    grupId: 'g1',
    rolId: 'r1',
    kaynak: 'Talep',
    eylem: 'oku',
    sart: [],
    butunKayitlar: false,
    butunBirimler: false,
    kolonlar: [],
    butunKolonlar: true,
    ...degisen,
  };
}

function derle(
  yetenekler: YetenekSatiri[],
  altGruplar: Record<string, string[]> = {},
) {
  return yetenekleriDerle({ yetenekler, altGruplar }, ISTEYEN, KATALOG);
}

describe('yetenek derleyici', () => {
  describe('kayıt sınırı', () => {
    it('bütün kayıtlar işaretli satır koşulsuz kural üretir', () => {
      const sonuc = derle([satir({ butunKayitlar: true })]);

      expect(sonuc.kurallar).toEqual([
        { yetenekId: 'y1', action: 'oku', subject: 'Talep' },
      ]);
      // Koşulsuz kural sorguya süzgeç eklemez.
      expect(accessibleBy(sonuc.yetenek, 'oku').ofType('Talep')).toEqual({});
    });

    it('işareti de şartı da olmayan satır kural üretmez ve bildirilmez', () => {
      const sonuc = derle([satir({})]);

      expect(sonuc.kurallar).toEqual([]);
      expect(sonuc.derlenmeyenler).toEqual([]);
      expect(accessibleBy(sonuc.yetenek, 'oku').ofType('Talep')).toEqual({
        OR: [],
      });
    });

    it('işaret ile şart birlikte gelen satır derlenmez ve bildirilir', () => {
      const sonuc = derle([
        satir({
          butunKayitlar: true,
          sart: [{ alan: 'durum', islec: 'esit', deger: 'acik' }],
        }),
      ]);

      expect(sonuc.kurallar).toEqual([]);
      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'y1', neden: 'bütün kayıtlar işareti şartla birlikte' },
      ]);
    });

    it('bütün kolonlar işareti kolon listesiyle birlikte gelen satır derlenmez ve bildirilir', () => {
      const sonuc = derle([
        satir({
          butunKayitlar: true,
          butunKolonlar: true,
          kolonlar: ['durum'],
        }),
      ]);

      expect(sonuc.kurallar).toEqual([]);
      expect(sonuc.derlenmeyenler).toEqual([
        {
          yetenekId: 'y1',
          neden: 'bütün kolonlar işareti kolon listesiyle birlikte',
        },
      ]);
    });

    it('şartlı satırın kuralı çevrilmiş koşulu taşır', () => {
      const sonuc = derle([
        satir({
          sart: [
            { alan: 'durum', islec: 'esit', deger: 'acik' },
            { alan: 'tutar', islec: 'kucuk', deger: 100 },
          ],
        }),
      ]);

      expect(sonuc.kurallar[0]?.conditions).toEqual({
        AND: [{ durum: { equals: 'acik' } }, { tutar: { lt: 100 } }],
      });
    });
  });

  describe('kolon sınırı', () => {
    it('kolonları sayan satırın kuralı yalnız o kolonları taşır', () => {
      const sonuc = derle([
        satir({
          butunKayitlar: true,
          butunKolonlar: false,
          kolonlar: ['id', 'durum'],
        }),
      ]);

      expect(sonuc.kurallar[0]?.fields).toEqual(['id', 'durum']);
    });

    it('bütün kolonlar işaretli satırın kuralı kolon sınırı taşımaz', () => {
      const sonuc = derle([satir({ butunKayitlar: true })]);

      expect(sonuc.kurallar[0]).not.toHaveProperty('fields');
    });

    it('bilinmeyen kolon adı atlanır, kalanlarla kural üretilir', () => {
      const sonuc = derle([
        satir({
          butunKayitlar: true,
          butunKolonlar: false,
          kolonlar: ['durum', 'yok'],
        }),
      ]);

      expect(sonuc.kurallar[0]?.fields).toEqual(['durum']);
    });

    it('atılınca dizisi boşalan satır kural üretmez', () => {
      const sonuc = derle([
        satir({ butunKayitlar: true, butunKolonlar: false, kolonlar: ['yok'] }),
      ]);

      expect(sonuc.kurallar).toEqual([]);
      expect(accessibleBy(sonuc.yetenek, 'oku').ofType('Talep')).toEqual({
        OR: [],
      });
    });

    it('kolonu da bütün kolonlar işareti de olmayan satır kural üretmez', () => {
      const sonuc = derle([
        satir({ butunKayitlar: true, butunKolonlar: false }),
      ]);

      expect(sonuc.kurallar).toEqual([]);
    });
  });

  describe('şemayla uyum', () => {
    it('şartında bilinmeyen alan olan satır derlenmez ve kimliğiyle bildirilir', () => {
      const sonuc = derle([
        satir({
          yetenekId: 'bozuk',
          sart: [{ alan: 'yok', islec: 'esit', deger: 'x' }],
        }),
        satir({ yetenekId: 'saglam', butunKayitlar: true }),
      ]);

      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'bozuk', neden: 'bilinmeyen alan: yok' },
      ]);
      expect(sonuc.kurallar.map((k) => k.yetenekId)).toEqual(['saglam']);
    });

    it('kolonlarının hepsi bilinmeyen satırda da şarttaki bilinmeyen alan kimliğiyle bildirilir ve kural üretmez', () => {
      const sonuc = derle([
        satir({
          yetenekId: 'bozuk',
          sart: [{ alan: 'yok', islec: 'esit', deger: 'x' }],
          butunKolonlar: false,
          kolonlar: ['olmayan'],
        }),
      ]);

      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'bozuk', neden: 'bilinmeyen alan: yok' },
      ]);
      expect(sonuc.kurallar).toEqual([]);
      expect(accessibleBy(sonuc.yetenek, 'oku').ofType('Talep')).toEqual({
        OR: [],
      });
    });

    it('bilinmeyen kaynağın satırı derlenmez ve bildirilir', () => {
      const sonuc = derle([satir({ kaynak: 'Yok', butunKayitlar: true })]);

      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'y1', neden: 'bilinmeyen kaynak: Yok' },
      ]);
    });
  });

  // TS-002 AK-44: her girdide bozuk satırın yanında sağlam bir satır vardır; bozuk satır derlenmez ve
  // nedeniyle bildirilir, sağlam satır derlenir.
  describe('şart değerinin ve işlecin kolon tipine uyumu', () => {
    function bozukVeSaglam(bozuk: SartOgesi) {
      return derle([
        satir({ yetenekId: 'bozuk', sart: [bozuk] }),
        satir({
          yetenekId: 'saglam',
          sart: [{ alan: 'durum', islec: 'esit', deger: 'acik' }],
        }),
      ]);
    }

    it.each<[AlanTipi, SartOgesi]>([
      ['metin', { alan: 'durum', islec: 'esit', deger: 'acik' }],
      ['sayi', { alan: 'tutar', islec: 'buyuk', deger: 100 }],
      ['mantiksal', { alan: 'acil', islec: 'esit', deger: true }],
      ['kimlik', { alan: 'sahibiId', islec: 'esit', deger: KIMLIK }],
      [
        'zaman',
        { alan: 'sonTarih', islec: 'kucuk', deger: '2026-11-25T10:00:00+03:00' },
      ],
    ])('%s alanında uyan değer derlenir', (_tip, oge) => {
      const sonuc = derle([satir({ sart: [oge] })]);

      expect(sonuc.derlenmeyenler).toEqual([]);
      expect(sonuc.kurallar).toHaveLength(1);
    });

    it.each<[string, SartOgesi]>([
      ['metin alanında sayı', { alan: 'durum', islec: 'esit', deger: 5 }],
      ['sayı alanında metin', { alan: 'tutar', islec: 'esit', deger: '100' }],
      ['sayı alanında ondalık', { alan: 'tutar', islec: 'esit', deger: 1.5 }],
      [
        'sayı alanında integer aralığının dışı',
        { alan: 'tutar', islec: 'buyuk', deger: 1e300 },
      ],
      [
        'mantıksal alanında metin',
        { alan: 'acil', islec: 'esit', deger: 'evet' },
      ],
      [
        'kimlik alanında kimlik biçiminde olmayan metin',
        { alan: 'sahibiId', islec: 'esit', deger: 'kisi-1' },
      ],
      ['kimlik alanında sayı', { alan: 'sahibiId', islec: 'esit', deger: 7 }],
      [
        'zaman alanında takvimde olmayan gün',
        { alan: 'sonTarih', islec: 'esit', deger: '2026-02-30T00:00:00Z' },
      ],
      [
        'zaman alanında saat dilimi olmayan yazım',
        { alan: 'sonTarih', islec: 'buyuk', deger: '2026-11-25T10:00:00' },
      ],
      [
        'zaman alanında yalnız tarih',
        { alan: 'sonTarih', islec: 'buyuk', deger: '2026-11-25' },
      ],
      [
        'zaman alanında 0000 yılı',
        { alan: 'sonTarih', islec: 'buyuk', deger: '0000-06-01T00:00:00Z' },
      ],
    ])('%s derlenmez ve bildirilir', (_ad, oge) => {
      const sonuc = bozukVeSaglam(oge);

      expect(sonuc.derlenmeyenler).toEqual([
        {
          yetenekId: 'bozuk',
          neden: `değer alanın tipine uymuyor: ${oge.alan}`,
        },
      ]);
      expect(sonuc.kurallar.map((k) => k.yetenekId)).toEqual(['saglam']);
    });

    it('listeli işleçte her öğe sınanır: uymayan tek öğe satırı derlenmez kılar', () => {
      const sonuc = bozukVeSaglam({
        alan: 'sahibiId',
        islec: 'listede',
        deger: [KIMLIK, 'kisi-1'],
      });

      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'bozuk', neden: 'değer alanın tipine uymuyor: sahibiId' },
      ]);
      expect(sonuc.kurallar.map((k) => k.yetenekId)).toEqual(['saglam']);
    });

    it('listeli işleçte öğelerin hepsi uyarsa satır derlenir', () => {
      const sonuc = derle([
        satir({
          sart: [
            { alan: 'tutar', islec: 'listede_degil', deger: [1, 2] },
            { alan: 'sahibiId', islec: 'listede', deger: [KIMLIK] },
          ],
        }),
      ]);

      expect(sonuc.derlenmeyenler).toEqual([]);
      expect(sonuc.kurallar[0]?.conditions).toEqual({
        AND: [{ tutar: { notIn: [1, 2] } }, { sahibiId: { in: [KIMLIK] } }],
      });
    });

    it('boş liste derlenmez ve bildirilir', () => {
      const sonuc = bozukVeSaglam({
        alan: 'durum',
        islec: 'listede',
        deger: [],
      });

      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'bozuk', neden: 'boş liste: durum' },
      ]);
      expect(sonuc.kurallar.map((k) => k.yetenekId)).toEqual(['saglam']);
    });

    it("'öbür' tipindeki alan şartta kullanılamaz", () => {
      const sonuc = bozukVeSaglam({ alan: 'ekler', islec: 'esit', deger: 'x' });

      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'bozuk', neden: 'şartta kullanılamayan alan: ekler' },
      ]);
      expect(sonuc.kurallar.map((k) => k.yetenekId)).toEqual(['saglam']);
    });

    it.each<[string, SartOgesi]>([
      ['metin alanında büyük', { alan: 'durum', islec: 'buyuk', deger: 'a' }],
      [
        'kimlik alanında küçük',
        { alan: 'sahibiId', islec: 'kucuk', deger: KIMLIK },
      ],
      [
        'mantıksal alanında listede',
        { alan: 'acil', islec: 'listede', deger: [true] },
      ],
      [
        'mantıksal alanında büyük ya da eşit',
        { alan: 'acil', islec: 'buyuk_esit', deger: true },
      ],
    ])('tipe uymayan işleç (%s) derlenmez ve bildirilir', (_ad, oge) => {
      const sonuc = bozukVeSaglam(oge);

      expect(sonuc.derlenmeyenler).toEqual([
        {
          yetenekId: 'bozuk',
          neden: `işleç alanın tipine uymuyor: ${oge.alan}`,
        },
      ]);
      expect(sonuc.kurallar.map((k) => k.yetenekId)).toEqual(['saglam']);
    });

    it('yer tutucu yalnız kimlik alanında yazılır', () => {
      const sonuc = bozukVeSaglam({
        alan: 'durum',
        islec: 'esit',
        deger: { yerTutucu: 'isteyen' },
      });

      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'bozuk', neden: 'yer tutucu alanın tipine uymuyor: durum' },
      ]);
      expect(sonuc.kurallar.map((k) => k.yetenekId)).toEqual(['saglam']);
    });
  });

  describe('yer tutucular', () => {
    it('üç yer tutucu verilen değerlere çözülür', () => {
      const sonuc = derle(
        [
          satir({
            sart: [
              {
                alan: 'sahibiId',
                islec: 'esit',
                deger: { yerTutucu: 'isteyen' },
              },
              {
                alan: 'grupId',
                islec: 'esit',
                deger: { yerTutucu: 'yetenek_grubu' },
              },
              {
                alan: 'grupId',
                islec: 'listede',
                deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
              },
            ],
          }),
        ],
        { g1: ['g1', 'g2', 'g3'] },
      );

      expect(sonuc.derlenmeyenler).toEqual([]);
      expect(sonuc.kurallar[0]?.conditions).toEqual({
        AND: [
          { sahibiId: { equals: ISTEYEN } },
          { grupId: { equals: 'g1' } },
          { grupId: { in: ['g1', 'g2', 'g3'] } },
        ],
      });
    });

    it('çözülemeyen yer tutucu satırı derlenmez kılar', () => {
      const sonuc = derle([
        satir({
          sart: [
            {
              alan: 'grupId',
              islec: 'listede',
              deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
            },
          ],
        }),
      ]);

      expect(sonuc.kurallar).toEqual([]);
      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'y1', neden: 'yer tutucu çözülemedi: grupId' },
      ]);
    });

    it('boş listeye çözülen yer tutucu satırı derlenmez kılar', () => {
      const sonuc = derle(
        [
          satir({
            sart: [
              {
                alan: 'grupId',
                islec: 'listede',
                deger: { yerTutucu: 'yetenek_grubu_ve_alti' },
              },
            ],
          }),
        ],
        { g1: [] },
      );

      expect(sonuc.kurallar).toEqual([]);
      expect(sonuc.derlenmeyenler).toEqual([
        { yetenekId: 'y1', neden: 'yer tutucu çözülemedi: grupId' },
      ]);
    });
  });

  // Sözleşme: alt grup listesi grubun kendisini içerir. Derleyici listeyi olduğu gibi kullanır.
  describe('alt grup listesi', () => {
    const grupVeAltiSarti = [
      {
        alan: 'grupId',
        islec: 'listede' as const,
        deger: { yerTutucu: 'yetenek_grubu_ve_alti' as const },
      },
    ];

    it('grubun kendisini içeren liste kapsamı grubun kendisi ve altındakiler yapar', () => {
      const sonuc = derle([satir({ sart: grupVeAltiSarti })], {
        g1: ['g1', 'g2'],
      });

      expect(sonuc.derlenmeyenler).toEqual([]);
      expect(sonuc.kurallar[0]?.conditions).toEqual({
        AND: [{ grupId: { in: ['g1', 'g2'] } }],
      });
    });

    it('grubun kendisini içermeyen liste de derlenir; derleyici grubu eklemez, kapsam yalnız listedekilerdir', () => {
      const sonuc = derle([satir({ sart: grupVeAltiSarti })], { g1: ['g2'] });

      expect(sonuc.derlenmeyenler).toEqual([]);
      expect(sonuc.kurallar[0]?.conditions).toEqual({
        AND: [{ grupId: { in: ['g2'] } }],
      });
    });
  });

  describe('birleştirmeme', () => {
    const sonuc = derle([
      satir({
        yetenekId: 'y1',
        sart: [{ alan: 'durum', islec: 'esit', deger: 'acik' }],
      }),
      satir({
        yetenekId: 'y2',
        sart: [
          { alan: 'sahibiId', islec: 'esit', deger: { yerTutucu: 'isteyen' } },
        ],
      }),
    ]);
    const kosul1 = { AND: [{ durum: { equals: 'acik' } }] };
    const kosul2 = { AND: [{ sahibiId: { equals: ISTEYEN } }] };

    it('aynı tür ve eylem için iki satır kimliklerini taşıyan iki ayrı kural kalır', () => {
      expect(sonuc.kurallar).toEqual([
        {
          yetenekId: 'y1',
          action: 'oku',
          subject: 'Talep',
          conditions: kosul1,
        },
        {
          yetenekId: 'y2',
          action: 'oku',
          subject: 'Talep',
          conditions: kosul2,
        },
      ]);
      expect(sonuc.yetenek.rules).toEqual(sonuc.kurallar);
    });

    it('birleşik nesnenin koşulu ikisini veya ile taşır', () => {
      const kosul = accessibleBy(sonuc.yetenek, 'oku').ofType('Talep');

      expect(kosul).toEqual({
        OR: expect.arrayContaining([kosul1, kosul2]) as unknown,
      });
      expect((kosul as { OR: unknown[] }).OR).toHaveLength(2);
    });
  });

  it('hiç kuralı olmayan tür için koşulun OR anahtarı boş dizidir', () => {
    const sonuc = derle([satir({ butunKayitlar: true })]);

    expect(accessibleBy(sonuc.yetenek, 'oku').ofType('Baska')).toEqual({
      OR: [],
    });
    expect(accessibleBy(sonuc.yetenek, 'sil').ofType('Talep')).toEqual({
      OR: [],
    });
  });
});
