import type { Islec } from '../../kimlik/domain/i-yetki-verisi.contract.js';
import type { AlanTipi } from '../domain/alan-tipi.js';
import {
  type CozulmusSartOgesi,
  kosuluCevir,
  sartiCevir,
} from './sart-cevirici.js';

const ALANLAR = ['durum', 'tutar', 'sahibiId'];

const TIPLER: Record<string, AlanTipi> = {
  durum: 'metin',
  tutar: 'sayi',
  acil: 'mantiksal',
  sahibiId: 'kimlik',
  sonTarih: 'zaman',
  ekler: 'obur',
};

const KIMLIK = '60000000-0000-4000-8000-000000000001';

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

// TS-002 AK-44: çağıranın koşulundaki değer de alanın tipine karşı sınanır; uymayan değer "uyumsuz"
// olarak döner (okuma kapısı onu doğrulama hatasına çevirir), işleç ve alan hatası "neden" olarak.
describe('çağıranın koşulunda tip uyumu', () => {
  it.each<[AlanTipi, CozulmusSartOgesi]>([
    ['metin', { alan: 'durum', islec: 'esit', deger: 'acik' }],
    ['sayi', { alan: 'tutar', islec: 'kucuk_esit', deger: -2147483648 }],
    ['mantiksal', { alan: 'acil', islec: 'esit_degil', deger: false }],
    ['kimlik', { alan: 'sahibiId', islec: 'listede', deger: [KIMLIK] }],
    [
      'zaman',
      { alan: 'sonTarih', islec: 'buyuk_esit', deger: '2026-11-25T07:00:00Z' },
    ],
  ])('%s alanında uyan değer çevrilir', (_tip, oge) => {
    expect(kosuluCevir([oge], TIPLER)).toHaveProperty('kosul');
  });

  it.each<[string, CozulmusSartOgesi]>([
    ['metin alanında mantıksal', { alan: 'durum', islec: 'esit', deger: true }],
    ['sayı alanında metin', { alan: 'tutar', islec: 'esit', deger: '10' }],
    ['sayı alanında ondalık', { alan: 'tutar', islec: 'esit', deger: 1.5 }],
    [
      'sayı alanında integer aralığının dışı',
      { alan: 'tutar', islec: 'buyuk', deger: 2147483648 },
    ],
    ['mantıksal alanında sayı', { alan: 'acil', islec: 'esit', deger: 1 }],
    [
      'kimlik alanında kimlik biçiminde olmayan metin',
      { alan: 'sahibiId', islec: 'esit', deger: 'yok' },
    ],
    [
      'zaman alanında zaman olmayan metin',
      { alan: 'sonTarih', islec: 'buyuk', deger: 'dün' },
    ],
    [
      "zaman alanında UTC'de 0 yılına düşen yazım",
      { alan: 'sonTarih', islec: 'buyuk', deger: '0001-01-01T00:00:00+03:00' },
    ],
    [
      'listeli işleçte uymayan tek öğe',
      { alan: 'sahibiId', islec: 'listede_degil', deger: [KIMLIK, 'yok'] },
    ],
  ])('%s "uyumsuz" olarak döner', (_ad, oge) => {
    expect(kosuluCevir([oge], TIPLER)).toEqual({
      uyumsuz: `değer alanın tipine uymuyor: ${oge.alan}`,
    });
  });

  it('tekil işleçte liste, listeli işleçte tekil değer "uyumsuz" olarak döner', () => {
    expect(
      kosuluCevir([{ alan: 'sahibiId', islec: 'esit', deger: [KIMLIK] }], TIPLER),
    ).toEqual({ uyumsuz: 'değerin biçimi işlece uymuyor: sahibiId' });
    expect(
      kosuluCevir([{ alan: 'durum', islec: 'listede', deger: 'acik' }], TIPLER),
    ).toEqual({ uyumsuz: 'değerin biçimi işlece uymuyor: durum' });
  });

  it('zaman alanında 0001 yılı (UTC) çevrilir', () => {
    expect(
      kosuluCevir(
        [{ alan: 'sonTarih', islec: 'buyuk', deger: '0001-01-01T00:00:00Z' }],
        TIPLER,
      ),
    ).toHaveProperty('kosul');
  });

  it('tipe uymayan işleç ve öbür tipindeki alan kodun hatasıdır: "neden" olarak döner', () => {
    expect(
      kosuluCevir([{ alan: 'durum', islec: 'buyuk', deger: 'a' }], TIPLER),
    ).toEqual({ neden: 'işleç alanın tipine uymuyor: durum' });
    expect(
      kosuluCevir([{ alan: 'ekler', islec: 'esit', deger: 'x' }], TIPLER),
    ).toEqual({ neden: 'şartta kullanılamayan alan: ekler' });
  });

  it('boş liste çağıranın koşulunda reddedilmez; hiçbir kayda uymayan koşula çevrilir', () => {
    expect(
      kosuluCevir([{ alan: 'sahibiId', islec: 'listede', deger: [] }], TIPLER),
    ).toEqual({ kosul: { AND: [{ AND: [{ sahibiId: { in: [] } }] }] } });
  });

  it('değersiz işleç tip sınamasına girmez', () => {
    expect(
      kosuluCevir(
        [
          { alan: 'sonTarih', islec: 'bos' },
          { alan: 'durum', islec: 'esit', deger: 'acik' },
        ],
        TIPLER,
      ),
    ).toEqual({
      kosul: {
        AND: [
          { sonTarih: { equals: null } },
          { AND: [{ durum: { equals: 'acik' } }] },
        ],
      },
    });
  });
});
