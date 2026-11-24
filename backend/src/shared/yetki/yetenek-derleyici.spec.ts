import { accessibleBy } from '@casl/prisma/runtime';
import type { YetenekSatiri } from '../kimlik/yetki-verisi.contract.js';
import type { KaynakKatalogu } from './kaynak-katalogu.js';
import { yetenekleriDerle } from './yetenek-derleyici.js';

const KATALOG: KaynakKatalogu = {
  alanlar: (tur) =>
    tur === 'Talep'
      ? ['id', 'durum', 'tutar', 'sahibiId', 'grupId']
      : undefined,
};

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
