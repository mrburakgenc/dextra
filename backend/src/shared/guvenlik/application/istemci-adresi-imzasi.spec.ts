import { randomBytes } from 'node:crypto';
import {
  ARACI_KATMAN_SIRRI_DEGISKENI,
  IMZA_PENCERESI_MS,
  ISTEMCI_BASLIKLARI,
  IstemciAdresiDogrulayici,
  istemciImzasiUret,
  type IstemciAlanlari,
} from './istemci-adresi-imzasi.js';

const SIR = randomBytes(32).toString('hex');
const dogrulayici = new IstemciAdresiDogrulayici({
  [ARACI_KATMAN_SIRRI_DEGISKENI]: SIR,
});

function alanlar(zaman = Date.now()): IstemciAlanlari {
  return { adres: '203.0.113.7', tarayici: 'Mozilla/5.0 (deneme)', zaman };
}

function basliklar(
  a: IstemciAlanlari,
  sir = SIR,
): Record<string, string | undefined> {
  return {
    [ISTEMCI_BASLIKLARI.adres]: a.adres,
    [ISTEMCI_BASLIKLARI.tarayici]: a.tarayici,
    [ISTEMCI_BASLIKLARI.zaman]: String(a.zaman),
    [ISTEMCI_BASLIKLARI.imza]: istemciImzasiUret(sir, a),
  };
}

describe('istemci adresi imzası', () => {
  it('üretilen imza doğrulanır ve alanlar geri okunur', () => {
    const a = alanlar();
    expect(dogrulayici.dogrula(basliklar(a))).toEqual({
      gecerli: true,
      istemci: a,
    });
  });

  it.each<[string, (eski: string) => string]>([
    [ISTEMCI_BASLIKLARI.adres, () => '203.0.113.8'],
    [ISTEMCI_BASLIKLARI.tarayici, () => 'Mozilla/5.0 (baska)'],
    [ISTEMCI_BASLIKLARI.zaman, (eski) => String(Number(eski) + 1)],
    // Son karakter değiştirilir; uzunluk aynı kalır.
    [
      ISTEMCI_BASLIKLARI.imza,
      (eski) => eski.slice(0, -1) + (eski.endsWith('0') ? '1' : '0'),
    ],
  ])('%s değişince reddedilir', (baslik, degistir) => {
    const b = basliklar(alanlar());
    b[baslik] = degistir(b[baslik] ?? '');
    expect(dogrulayici.dogrula(b)).toEqual({ gecerli: false, neden: 'imza' });
  });

  it('başka sırla üretilmiş imza reddedilir', () => {
    const baskaSir = randomBytes(32).toString('hex');
    expect(dogrulayici.dogrula(basliklar(alanlar(), baskaSir))).toEqual({
      gecerli: false,
      neden: 'imza',
    });
  });

  it('61 saniye eski zaman damgası reddedilir', () => {
    expect(
      dogrulayici.dogrula(basliklar(alanlar(Date.now() - 61_000))),
    ).toEqual({
      gecerli: false,
      neden: 'zaman',
    });
  });

  it('61 saniye ileri zaman damgası reddedilir', () => {
    expect(
      dogrulayici.dogrula(basliklar(alanlar(Date.now() + 61_000))),
    ).toEqual({
      gecerli: false,
      neden: 'zaman',
    });
  });

  it('pencere içindeki zaman damgası (iki yöne 59 saniye) kabul edilir', () => {
    for (const fark of [-59_000, 59_000]) {
      expect(
        dogrulayici.dogrula(basliklar(alanlar(Date.now() + fark))).gecerli,
      ).toBe(true);
    }
    expect(IMZA_PENCERESI_MS).toBe(60_000);
  });

  it.each(Object.values(ISTEMCI_BASLIKLARI))(
    '%s eksikken reddedilir',
    (baslik) => {
      const b = basliklar(alanlar());
      b[baslik] = undefined;
      expect(dogrulayici.dogrula(b)).toEqual({
        gecerli: false,
        neden: 'eksik',
      });
    },
  );

  it.each(['', '-1', '1.5', '01', 'abc', '99999999999999999'])(
    'sayı olmayan zaman (%j) biçim nedeniyle reddedilir',
    (zaman) => {
      const b = basliklar(alanlar());
      b[ISTEMCI_BASLIKLARI.zaman] = zaman;
      expect(dogrulayici.dogrula(b)).toEqual({
        gecerli: false,
        neden: 'bicim',
      });
    },
  );

  describe('kurulum', () => {
    it('sır eksikken hata verir', () => {
      expect(() => new IstemciAdresiDogrulayici({})).toThrow(
        `${ARACI_KATMAN_SIRRI_DEGISKENI} ortam değişkeni eksik`,
      );
    });

    it('32 karakterden kısa sır hata verir', () => {
      expect(
        () =>
          new IstemciAdresiDogrulayici({
            [ARACI_KATMAN_SIRRI_DEGISKENI]: 'a'.repeat(31),
          }),
      ).toThrow('en az 32 karakter');
    });
  });
});
