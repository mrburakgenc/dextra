import { cleanup, render, screen, within } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Can } from '../../shared/yetki/yetki-saglayici';
import PanelDuzeni from './layout';

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
  usePathname: () => '/kullanicilar',
  useSearchParams: () => new URLSearchParams('sayfa=2'),
}));
vi.mock('../../features/kimlik/eylemler', () => ({ cikisYap: vi.fn() }));

const sahteFetch = vi.fn<typeof fetch>();

function jsonCevap(govde: unknown, durum: number): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { 'content-type': 'application/json' },
  });
}

// Düzenin içindeki ekran parçası: kuralı tür düzeyinde sorar.
const icerik = (
  <>
    <p>içerik</p>
    <Can I="olustur" a="Kullanici">
      <p>kullanıcı açabilir</p>
    </Can>
  </>
);

beforeEach(() => {
  vi.stubEnv('BACKEND_ADRESI', 'http://backend.sinama:3001');
  vi.stubEnv('ARACI_KATMAN_SIRRI', 'sinama-sirri-0123456789abcdefghijklmnop');
  vi.stubGlobal('fetch', sahteFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function oturumVar() {
  depo.get.mockImplementation((ad: string) =>
    ad === 'dextra_erisim' ? { name: ad, value: 'erisim' } : undefined,
  );
}

describe('PanelDuzeni', () => {
  it('erişim çerezi yokken backend çağrılmadan /giris adresine yönlendirir', async () => {
    depo.get.mockReturnValue(undefined);

    await expect(PanelDuzeni({ children: <p>içerik</p> })).rejects.toThrow(
      'yonlendirildi:/giris',
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/giris');
    expect(depo.get).toHaveBeenCalledWith('dextra_erisim');
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('erişim çerezi varken içeriği, uygulama adını ve Çıkış düğmesini gösterir', async () => {
    oturumVar();
    sahteFetch.mockResolvedValue(jsonCevap({ kurallar: [] }, 200));

    render(await PanelDuzeni({ children: <p>içerik</p> }));

    expect(screen.getByText('içerik')).toBeDefined();
    expect(screen.getByRole('banner').textContent).toContain('Dextra');
    expect(screen.getByRole('button', { name: 'Çıkış' })).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('yetkilerim ucuna oturumlu GET isteği atar', async () => {
    oturumVar();
    sahteFetch.mockResolvedValue(jsonCevap({ kurallar: [] }, 200));

    await PanelDuzeni({ children: icerik });

    expect(sahteFetch).toHaveBeenCalledOnce();
    const [url, init] = sahteFetch.mock.calls[0] ?? [];
    expect(url instanceof URL ? url.href : url).toBe(
      'http://backend.sinama:3001/kimlik/oturum/yetkilerim',
    );
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer erisim',
    );
  });

  it('kuralları sağlayıcıya verir: kuralı olan iş düzenin içindeki <Can> ile görünür', async () => {
    oturumVar();
    sahteFetch.mockResolvedValue(
      jsonCevap(
        {
          kurallar: [
            { action: 'olustur', subject: 'Kullanici', yetenekId: 'y1' },
          ],
        },
        200,
      ),
    );

    render(await PanelDuzeni({ children: icerik }));

    expect(screen.getByText('kullanıcı açabilir')).toBeDefined();
  });

  it('kural listesi boşsa içerik gösterilir, kuralı olmayan iş görünmez', async () => {
    oturumVar();
    sahteFetch.mockResolvedValue(jsonCevap({ kurallar: [] }, 200));

    render(await PanelDuzeni({ children: icerik }));

    expect(screen.getByText('içerik')).toBeDefined();
    expect(screen.queryByText('kullanıcı açabilir')).toBeNull();
  });

  it('Kullanici:oku kuralı varken menüde Kullanıcılar bağlantısı görünür', async () => {
    oturumVar();
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kurallar: [{ action: 'oku', subject: 'Kullanici', yetenekId: 'y1' }] },
        200,
      ),
    );

    render(await PanelDuzeni({ children: icerik }));

    const menu = screen.getByRole('navigation', { name: 'Ana menü' });
    const baglanti = within(menu).getByRole('link', { name: 'Kullanıcılar' });
    expect(baglanti.getAttribute('href')).toBe('/kullanicilar');
  });

  it('Kullanici:oku kuralı yokken menüde Kullanıcılar bağlantısı görünmez', async () => {
    oturumVar();
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kurallar: [{ action: 'olustur', subject: 'Kullanici', yetenekId: 'y1' }] },
        200,
      ),
    );

    render(await PanelDuzeni({ children: icerik }));

    expect(screen.getByRole('navigation', { name: 'Ana menü' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Kullanıcılar' })).toBeNull();
  });

  it.each([
    { kaynak: 'Rol', etiket: 'Roller', adres: '/roller' },
    { kaynak: 'Grup', etiket: 'Gruplar', adres: '/gruplar' },
    { kaynak: 'Izin', etiket: 'İzinler', adres: '/izinler' },
    { kaynak: 'Yetenek', etiket: 'Yetenekler', adres: '/yetenekler' },
  ])(
    '$kaynak:oku kuralı varken menüde $etiket bağlantısı görünür, yokken görünmez',
    async ({ kaynak, etiket, adres }) => {
      oturumVar();
      sahteFetch.mockResolvedValueOnce(
        jsonCevap(
          { kurallar: [{ action: 'oku', subject: kaynak, yetenekId: 'y1' }] },
          200,
        ),
      );

      render(await PanelDuzeni({ children: icerik }));

      const menu = screen.getByRole('navigation', { name: 'Ana menü' });
      expect(
        within(menu).getByRole('link', { name: etiket }).getAttribute('href'),
      ).toBe(adres);
      expect(within(menu).getAllByRole('link')).toHaveLength(1);
      cleanup();

      // Aynı kaynakta başka eylem okuma sayılmaz.
      sahteFetch.mockResolvedValueOnce(
        jsonCevap(
          { kurallar: [{ action: 'olustur', subject: kaynak, yetenekId: 'y1' }] },
          200,
        ),
      );

      render(await PanelDuzeni({ children: icerik }));

      expect(screen.getByRole('navigation', { name: 'Ana menü' })).toBeDefined();
      expect(screen.queryByRole('link', { name: etiket })).toBeNull();
    },
  );

  it('backend 401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    oturumVar();
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kod: 'kimlik_gerekli', ileti: 'Oturum gerekli', ayrinti: null },
        401,
      ),
    );

    await expect(PanelDuzeni({ children: icerik })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });

  it('backend\'e ulaşılamayınca içerik yerine ileti gösterir ve çerezleri silmez', async () => {
    oturumVar();
    sahteFetch.mockRejectedValue(new TypeError('fetch failed'));

    render(await PanelDuzeni({ children: icerik }));

    expect(screen.getByRole('alert').textContent).toBe('Şu an ulaşılamıyor');
    expect(screen.queryByText('içerik')).toBeNull();
    expect(screen.getByRole('button', { name: 'Çıkış' })).toBeDefined();
    expect(depo.delete).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('PanelDuzeni parola ve oturumlar bağlantıları', () => {
  function kurallarla(kurallar: object[]) {
    oturumVar();
    sahteFetch.mockResolvedValueOnce(jsonCevap({ kurallar }, 200));
  }

  it('Oturum:oku kuralı varken menüde Oturumlar bağlantısı görünür', async () => {
    kurallarla([{ action: 'oku', subject: 'Oturum', yetenekId: 'y1' }]);

    render(await PanelDuzeni({ children: icerik }));

    const menu = screen.getByRole('navigation', { name: 'Ana menü' });
    expect(within(menu).getByRole('link', { name: 'Oturumlar' }).getAttribute('href')).toBe(
      '/oturumlar',
    );
    expect(within(menu).getAllByRole('link')).toHaveLength(1);
  });

  it('Oturum:oku kuralı yokken (kapat olsa da) Oturumlar bağlantısı görünmez', async () => {
    kurallarla([{ action: 'kapat', subject: 'Oturum', yetenekId: 'y1' }]);

    render(await PanelDuzeni({ children: icerik }));

    expect(screen.queryByRole('link', { name: 'Oturumlar' })).toBeNull();
  });

  it('kuralı olmayan oturumlu kişi de Parolamı değiştir bağlantısını görür', async () => {
    kurallarla([]);

    render(await PanelDuzeni({ children: icerik }));

    expect(
      screen.getByRole('link', { name: 'Parolamı değiştir' }).getAttribute('href'),
    ).toBe('/parola');
  });

  it('yetkilerim alınamayınca da Parolamı değiştir bağlantısı görünür', async () => {
    oturumVar();
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ kod: 'yetki_yok', ileti: 'Yetki yok', ayrinti: null }, 403),
    );

    render(await PanelDuzeni({ children: icerik }));

    expect(screen.getByRole('link', { name: 'Parolamı değiştir' })).toBeDefined();
  });
});

// Yenilenemeyen oturum (GV-099): ara katman backend'e ulaşamayınca çerezlere dokunmaz; erişim
// çerezi yoktur, yenileme ve cihaz çerezi durur.
function cerezler(...adlar: string[]) {
  depo.get.mockImplementation((ad: string) =>
    adlar.includes(ad) ? { name: ad, value: 'deger' } : undefined,
  );
}

describe('PanelDuzeni yenilenemeyen oturum', () => {
  it('erişim çerezi yok, yenileme ve cihaz çerezi varken yönlendirmez; backend çağrılmadan ileti ve aynı sayfaya Yeniden dene bağlantısı görünür', async () => {
    cerezler('dextra_yenileme', 'dextra_cihaz');

    render(await PanelDuzeni({ children: icerik }));

    expect(redirect).not.toHaveBeenCalled();
    expect(sahteFetch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Şu an ulaşılamıyor');
    const baglanti = screen.getByRole('link', { name: 'Yeniden dene' });
    // O anki sayfanın adresi, sorgusuyla.
    expect(baglanti.getAttribute('href')).toBe('/kullanicilar?sayfa=2');
    // Menü ve sayfa içeriği çizilmez; çerezlere dokunulmaz.
    expect(screen.queryByRole('navigation', { name: 'Ana menü' })).toBeNull();
    expect(screen.queryByText('içerik')).toBeNull();
    expect(depo.delete).not.toHaveBeenCalled();
    expect(depo.set).not.toHaveBeenCalled();
  });

  it('üç çerez de yokken /giris yönlendirmesi sürer', async () => {
    cerezler();

    await expect(PanelDuzeni({ children: icerik })).rejects.toThrow('yonlendirildi:/giris');
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it.each([['dextra_yenileme'], ['dextra_cihaz']])(
    'erişim çerezi yokken yalnız %s varsa oturum yenilenemeyeceği için /giris adresine yönlendirir',
    async (ad) => {
      cerezler(ad);

      await expect(PanelDuzeni({ children: icerik })).rejects.toThrow('yonlendirildi:/giris');
      expect(sahteFetch).not.toHaveBeenCalled();
    },
  );
});
