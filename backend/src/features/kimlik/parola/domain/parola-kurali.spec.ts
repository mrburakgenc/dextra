import { parolaSemasi } from './parola-kurali.js';

// İki kod biriminden (UTF-16 vekil çifti) oluşan tek kod noktası.
const IKI_BIRIMLI = '😀';

describe('parola kuralı', () => {
  it.each([
    ['14 kod noktası reddedilir', 'a'.repeat(14), false],
    ['15 kod noktası kabul edilir', 'a'.repeat(15), true],
    ['128 kod noktası kabul edilir', 'a'.repeat(128), true],
    ['129 kod noktası reddedilir', 'a'.repeat(129), false],
  ])('%s', (_ad, parola, gecer) => {
    expect(parolaSemasi.safeParse(parola).success).toBe(gecer);
  });

  it('birden çok kod biriminden oluşan karakter tek sayılır', () => {
    expect(IKI_BIRIMLI).toHaveLength(2);

    // 14 karakter = 28 kod birimi: kod birimi sayılsaydı kabul edilirdi.
    expect(parolaSemasi.safeParse(IKI_BIRIMLI.repeat(14)).success).toBe(false);
    expect(parolaSemasi.safeParse(IKI_BIRIMLI.repeat(15)).success).toBe(true);
    // 128 karakter = 256 kod birimi: kod birimi sayılsaydı reddedilirdi.
    expect(parolaSemasi.safeParse(IKI_BIRIMLI.repeat(128)).success).toBe(true);
    expect(parolaSemasi.safeParse(IKI_BIRIMLI.repeat(129)).success).toBe(false);
  });

  it('başka kural yoktur: yalnız küçük harf ve boşluk kabul edilir', () => {
    expect(parolaSemasi.safeParse('bir iki uc dort bes').success).toBe(true);
  });
});
