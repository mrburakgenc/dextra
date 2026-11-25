import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import YeniKullaniciSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek Server Action, gerçek backend isteği sahte çerez deposu ve sahte fetch ile koşar.
const depo = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(depo),
  headers: () =>
    Promise.resolve(
      new Headers({ 'user-agent': 'deneme', origin: 'http://panel.sinama:3100' }),
    ),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((yol: string) => {
    throw new Error(`yonlendirildi:${yol}`);
  }),
}));
vi.mock('next/cache', () => ({ refresh: vi.fn() }));

const sahteFetch = vi.fn<typeof fetch>();

function jsonCevap(govde: unknown, durum: number): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { 'content-type': 'application/json' },
  });
}

const OLUSTURUR: YetkiKurali[] = [{ action: 'olustur', subject: 'Kullanici' }];
const KOD = 'kod-0123456789';

function goster(kurallar: YetkiKurali[] = OLUSTURUR) {
  render(
    <YetkiSaglayici kurallar={kurallar}>
      <YeniKullaniciSayfasi />
    </YetkiSaglayici>,
  );
}

async function gonder(kullaniciAdi: string, gorunenAd: string) {
  if (kullaniciAdi !== '') {
    await userEvent.type(screen.getByLabelText('Kullanıcı adı'), kullaniciAdi);
  }
  if (gorunenAd !== '') {
    await userEvent.type(screen.getByLabelText('Görünen ad'), gorunenAd);
  }
  await userEvent.click(screen.getByRole('button', { name: 'Kullanıcıyı aç' }));
}

// Backend'e giden ilk isteğin adresi, yöntemi ve gövdesi.
function istek() {
  const [adres, init] = sahteFetch.mock.calls[0] ?? [];
  if (!(adres instanceof URL) || typeof init?.body !== 'string') {
    throw new Error('backend isteği beklenen biçimde atılmadı');
  }
  const govde: unknown = JSON.parse(init.body);
  return { yol: adres.pathname, yontem: init.method, govde };
}

// Alan hatası alanın yanındadır: girdi geçersiz işaretlidir ve hata iletisine bağlıdır.
function alanHatasi(etiket: string): string | null {
  const girdi = screen.getByLabelText(etiket);
  if (girdi.getAttribute('aria-invalid') !== 'true') {
    return null;
  }
  const kimlik = girdi.getAttribute('aria-describedby') ?? '';
  return document.getElementById(kimlik)?.textContent ?? null;
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
  localStorage.clear();
  sessionStorage.clear();
});

describe('YeniKullaniciSayfasi başarı', () => {
  it('backend\'e oturumlu POST kimlik/kullanici isteği küçük harfli ad ve kırpılmış görünen adla gider', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap({ id: 'k1', parolaBaglantisiKodu: KOD }, 201),
    );
    goster();

    await gonder('Ada.Yilmaz', '  Ada Yılmaz ');

    await screen.findByRole('status');
    expect(sahteFetch).toHaveBeenCalledTimes(1);
    expect(istek()).toEqual({
      yol: '/kimlik/kullanici',
      yontem: 'POST',
      govde: { kullaniciAdi: 'ada.yilmaz', gorunenAd: 'Ada Yılmaz' },
    });
    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
  });

  it('başarıda kodu taşıyan tam parola belirleme adresi ve uyarı bir kez görünür; kod hiçbir yere yazılmaz', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap({ id: 'k1', parolaBaglantisiKodu: KOD }, 201),
    );
    goster();

    await gonder('ada', 'Ada Yılmaz');

    const kutu = await screen.findByRole('status');
    expect(kutu.textContent).toContain(
      `http://panel.sinama:3100/parola-belirle?kod=${KOD}`,
    );
    expect(kutu.textContent).toContain('Bu kod yeniden gösterilmez');
    expect(screen.getAllByText(/parola-belirle\?kod=/)).toHaveLength(1);
    expect(window.location.href).not.toContain(KOD);
    expect(document.cookie).not.toContain(KOD);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(depo.set).not.toHaveBeenCalled();
  });
});

describe('YeniKullaniciSayfasi doğrulama', () => {
  it.each([
    ['iki karakter', 'ab'],
    ['boşluk', 'ada yilmaz'],
    ['Türkçe harf', 'çiğdem'],
    ['izinsiz işaret', 'ada@yilmaz'],
    ['65 karakter', 'a'.repeat(65)],
  ])('kurala uymayan kullanıcı adı (%s) backend çağrılmadan alan hatası verir', async (_ad, kullaniciAdi) => {
    goster();

    await gonder(kullaniciAdi, 'Ada Yılmaz');

    await vi.waitFor(() => {
      expect(alanHatasi('Kullanıcı adı')).toContain('3-64 karakter');
    });
    expect(alanHatasi('Görünen ad')).toBeNull();
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('boş kullanıcı adı backend çağrılmadan alan hatası verir', async () => {
    goster();

    await gonder('', 'Ada Yılmaz');

    await vi.waitFor(() => {
      expect(alanHatasi('Kullanıcı adı')).not.toBeNull();
    });
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['boş', ''],
    ['yalnız boşluk', '   '],
  ])('%s görünen ad backend çağrılmadan alan hatası verir', async (_ad, gorunenAd) => {
    goster();

    await gonder('ada', gorunenAd);

    await vi.waitFor(() => {
      expect(alanHatasi('Görünen ad')).toBe('Görünen ad boş olamaz');
    });
    expect(alanHatasi('Kullanıcı adı')).toBeNull();
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('200 karakteri aşan görünen ad backend çağrılmadan alan hatası verir', async () => {
    goster();

    await gonder('ada', 'a'.repeat(201));

    await vi.waitFor(() => {
      expect(alanHatasi('Görünen ad')).toBe('Görünen ad en çok 200 karakter olabilir');
    });
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});

describe('YeniKullaniciSayfasi hatalar', () => {
  it('409 cakisma dönünce backend\'in iletisi kullanıcı adı alanının yanında görünür', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kod: 'cakisma', ileti: 'Bu kullanıcı adı kullanılıyor', ayrinti: null },
        409,
      ),
    );
    goster();

    await gonder('ada', 'Ada Yılmaz');

    await vi.waitFor(() => {
      expect(alanHatasi('Kullanıcı adı')).toBe('Bu kullanıcı adı kullanılıyor');
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('403 yetki_yok dönünce yetki iletisi formun üstünde görünür', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap({ kod: 'yetki_yok', ileti: 'Yetki yok', ayrinti: null }, 403),
    );
    goster();

    await gonder('ada', 'Ada Yılmaz');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Bu iş için yetkin yok',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('YeniKullaniciSayfasi yazılanın korunması', () => {
  function deger(etiket: string): string {
    const girdi = screen.getByLabelText(etiket);
    return girdi instanceof HTMLInputElement ? girdi.value : '';
  }

  it('409 dönünce yazılan kullanıcı adı ve görünen ad formda kalır', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kod: 'cakisma', ileti: 'Bu kullanıcı adı kullanılıyor', ayrinti: null },
        409,
      ),
    );
    goster();

    await gonder('Ada.Yilmaz', '  Ada Yılmaz ');

    await vi.waitFor(() => {
      expect(alanHatasi('Kullanıcı adı')).toBe('Bu kullanıcı adı kullanılıyor');
    });
    expect(deger('Kullanıcı adı')).toBe('Ada.Yilmaz');
    expect(deger('Görünen ad')).toBe('  Ada Yılmaz ');
  });

  it('alan hatasında yazılanlar formda kalır', async () => {
    goster();

    await gonder('ab', 'Ada Yılmaz');

    await vi.waitFor(() => {
      expect(alanHatasi('Kullanıcı adı')).toContain('3-64 karakter');
    });
    expect(deger('Kullanıcı adı')).toBe('ab');
    expect(deger('Görünen ad')).toBe('Ada Yılmaz');
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('hatadan sonraki başarıda form bugünkü gibi boşalır', async () => {
    sahteFetch
      .mockResolvedValueOnce(
        jsonCevap(
          { kod: 'cakisma', ileti: 'Bu kullanıcı adı kullanılıyor', ayrinti: null },
          409,
        ),
      )
      .mockResolvedValueOnce(jsonCevap({ id: 'k1', parolaBaglantisiKodu: KOD }, 201));
    goster();

    await gonder('ada', 'Ada Yılmaz');
    await vi.waitFor(() => {
      expect(alanHatasi('Kullanıcı adı')).toBe('Bu kullanıcı adı kullanılıyor');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Kullanıcıyı aç' }));

    await screen.findByRole('status');
    expect(deger('Kullanıcı adı')).toBe('');
    expect(deger('Görünen ad')).toBe('');
  });
});

describe('YeniKullaniciSayfasi yetki', () => {
  it('Kullanici olustur kuralı olmayan kişi formu görmez', () => {
    goster([{ action: 'oku', subject: 'Kullanici' }]);

    expect(screen.queryByRole('button', { name: 'Kullanıcıyı aç' })).toBeNull();
    expect(screen.queryByLabelText('Kullanıcı adı')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Bu iş için yetkin yok');
  });
});
