import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, UnsecuredJWT } from 'jose';
import {
  ACIK_ANAHTAR_DEGISKENI,
  BelirtecServisi,
  ERISIM_BELIRTECI_SURESI_SN,
  OZEL_ANAHTAR_DEGISKENI,
  YENILEME_BELIRTECI_SURESI_SN,
} from './belirtec.js';

function anahtarCifti(): Record<string, string> {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return {
    [OZEL_ANAHTAR_DEGISKENI]: privateKey,
    [ACIK_ANAHTAR_DEGISKENI]: publicKey,
  };
}

const ORTAM = anahtarCifti();
const servis = new BelirtecServisi(ORTAM);
const ERISIM = { kullaniciId: 'kullanici-1', oturumId: 'oturum-1' };
const YENILEME = { ...ERISIM, nesil: 3 };

async function gecmisteUret(
  saniyeOnce: number,
  uret: () => Promise<string>,
): Promise<string> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() - saniyeOnce * 1000);
  try {
    return await uret();
  } finally {
    vi.useRealTimers();
  }
}

describe('belirteç servisi', () => {
  it('erişim belirteci doğrulanır, kullanıcı ve oturum geri okunur', async () => {
    const belirtec = await servis.erisimBelirteciUret(ERISIM);
    expect(await servis.erisimBelirteciDogrula(belirtec)).toEqual({
      gecerli: true,
      icerik: ERISIM,
    });
  });

  it('yenileme belirteci doğrulanır, kullanıcı, oturum ve nesil geri okunur', async () => {
    const belirtec = await servis.yenilemeBelirteciUret(YENILEME);
    expect(await servis.yenilemeBelirteciDogrula(belirtec)).toEqual({
      gecerli: true,
      icerik: YENILEME,
    });
  });

  it('belirteçler türünü taşır', async () => {
    const yuk = (b: string): unknown =>
      JSON.parse(Buffer.from(b.split('.')[1] ?? '', 'base64url').toString());
    expect(yuk(await servis.erisimBelirteciUret(ERISIM))).toMatchObject({
      tur: 'erisim',
    });
    expect(yuk(await servis.yenilemeBelirteciUret(YENILEME))).toMatchObject({
      tur: 'yenileme',
    });
  });

  it('süresi geçmiş erişim belirteci süre nedeniyle geçersizdir', async () => {
    const belirtec = await gecmisteUret(ERISIM_BELIRTECI_SURESI_SN + 1, () =>
      servis.erisimBelirteciUret(ERISIM),
    );
    expect(await servis.erisimBelirteciDogrula(belirtec)).toEqual({
      gecerli: false,
      neden: 'sure',
    });
  });

  it('süresi geçmiş yenileme belirteci süre nedeniyle geçersizdir', async () => {
    const belirtec = await gecmisteUret(YENILEME_BELIRTECI_SURESI_SN + 1, () =>
      servis.yenilemeBelirteciUret(YENILEME),
    );
    expect(await servis.yenilemeBelirteciDogrula(belirtec)).toEqual({
      gecerli: false,
      neden: 'sure',
    });
  });

  it('süresi dolmamış erişim belirteci geçerlidir', async () => {
    const belirtec = await gecmisteUret(ERISIM_BELIRTECI_SURESI_SN - 5, () =>
      servis.erisimBelirteciUret(ERISIM),
    );
    expect((await servis.erisimBelirteciDogrula(belirtec)).gecerli).toBe(true);
  });

  it('başka anahtarla imzalanmış belirteç imza nedeniyle geçersizdir', async () => {
    const baska = new BelirtecServisi(anahtarCifti());
    expect(
      await servis.erisimBelirteciDogrula(
        await baska.erisimBelirteciUret(ERISIM),
      ),
    ).toEqual({ gecerli: false, neden: 'imza' });
    expect(
      await servis.yenilemeBelirteciDogrula(
        await baska.yenilemeBelirteciUret(YENILEME),
      ),
    ).toEqual({ gecerli: false, neden: 'imza' });
  });

  it.each(['', 'bozuk', 'a.b.c', 'a.b'])(
    'bozuk dizge (%j) biçim nedeniyle geçersizdir',
    async (belirtec) => {
      expect(await servis.erisimBelirteciDogrula(belirtec)).toEqual({
        gecerli: false,
        neden: 'bicim',
      });
      expect(await servis.yenilemeBelirteciDogrula(belirtec)).toEqual({
        gecerli: false,
        neden: 'bicim',
      });
    },
  );

  it('yenileme belirteci erişim belirteci yerine kabul edilmez', async () => {
    const belirtec = await servis.yenilemeBelirteciUret(YENILEME);
    expect(await servis.erisimBelirteciDogrula(belirtec)).toEqual({
      gecerli: false,
      neden: 'tur',
    });
  });

  it('erişim belirteci yenileme belirteci yerine kabul edilmez', async () => {
    const belirtec = await servis.erisimBelirteciUret(ERISIM);
    expect(await servis.yenilemeBelirteciDogrula(belirtec)).toEqual({
      gecerli: false,
      neden: 'tur',
    });
  });

  it('imzasız (alg none) belirteç reddedilir', async () => {
    const belirtec = new UnsecuredJWT({ oturum: 'oturum-1', tur: 'erisim' })
      .setSubject('kullanici-1')
      .setIssuedAt()
      .setExpirationTime('15m')
      .encode();
    expect(await servis.erisimBelirteciDogrula(belirtec)).toEqual({
      gecerli: false,
      neden: 'imza',
    });
  });

  it('açık anahtar HMAC sırrı olarak kullanılmış HS256 belirteci reddedilir', async () => {
    const sir = Buffer.from(ORTAM[ACIK_ANAHTAR_DEGISKENI] ?? '', 'utf8');
    const erisim = await new SignJWT({ oturum: 'oturum-1', tur: 'erisim' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('kullanici-1')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(sir);
    const yenileme = await new SignJWT({
      oturum: 'oturum-1',
      nesil: 3,
      tur: 'yenileme',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('kullanici-1')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(sir);
    expect(await servis.erisimBelirteciDogrula(erisim)).toEqual({
      gecerli: false,
      neden: 'imza',
    });
    expect(await servis.yenilemeBelirteciDogrula(yenileme)).toEqual({
      gecerli: false,
      neden: 'imza',
    });
  });

  describe('kurulum', () => {
    it.each([OZEL_ANAHTAR_DEGISKENI, ACIK_ANAHTAR_DEGISKENI])(
      '%s eksikken hata verir',
      (degisken) => {
        expect(
          () => new BelirtecServisi({ ...ORTAM, [degisken]: undefined }),
        ).toThrow(`${degisken} ortam değişkeni eksik`);
      },
    );

    it.each([OZEL_ANAHTAR_DEGISKENI, ACIK_ANAHTAR_DEGISKENI])(
      '%s bozukken hata verir',
      (degisken) => {
        expect(
          () =>
            new BelirtecServisi({
              ...ORTAM,
              [degisken]:
                '-----BEGIN PRIVATE KEY-----\nbozuk\n-----END PRIVATE KEY-----',
            }),
        ).toThrow(`${degisken} okunamadı`);
      },
    );

    it('RSA olmayan anahtar hata verir', () => {
      const { privateKey } = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      expect(
        () =>
          new BelirtecServisi({
            ...ORTAM,
            [OZEL_ANAHTAR_DEGISKENI]: privateKey,
          }),
      ).toThrow(`${OZEL_ANAHTAR_DEGISKENI} bir RSA anahtarı değil`);
    });
  });
});
