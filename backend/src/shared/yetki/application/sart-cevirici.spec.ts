import type { Islec } from '../../kimlik/domain/i-yetki-verisi.contract.js';
import { kesinTutmuyorKosulu, sartiCevir } from './sart-cevirici.js';

const ALANLAR = ['durum', 'tutar', 'sahibiId'];

describe('şart çevirici', () => {
  it.each<[Islec, string | number | string[], Record<string, unknown>]>([
    ['esit', 'acik', { durum: { equals: 'acik' } }],
    ['esit_degil', 'acik', { durum: { not: 'acik' } }],
    ['listede', ['acik', 'bekliyor'], { durum: { in: ['acik', 'bekliyor'] } }],
    ['listede_degil', ['kapali'], { durum: { notIn: ['kapali'] } }],
    ['kucuk', 10, { durum: { lt: 10 } }],
    ['kucuk_esit', 10, { durum: { lte: 10 } }],
    ['buyuk', 10, { durum: { gt: 10 } }],
    ['buyuk_esit', 10, { durum: { gte: 10 } }],
  ])(
    '%s tek şartlı satırı sorgu koşuluna çevirir',
    (islec, deger, beklenen) => {
      expect(sartiCevir([{ alan: 'durum', islec, deger }], ALANLAR)).toEqual({
        kosul: { AND: [beklenen] },
      });
    },
  );

  it('iki şart ve ile bağlanır', () => {
    expect(
      sartiCevir(
        [
          { alan: 'durum', islec: 'esit', deger: 'acik' },
          { alan: 'tutar', islec: 'buyuk', deger: 100 },
        ],
        ALANLAR,
      ),
    ).toEqual({
      kosul: {
        AND: [{ durum: { equals: 'acik' } }, { tutar: { gt: 100 } }],
      },
    });
  });

  it('bilinmeyen alan şartı çevrilmez kılar', () => {
    expect(
      sartiCevir([{ alan: 'yok', islec: 'esit', deger: 'x' }], ALANLAR),
    ).toEqual({ neden: 'bilinmeyen alan: yok' });
  });

  it('liste işleci liste olmayan değerle, tekil işleç listeyle çevrilmez', () => {
    expect(
      sartiCevir([{ alan: 'durum', islec: 'listede', deger: 'x' }], ALANLAR),
    ).toHaveProperty('neden');
    expect(
      sartiCevir([{ alan: 'durum', islec: 'esit', deger: ['x'] }], ALANLAR),
    ).toHaveProperty('neden');
  });
});

describe('kesin tutmuyor koşulu', () => {
  const BOS_OLABILIRLIK = { durum: true, tutar: false };

  it.each<[Islec, string | number | string[], Record<string, unknown>]>([
    ['esit', 'acik', { not: 'acik' }],
    ['esit_degil', 'acik', { equals: 'acik' }],
    ['listede', ['acik', 'bekliyor'], { notIn: ['acik', 'bekliyor'] }],
    ['listede_degil', ['kapali'], { in: ['kapali'] }],
    ['kucuk', 10, { gte: 10 }],
    ['kucuk_esit', 10, { gt: 10 }],
    ['buyuk', 10, { lte: 10 }],
    ['buyuk_esit', 10, { lt: 10 }],
  ])(
    '%s öğesinin tümleyeni yazılır; boş olabilen kolonda boşluk dalı eklenir',
    (islec, deger, tumleyen) => {
      expect(
        kesinTutmuyorKosulu([{ alan: 'durum', islec, deger }], BOS_OLABILIRLIK),
      ).toEqual({
        OR: [{ durum: tumleyen }, { durum: { equals: null } }],
      });
    },
  );

  it('boş olamayan kolonda boşluk dalı yazılmaz', () => {
    expect(
      kesinTutmuyorKosulu(
        [{ alan: 'tutar', islec: 'buyuk', deger: 100 }],
        BOS_OLABILIRLIK,
      ),
    ).toEqual({ OR: [{ tutar: { lte: 100 } }] });
  });

  it('katalogda boş olabilirliği yazılı olmayan kolonda boşluk dalı yazılmaz', () => {
    expect(
      kesinTutmuyorKosulu(
        [{ alan: 'sahibiId', islec: 'esit', deger: 'x' }],
        {},
      ),
    ).toEqual({ OR: [{ sahibiId: { not: 'x' } }] });
  });

  it('ve ile bağlı öğelerin tümleyenleri veya ile bağlanır', () => {
    expect(
      kesinTutmuyorKosulu(
        [
          { alan: 'durum', islec: 'esit', deger: 'acik' },
          { alan: 'tutar', islec: 'buyuk', deger: 100 },
        ],
        BOS_OLABILIRLIK,
      ),
    ).toEqual({
      OR: [
        { durum: { not: 'acik' } },
        { durum: { equals: null } },
        { tutar: { lte: 100 } },
      ],
    });
  });

  it('koşulsuz yasakta koşul boş kimlik listesidir (öğesiz veya değil)', () => {
    expect(kesinTutmuyorKosulu([], BOS_OLABILIRLIK)).toEqual({
      id: { in: [] },
    });
  });
});
