import { cleanup, render, screen, within } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IzinlerSayfasi from './page';

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

const IKI_KAYIT = [
  { id: 'i1', kaynak: 'Kullanici', eylem: 'oku' },
  { id: 'i2', kaynak: 'Rol', eylem: 'olustur' },
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
  render(await IzinlerSayfasi({ searchParams: Promise.resolve(sorgu) }));
}

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

function hucreler(satir: HTMLElement | undefined): (string | null)[] {
  return within(satir ?? document.body)
    .getAllByRole('cell')
    .map((h) => h.textContent);
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

describe('IzinlerSayfasi liste', () => {
  it('kaynak ve eylemi tabloya döker; gelmeyen kolon boş işaretle gösterilir', async () => {
    sahteFetch.mockResolvedValue(
      listeCevabi({ kayitlar: [...IKI_KAYIT, { id: 'i3', kaynak: 'Grup' }] }),
    );

    await goster();

    const tablo = screen.getByRole('table', { name: /İzinler/ });
    expect(
      within(tablo)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Kaynak', 'Eylem']);
    const [, ilk, ikinci, ucuncu] = within(tablo).getAllByRole('row');
    expect(hucreler(ilk)).toEqual(['Kullanici', 'oku']);
    expect(hucreler(ikinci)).toEqual(['Rol', 'olustur']);
    expect(hucreler(ucuncu)).toEqual(['Grup', '—']);
  });

  it('adresteki sayfa ve sıralama backend\'e oturumlu GET isteğiyle gider', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 3 }));

    await goster({ sayfa: '3', sirala: 'eylem' });

    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(istekAdresi().pathname).toBe('/kimlik/izin');
    expect(istekAdresi().search).toBe('?sayfa=3&sirala=eylem');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer erisim',
    );
  });

  it('sıralama başlıkları yönü çevirir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({ sirala: '-kaynak' });

    expect(baglanti('Kaynak')).toBe('/izinler?sirala=kaynak');
    expect(baglanti('Eylem')).toBe('/izinler?sirala=eylem');
  });
});

describe('IzinlerSayfasi sayfalama', () => {
  it('ilk sayfada Önceki yoktur; Sonraki ikinci sayfayı sıralamayla gösterir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 1, sonrakiVar: true }));

    await goster({ sirala: 'kaynak' });

    expect(baglanti('Sonraki')).toBe('/izinler?sayfa=2&sirala=kaynak');
    expect(screen.queryByRole('link', { name: 'Önceki' })).toBeNull();
  });

  it('son sayfada Sonraki yoktur; Önceki bir önceki sayfayı gösterir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2, sonrakiVar: false }));

    await goster({ sayfa: '2' });

    expect(baglanti('Önceki')).toBe('/izinler?sayfa=1');
    expect(screen.queryByRole('link', { name: 'Sonraki' })).toBeNull();
  });
});

describe('IzinlerSayfasi durumlar', () => {
  it('kayıt yoksa Kayıt yok iletisi gösterilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ kayitlar: [] }));

    await goster();

    expect(screen.getByText('Kayıt yok')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

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
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kod: 'kimlik_gerekli', ileti: 'Oturum gerekli', ayrinti: null },
        401,
      ),
    );

    await expect(
      IzinlerSayfasi({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('yonlendirildi:/oturum-bitti');
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });
});
