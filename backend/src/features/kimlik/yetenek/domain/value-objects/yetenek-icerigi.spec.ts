// Yetenek içeriği değer nesnesinin birim testi: işaret ile içerik birlikte yazılamaz, iki ret birlikte
// ve sırayla döner; geçerli içerik yalnız içerik alanlarını taşır.
import type { SartOgesi } from '../../../../../shared/kimlik/yetki-verisi.contract.js';
import { type IcerikListesi, icerikListesi } from './icerik-listesi.js';
import {
  type YetenekIcerigiAlanlari,
  yetenekIcerigi,
} from './yetenek-icerigi.js';

function liste<T>(ham: readonly T[]): IcerikListesi<T> {
  const sonuc = icerikListesi(ham);
  if (sonuc.tur === 'ret') {
    throw new Error(sonuc.neden);
  }
  return sonuc.deger;
}

const SART = liste<SartOgesi>([{ alan: 'ad', islec: 'esit', deger: 'x' }]);
const KOLONLAR = liste(['ad']);

const BOS: YetenekIcerigiAlanlari = {
  sart: null,
  butunKayitlar: false,
  butunBirimler: false,
  kolonlar: null,
  butunKolonlar: false,
};

describe('yetenek içeriği', () => {
  it.each<[string, Partial<YetenekIcerigiAlanlari>]>([
    ['ikisi de yok', {}],
    [
      'işaretler',
      { butunKayitlar: true, butunBirimler: true, butunKolonlar: true },
    ],
    ['içerikler', { sart: SART, kolonlar: KOLONLAR }],
    [
      'kayıtta işaret, kolonda içerik',
      { butunKayitlar: true, kolonlar: KOLONLAR },
    ],
  ])('%s kabul edilir ve aynen kalır', (_ad, ek) => {
    const ham = { ...BOS, ...ek };
    expect(yetenekIcerigi(ham)).toEqual({ tur: 'tamam', deger: ham });
  });

  it('içerik alanları dışındaki alanı taşımaz', () => {
    const sonuc = yetenekIcerigi({
      ...BOS,
      grupId: 'g',
    } as YetenekIcerigiAlanlari);
    expect(sonuc).toEqual({ tur: 'tamam', deger: BOS });
  });

  it.each<[Partial<YetenekIcerigiAlanlari>, string[]]>([
    [{ butunKayitlar: true, sart: SART }, ['butun_kayitlar_ve_sart']],
    [
      { butunKolonlar: true, kolonlar: KOLONLAR },
      ['butun_kolonlar_ve_kolonlar'],
    ],
    [
      {
        butunKayitlar: true,
        sart: SART,
        butunKolonlar: true,
        kolonlar: KOLONLAR,
      },
      ['butun_kayitlar_ve_sart', 'butun_kolonlar_ve_kolonlar'],
    ],
  ])('%j reddedilir: %j', (ek, retler) => {
    expect(yetenekIcerigi({ ...BOS, ...ek })).toEqual({
      tur: 'ret',
      neden: retler,
    });
  });
});
