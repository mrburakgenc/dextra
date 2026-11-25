import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import YeniRolSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek Server Action, gerçek backend isteği sahte çerez deposu ve sahte fetch ile koşar.
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
vi.mock('next/cache', () => ({ refresh: vi.fn() }));

const sahteFetch = vi.fn<typeof fetch>();

function jsonCevap(govde: unknown, durum: number): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { 'content-type': 'application/json' },
  });
}

// Server Action'daki yönlendirme fırlatır; çatı onu yakalayıp sayfaya gider. Sınamada en yakın
// hata sınırı yakalar ve hedefi gösterir.
class Yakalayici extends Component<{ children: ReactNode }, { hata: string | null }> {
  override state: { hata: string | null } = { hata: null };

  static getDerivedStateFromError(hata: unknown) {
    return { hata: hata instanceof Error ? hata.message : 'bilinmeyen' };
  }

  override render() {
    return this.state.hata === null ? this.props.children : <p>{this.state.hata}</p>;
  }
}

const ID = '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const OLUSTURUR: YetkiKurali[] = [{ action: 'olustur', subject: 'Rol' }];

function goster(kurallar: YetkiKurali[] = OLUSTURUR) {
  render(
    <YetkiSaglayici kurallar={kurallar}>
      <Yakalayici>
        <YeniRolSayfasi />
      </Yakalayici>
    </YetkiSaglayici>,
  );
}

async function gonder(ad: string) {
  if (ad !== '') {
    await userEvent.type(screen.getByLabelText('Ad'), ad);
  }
  await userEvent.click(screen.getByRole('button', { name: 'Rolü oluştur' }));
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
  vi.restoreAllMocks();
});

describe('YeniRolSayfasi başarı', () => {
  it('backend\'e oturumlu POST kimlik/rol isteği kırpılmış adla gider ve kayıt sayfasına yönlendirir', async () => {
    // React, hata sınırının yakaladığı yönlendirmeyi günlüğe yazar.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sahteFetch.mockResolvedValue(jsonCevap({ id: ID }, 201));
    goster();

    await gonder('  Muhasebe ');

    expect(await screen.findByText(`yonlendirildi:/roller/${ID}`)).toBeDefined();
    expect(sahteFetch).toHaveBeenCalledTimes(1);
    expect(istek()).toEqual({
      yol: '/kimlik/rol',
      yontem: 'POST',
      govde: { ad: 'Muhasebe' },
    });
    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
    expect(redirect).toHaveBeenCalledExactlyOnceWith(`/roller/${ID}`);
  });
});

describe('YeniRolSayfasi doğrulama', () => {
  it.each([
    ['boş', ''],
    ['yalnız boşluk', '   '],
  ])('%s ad backend çağrılmadan alan hatası verir', async (_ad, ad) => {
    goster();

    await gonder(ad);

    await vi.waitFor(() => {
      expect(alanHatasi('Ad')).toBe('Ad boş olamaz');
    });
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('101 karakterlik ad backend çağrılmadan alan hatası verir', async () => {
    goster();

    await gonder('a'.repeat(101));

    await vi.waitFor(() => {
      expect(alanHatasi('Ad')).toBe('Ad en çok 100 karakter olabilir');
    });
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});

describe('YeniRolSayfasi hatalar', () => {
  it('409 cakisma dönünce backend\'in iletisi formun üstünde görünür', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap({ kod: 'cakisma', ileti: 'Bu adla bir rol var', ayrinti: null }, 409),
    );
    goster();

    await gonder('Muhasebe');

    expect((await screen.findByRole('alert')).textContent).toBe('Bu adla bir rol var');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce yetki iletisi formun üstünde görünür', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap({ kod: 'yetki_yok', ileti: 'Yetki yok', ayrinti: null }, 403),
    );
    goster();

    await gonder('Muhasebe');

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('YeniRolSayfasi yetki', () => {
  it('Rol olustur kuralı olmayan kişi formu görmez', () => {
    goster([{ action: 'oku', subject: 'Rol' }]);

    expect(screen.queryByRole('button', { name: 'Rolü oluştur' })).toBeNull();
    expect(screen.queryByLabelText('Ad')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Bu iş için yetkin yok');
  });
});
