// Grup adı değer nesnesinin birim testi: kırpma ve 1-100 karakter sınırı.
import { grupAdi } from './grup-adi.js';

describe('grup adı', () => {
  it.each([
    ['Muhasebe', 'Muhasebe'],
    ['  Muhasebe  ', 'Muhasebe'],
    ['a', 'a'],
    ['x'.repeat(100), 'x'.repeat(100)],
    [` ${'x'.repeat(100)} `, 'x'.repeat(100)],
  ])('%j kabul edilir ve %j olur', (ham, beklenen) => {
    expect(grupAdi(ham)).toEqual({ tur: 'tamam', deger: beklenen });
  });

  it.each([
    ['', 'kisa'],
    ['   ', 'kisa'],
    ['x'.repeat(101), 'uzun'],
  ])('%j reddedilir', (ham, neden) => {
    expect(grupAdi(ham)).toEqual({ tur: 'ret', neden });
  });
});
