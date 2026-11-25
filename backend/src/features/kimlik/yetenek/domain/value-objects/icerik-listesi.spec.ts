// İçerik listesi değer nesnesinin birim testi: boş liste reddedilir, dolu liste olduğu gibi kalır.
import { icerikListesi } from './icerik-listesi.js';

describe('içerik listesi', () => {
  it.each<[readonly unknown[]]>([[['a']], [[1, 2]], [[{ alan: 'ad' }]]])(
    '%j kabul edilir ve aynen kalır',
    (liste) => {
      expect(icerikListesi(liste)).toEqual({ tur: 'tamam', deger: liste });
    },
  );

  it('boş liste reddedilir', () => {
    expect(icerikListesi([])).toEqual({ tur: 'ret', neden: 'bos' });
  });
});
