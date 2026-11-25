// Görünen ad değer nesnesinin birim testi: kırpma ve 1-200 karakter sınırı.
import { gorunenAd } from './gorunen-ad.js';

describe('görünen ad', () => {
  it.each([
    ['Ayşe Yılmaz', 'Ayşe Yılmaz'],
    ['  Ayşe Yılmaz  ', 'Ayşe Yılmaz'],
    ['a', 'a'],
    ['x'.repeat(200), 'x'.repeat(200)],
    [` ${'x'.repeat(200)} `, 'x'.repeat(200)],
  ])('%j kabul edilir ve %j olur', (ham, beklenen) => {
    expect(gorunenAd(ham)).toEqual({ tur: 'tamam', deger: beklenen });
  });

  it.each([
    ['', 'kisa'],
    ['   ', 'kisa'],
    ['x'.repeat(201), 'uzun'],
  ])('%j reddedilir', (ham, neden) => {
    expect(gorunenAd(ham)).toEqual({ tur: 'ret', neden });
  });
});
