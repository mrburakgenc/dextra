// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  erisimBelirteciniOku,
  OTURUM_CEREZLERI,
  oturumCerezleriniSil,
  oturumCerezleriniYaz,
  yenilemeCerezleriVar,
} from './cerezler';

vi.mock('server-only', () => ({}));
// Sahte depo fabrikadan döner; tür dönüşümü (as) gerekmez (FTS-02).
const depo = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(depo) }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

const GIRIS = {
  erisimBelirteci: 'erisim-degeri',
  yenilemeBelirteci: 'yenileme-degeri',
  cihazSirri: 'cihaz-degeri',
};

describe('oturum çerezleri', () => {
  it('çerez adları TS-004 ile aynıdır', () => {
    expect(OTURUM_CEREZLERI).toEqual({
      erisim: 'dextra_erisim',
      yenileme: 'dextra_yenileme',
      cihaz: 'dextra_cihaz',
    });
  });

  it('giriş cevabından üç çerezi TS-004 seçenekleriyle yazar', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await oturumCerezleriniYaz(GIRIS);

    const ortak = { httpOnly: true, sameSite: 'lax', path: '/', secure: false };
    expect(depo.set.mock.calls).toEqual([
      ['dextra_erisim', 'erisim-degeri', { ...ortak, maxAge: 840 }],
      ['dextra_yenileme', 'yenileme-degeri', { ...ortak, maxAge: 604800 }],
      ['dextra_cihaz', 'cihaz-degeri', { ...ortak, maxAge: 604800 }],
    ]);
  });

  it('üretimde üç çerez de Secure yazılır', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await oturumCerezleriniYaz(GIRIS);

    expect(depo.set).toHaveBeenCalledTimes(3);
    for (const [, , secenek] of depo.set.mock.calls) {
      expect(secenek).toMatchObject({ secure: true });
    }
  });

  it('erişim belirtecini erişim çerezinden okur', async () => {
    depo.get.mockImplementation((ad: string) =>
      ad === 'dextra_erisim' ? { name: ad, value: 'erisim-degeri' } : undefined,
    );
    await expect(erisimBelirteciniOku()).resolves.toBe('erisim-degeri');
  });

  it('çerez yoksa erişim belirteci yoktur', async () => {
    depo.get.mockReturnValue(undefined);
    await expect(erisimBelirteciniOku()).resolves.toBeUndefined();
  });

  it.each([
    [['dextra_yenileme', 'dextra_cihaz'], true],
    [['dextra_yenileme'], false],
    [['dextra_cihaz'], false],
    [[], false],
  ])('yenilenebilir çift yalnız ikisi birlikteyken vardır (%j)', async (adlar, beklenen) => {
    depo.get.mockImplementation((ad: string) =>
      adlar.includes(ad) ? { name: ad, value: 'deger' } : undefined,
    );
    await expect(yenilemeCerezleriVar()).resolves.toBe(beklenen);
  });

  it('silme üç çerezi de siler', async () => {
    await oturumCerezleriniSil();

    expect(depo.delete.mock.calls).toEqual([
      ['dextra_erisim'],
      ['dextra_yenileme'],
      ['dextra_cihaz'],
    ]);
  });
});
