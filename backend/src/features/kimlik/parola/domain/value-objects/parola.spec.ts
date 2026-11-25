// Parola değer nesnesinin birim testi: 15-128 kod noktası sınırı, kod noktasıyla sayma ve başka kural
// olmaması.
import { parola } from './parola.js';

// İki kod biriminden (UTF-16 vekil çifti) oluşan tek kod noktası.
const IKI_BIRIMLI = '😀';

describe('parola kuralı', () => {
  it.each([
    [
      '14 kod noktası reddedilir',
      'a'.repeat(14),
      { tur: 'ret', neden: 'kisa' },
    ],
    [
      '15 kod noktası kabul edilir',
      'a'.repeat(15),
      { tur: 'tamam', deger: 'a'.repeat(15) },
    ],
    [
      '128 kod noktası kabul edilir',
      'a'.repeat(128),
      { tur: 'tamam', deger: 'a'.repeat(128) },
    ],
    [
      '129 kod noktası reddedilir',
      'a'.repeat(129),
      { tur: 'ret', neden: 'uzun' },
    ],
  ])('%s', (_ad, ham, beklenen) => {
    expect(parola(ham)).toEqual(beklenen);
  });

  it('birden çok kod biriminden oluşan karakter tek sayılır', () => {
    expect(IKI_BIRIMLI).toHaveLength(2);

    // 14 karakter = 28 kod birimi: kod birimi sayılsaydı kabul edilirdi.
    expect(parola(IKI_BIRIMLI.repeat(14)).tur).toBe('ret');
    expect(parola(IKI_BIRIMLI.repeat(15)).tur).toBe('tamam');
    // 128 karakter = 256 kod birimi: kod birimi sayılsaydı reddedilirdi.
    expect(parola(IKI_BIRIMLI.repeat(128)).tur).toBe('tamam');
    expect(parola(IKI_BIRIMLI.repeat(129)).tur).toBe('ret');
  });

  it('başka kural yoktur: yalnız küçük harf ve boşluk kabul edilir', () => {
    expect(parola('bir iki uc dort bes').tur).toBe('tamam');
  });

  it('parola kırpılmaz', () => {
    expect(parola(`  ${'a'.repeat(13)}`)).toEqual({
      tur: 'tamam',
      deger: `  ${'a'.repeat(13)}`,
    });
  });
});
