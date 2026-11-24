import { cleanup, render, screen, within } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tarihSaat } from '../../../shared/bicim/bicim';
import KullanicilarSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek çerez modülü ve gerçek backend isteği sahte çerez deposu ve sahte fetch ile koşar.
const depo = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(depo),
  headers: () => Promise.resolve(new Headers({ 'user-agent': 'deneme' })),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((yol: string) => {
    throw new Error(`yonlendirildi:${yol}`);
  }),
}));

const sahteFetch = vi.fn<typeof fetch>();

function jsonCevap(govde: unknown, durum: number): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { 'content-type': 'application/json' },
  });
}

const PASIF_ZAMANI = '2026-03-01T09:00:00.000Z';
const OLUSTURMA_1 = '2026-01-15T10:30:00.000Z';
const OLUSTURMA_2 = '2026-02-20T14:05:00.000Z';

// İkinci kaydın kullaniciAdi kolonu gelmez (kişi göremez).
const IKI_KAYIT = [
  {
    id: 'k1',
    gorunenAd: 'Ada Yılmaz',
    kullaniciAdi: 'ada',
    pasifZamani: null,
    olusturmaZamani: OLUSTURMA_1,
  },
  {
    id: 'k2',
    gorunenAd: 'Can Demir',
    pasifZamani: PASIF_ZAMANI,
    olusturmaZamani: OLUSTURMA_2,
  },
];

function listeCevabi(
  ek: Partial<{ kayitlar: unknown[]; sayfa: number; sonrakiVar: boolean }> = {},
) {
  return jsonCevap(
    { kayitlar: IKI_KAYIT, sayfa: 1, boyut: 20, sonrakiVar: false, ...ek },
    200,
  );
}

async function goster(sorgu: Record<string, string | string[]> = {}) {
  render(await KullanicilarSayfasi({ searchParams: Promise.resolve(sorgu) }));
}

// Backend'e giden isteğin adresi; backend isteği fetch'e URL nesnesi verir.
function istekAdresi(): URL {
  const [adres] = sahteFetch.mock.calls[0] ?? [];
  if (!(adres instanceof URL)) {
    throw new Error('backend isteği URL nesnesiyle atılmadı');
  }
  return adres;
}

function baglanti(ad: string): string | null {
  return screen.getByRole('link', { name: ad }).getAttribute('href');
}

beforeEach(() => {
  vi.stubEnv('BACKEND_ADRESI', 'http://backend.sinama:3001');
  vi.stubEnv('ARACI_KATMAN_SIRRI', 'sinama-sirri-0123456789abcdefghijklmnop');
  vi.stubGlobal('fetch', sahteFetch);
  depo.get.mockImplementation((ad: string) =>
    ad === 'dextra_erisim' ? { name: ad, value: 'erisim' } : undefined,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('KullanicilarSayfasi liste', () => {
  it('iki kaydı tabloya döker: durum, oluşturma zamanı ve gelmeyen kolon', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    const tablo = screen.getByRole('table', { name: /Kullanıcılar/ });
    const basliklar = within(tablo)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(basliklar).toEqual([
      'Görünen ad',
      'Kullanıcı adı',
      'Durum',
      'Oluşturma zamanı',
    ]);
    const [, ilk, ikinci] = within(tablo).getAllByRole('row');
    expect(
      within(ilk ?? tablo)
        .getAllByRole('cell')
        .map((h) => h.textContent),
    ).toEqual(['Ada Yılmaz', 'ada', 'Etkin', tarihSaat(OLUSTURMA_1)]);
    expect(
      within(ikinci ?? tablo)
        .getAllByRole('cell')
        .map((h) => h.textContent),
    ).toEqual(['Can Demir', '—', 'Pasif', tarihSaat(OLUSTURMA_2)]);
  });

  it('kayıtta hiç gelmeyen durum ve zaman kolonları boş işaretle gösterilir', async () => {
    sahteFetch.mockResolvedValue(
      listeCevabi({ kayitlar: [{ id: 'k3', gorunenAd: 'Gizli' }] }),
    );

    await goster();

    const [, satir] = screen.getAllByRole('row');
    expect(
      within(satir ?? document.body)
        .getAllByRole('cell')
        .map((h) => h.textContent),
    ).toEqual(['Gizli', '—', '—', '—']);
  });

  it('kayıt yoksa Kayıt yok iletisi gösterilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ kayitlar: [] }));

    await goster();

    expect(screen.getByText('Kayıt yok')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('backend\'e oturumlu GET isteği atar', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(istekAdresi().pathname).toBe('/kimlik/kullanici');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer erisim',
    );
  });
});

describe('KullanicilarSayfasi sorgu', () => {
  it('adresteki sayfa, sıralama ve pasif değerleri backend isteğine aynen gider', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2 }));

    await goster({ sayfa: '2', sirala: '-olusturmaZamani', pasif: 'true' });

    expect(istekAdresi().search).toBe(
      '?sayfa=2&sirala=-olusturmaZamani&pasif=true',
    );
  });

  it('sorgu yokken backend\'e yalnız ilk sayfa gider', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    expect(istekAdresi().search).toBe('?sayfa=1');
  });

  it.each([
    { sayfa: 'abc', sirala: 'parola', pasif: 'belki' },
    { sayfa: '0', sirala: 'GORUNENAD', pasif: 'TRUE' },
    { sayfa: '-3', sirala: '--gorunenAd', pasif: '1' },
    { sayfa: '2.5', sirala: '', pasif: '' },
    { sayfa: ['2', '3'], sirala: ['gorunenAd', 'kullaniciAdi'], pasif: ['true'] },
  ])(
    'geçersiz sayfa, sıralama ve süzgeç varsayılana döner: %o',
    async (sorgu) => {
      sahteFetch.mockResolvedValue(listeCevabi());

      await goster(sorgu);

      expect(istekAdresi().search).toBe('?sayfa=1');
    },
  );
});

describe('KullanicilarSayfasi sayfalama', () => {
  it('sonrakiVar doğruyken Sonraki bir sonraki sayfayı gösterir, sıralama ve süzgeç korunur; ilk sayfada Önceki yoktur', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 1, sonrakiVar: true }));

    await goster({ sirala: 'kullaniciAdi', pasif: 'false' });

    expect(baglanti('Sonraki')).toBe(
      '/kullanicilar?sayfa=2&sirala=kullaniciAdi&pasif=false',
    );
    expect(screen.queryByRole('link', { name: 'Önceki' })).toBeNull();
  });

  it('ikinci sayfada Önceki birinci sayfayı gösterir; sonrakiVar yanlışken Sonraki yoktur', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2, sonrakiVar: false }));

    await goster({ sayfa: '2', sirala: '-gorunenAd', pasif: 'true' });

    expect(baglanti('Önceki')).toBe(
      '/kullanicilar?sayfa=1&sirala=-gorunenAd&pasif=true',
    );
    expect(screen.queryByRole('link', { name: 'Sonraki' })).toBeNull();
  });
});

describe('KullanicilarSayfasi sıralama ve süzgeç', () => {
  it('sıralanan kolona ikinci tıklama yönü çevirir; öbür kolonlar artan sıraya gider', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 3 }));

    await goster({ sayfa: '3', sirala: 'gorunenAd', pasif: 'false' });

    expect(baglanti('Görünen ad')).toBe(
      '/kullanicilar?sirala=-gorunenAd&pasif=false',
    );
    expect(baglanti('Kullanıcı adı')).toBe(
      '/kullanicilar?sirala=kullaniciAdi&pasif=false',
    );
    expect(baglanti('Oluşturma zamanı')).toBe(
      '/kullanicilar?sirala=olusturmaZamani&pasif=false',
    );
    expect(
      screen.getByRole('columnheader', { name: /Görünen ad/ }).getAttribute(
        'aria-sort',
      ),
    ).toBe('ascending');
  });

  it('azalan sıradaki kolona tıklama artan sıraya döner', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({ sirala: '-olusturmaZamani' });

    expect(baglanti('Oluşturma zamanı')).toBe(
      '/kullanicilar?sirala=olusturmaZamani',
    );
    expect(
      screen
        .getByRole('columnheader', { name: /Oluşturma zamanı/ })
        .getAttribute('aria-sort'),
    ).toBe('descending');
  });

  it('süzgeç bağlantıları sıralamayı korur ve ilk sayfaya döner', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2 }));

    await goster({ sayfa: '2', sirala: 'kullaniciAdi', pasif: 'true' });

    expect(baglanti('Yalnız etkinler')).toBe(
      '/kullanicilar?sirala=kullaniciAdi&pasif=false',
    );
    expect(baglanti('Yalnız pasifler')).toBe(
      '/kullanicilar?sirala=kullaniciAdi&pasif=true',
    );
    expect(baglanti('Hepsi')).toBe('/kullanicilar?sirala=kullaniciAdi');
    expect(
      screen
        .getByRole('link', { name: 'Yalnız pasifler' })
        .getAttribute('aria-current'),
    ).toBe('page');
  });
});

describe('KullanicilarSayfasi hatalar', () => {
  it('403 yetki_yok dönünce yetki iletisi gösterilir', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap({ kod: 'yetki_yok', ileti: 'Yetki yok', ayrinti: null }, 403),
    );

    await goster();

    expect(screen.getByRole('alert').textContent).toBe(
      'Bu sayfayı görme yetkin yok',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('backend\'e ulaşılamayınca ulaşılamıyor iletisi gösterilir', async () => {
    sahteFetch.mockRejectedValue(new TypeError('fetch failed'));

    await goster();

    expect(screen.getByRole('alert').textContent).toBe('Şu an ulaşılamıyor');
    expect(depo.delete).not.toHaveBeenCalled();
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kod: 'kimlik_gerekli', ileti: 'Oturum gerekli', ayrinti: null },
        401,
      ),
    );

    await expect(
      KullanicilarSayfasi({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('yonlendirildi:/oturum-bitti');
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });
});
