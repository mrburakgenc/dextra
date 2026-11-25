// Kullanıcı adı değer nesnesinin birim testi: küçük harfe çevirme ve desen (3-64 karakter; küçük harf,
// rakam, nokta, tire, alt çizgi).
import { kullaniciAdi } from './kullanici-adi.js';

describe('kullanıcı adı', () => {
  it.each([
    ['ayse', 'ayse'],
    ['Ayse.Yilmaz', 'ayse.yilmaz'],
    ['a_b-c.9', 'a_b-c.9'],
    ['abc', 'abc'],
    ['x'.repeat(64), 'x'.repeat(64)],
  ])('%j kabul edilir ve %j olur', (ham, beklenen) => {
    expect(kullaniciAdi(ham)).toEqual({ tur: 'tamam', deger: beklenen });
  });

  it.each([
    [''],
    ['ab'],
    ['x'.repeat(65)],
    ['ayşe'],
    ['ayse yilmaz'],
    [' ayse'],
    ['ayse@ornek'],
  ])('%j reddedilir', (ham) => {
    expect(kullaniciAdi(ham)).toEqual({ tur: 'ret', neden: 'desene_uymuyor' });
  });
});
