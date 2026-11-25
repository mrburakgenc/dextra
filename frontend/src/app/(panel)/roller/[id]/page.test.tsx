import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import RolSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek sayfa, gerçek Server Action'lar ve gerçek backend isteği sahte çerez deposu ve sahte
// fetch ile koşar.
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

function bosCevap(): Response {
  return new Response(null, { status: 204 });
}

function hataCevabi(kod: string, ileti: string, durum: number): Response {
  return jsonCevap({ kod, ileti, ayrinti: null }, durum);
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

const ID = '7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const YOL = `/kimlik/rol/${ID}`;

const ROL = { id: ID, kod: null, ad: 'Muhasebe' };
const SISTEM_ROLU = { id: ID, kod: 'yonetici', ad: 'Yönetici' };

const ISLER = ['guncelle', 'sil'];

function kurallar(...isler: string[]): YetkiKurali[] {
  return isler.map((action) => ({ action, subject: 'Rol' }));
}

function isHaric(is: string): YetkiKurali[] {
  return kurallar(...ISLER.filter((ad) => ad !== is));
}

async function sayfa(yetki: YetkiKurali[], id = ID) {
  return (
    <YetkiSaglayici kurallar={yetki}>
      <Yakalayici>{await RolSayfasi({ params: Promise.resolve({ id }) })}</Yakalayici>
    </YetkiSaglayici>
  );
}

// Sayfa kaydı backend'den okur; ilk fetch cevabı kayıttır.
async function goster(kayit: object, yetki: YetkiKurali[] = kurallar(...ISLER)) {
  sahteFetch.mockResolvedValueOnce(jsonCevap(kayit, 200));
  return render(await sayfa(yetki));
}

// Backend'e giden isteklerin yolu, yöntemi ve gövdesi.
function istekler() {
  return sahteFetch.mock.calls.map(([adres, init]) => {
    if (!(adres instanceof URL)) {
      throw new Error('backend isteği URL nesnesiyle atılmadı');
    }
    const govde: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    return { yol: adres.pathname, yontem: init?.method, govde };
  });
}

function kayitSatirlari(): string[][] {
  const etiketler = screen.getAllByRole('term').map((t) => t.textContent);
  const degerler = screen.getAllByRole('definition').map((d) => d.textContent);
  return etiketler.map((etiket, sira) => [etiket, degerler[sira] ?? '']);
}

function dugme(ad: string) {
  return screen.queryByRole('button', { name: ad });
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
  // Kullanılmadan kalan sıralı cevaplar sonraki teste geçmesin.
  sahteFetch.mockReset();
});

describe('RolSayfasi kayıt', () => {
  it('backend\'e oturumlu GET isteği atar ve kaydın kolonlarını gösterir', async () => {
    await goster(SISTEM_ROLU);

    expect(istekler()).toEqual([{ yol: YOL, yontem: 'GET', govde: null }]);
    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Yönetici');
    expect(kayitSatirlari()).toEqual([
      ['Ad', 'Yönetici'],
      ['Kod', 'yonetici'],
    ]);
  });

  it('kolonu gelmeyen alanlar boş işaretle görünür; kodu gelmeyen kayıtta sil görünmez', async () => {
    await goster({ id: ID });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rol');
    expect(kayitSatirlari()).toEqual([
      ['Ad', '—'],
      ['Kod', '—'],
    ]);
    expect(dugme('Sil')).toBeNull();
  });

  it('404 bulunamadi dönünce Kayıt bulunamadı iletisi gösterilir', async () => {
    sahteFetch.mockResolvedValueOnce(hataCevabi('bulunamadi', 'Bulunamadı', 404));

    render(await sayfa(kurallar(...ISLER)));

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('uuid olmayan kimlikte backend çağrılmadan Kayıt bulunamadı gösterilir', async () => {
    render(await sayfa(kurallar(...ISLER), '..'));

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401),
    );

    await expect(RolSayfasi({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });
});

describe('RolSayfasi ad', () => {
  it('değişiklik backend\'e PATCH ile kırpılmış adla gider ve sayfa tazelenir', async () => {
    await goster(ROL);
    sahteFetch.mockResolvedValueOnce(bosCevap());

    await userEvent.type(screen.getByLabelText('Yeni ad'), ' Finans ');
    await userEvent.click(screen.getByRole('button', { name: 'Adını değiştir' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[1]).toEqual({ yol: YOL, yontem: 'PATCH', govde: { ad: 'Finans' } });
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster(ROL);
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.type(screen.getByLabelText('Yeni ad'), 'Finans');
    await userEvent.click(screen.getByRole('button', { name: 'Adını değiştir' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('409 cakisma dönünce backend\'in iletisi görünür', async () => {
    await goster(ROL);
    sahteFetch.mockResolvedValueOnce(hataCevabi('cakisma', 'Bu adla bir rol var', 409));

    await userEvent.type(screen.getByLabelText('Yeni ad'), 'Finans');
    await userEvent.click(screen.getByRole('button', { name: 'Adını değiştir' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu adla bir rol var');
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('RolSayfasi sil', () => {
  it('ilk düğme onay satırını açar ve backend henüz çağrılmamıştır; onaydan sonra DELETE gider ve listeye döner', async () => {
    // React, hata sınırının yakaladığı yönlendirmeyi günlüğe yazar.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(ROL);

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));

    expect(screen.getByText('Rol silinsin mi?')).toBeDefined();
    expect(sahteFetch).toHaveBeenCalledTimes(1);

    sahteFetch.mockResolvedValueOnce(bosCevap());
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect(await screen.findByText('yonlendirildi:/roller')).toBeDefined();
    expect(istekler()[1]).toEqual({ yol: YOL, yontem: 'DELETE', govde: null });
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/roller');
  });

  it('Vazgeç onay satırını kapatır ve backend çağrılmaz', async () => {
    await goster(ROL);

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(screen.queryByText('Rol silinsin mi?')).toBeNull();
    expect(dugme('Sil')).not.toBeNull();
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });

  it('409 cakisma (dolu rol) dönünce backend\'in iletisi görünür ve listeye dönülmez', async () => {
    await goster(ROL);
    sahteFetch.mockResolvedValueOnce(hataCevabi('cakisma', 'Rolün üyesi var', 409));

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Rolün üyesi var');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster(ROL);
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sistem rolünde (kodu dolu) sil düğmesi yoktur', async () => {
    await goster(SISTEM_ROLU);

    expect(dugme('Sil')).toBeNull();
    expect(screen.queryByLabelText('Yeni ad')).not.toBeNull();
  });
});

describe('RolSayfasi yetki', () => {
  it('bütün kurallar varken ad formu ve sil görünür', async () => {
    await goster(ROL);

    expect(screen.queryByRole('form', { name: 'Adını değiştir' })).not.toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('guncelle kuralı olmayan kişi ad formunu görmez', async () => {
    await goster(ROL, isHaric('guncelle'));

    expect(screen.queryByRole('form', { name: 'Adını değiştir' })).toBeNull();
    expect(screen.queryByLabelText('Yeni ad')).toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('sil kuralı olmayan kişi sil düğmesini görmez', async () => {
    await goster(ROL, isHaric('sil'));

    expect(dugme('Sil')).toBeNull();
    expect(screen.queryByLabelText('Yeni ad')).not.toBeNull();
  });
});
