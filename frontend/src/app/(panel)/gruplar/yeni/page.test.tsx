import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import YeniGrupSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek sayfa, gerçek Server Action ve gerçek backend isteği sahte çerez deposu ve sahte fetch
// ile koşar.
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

const KOK = '11111111-1111-4111-8111-111111111111';
const ALT = '22222222-2222-4222-8222-222222222222';
const YENI = '33333333-3333-4333-8333-333333333333';
const OLUSTURUR: YetkiKurali[] = [{ action: 'olustur', subject: 'Grup' }];

function listeCevabi(sonrakiVar = false): Response {
  return jsonCevap(
    {
      kayitlar: [
        { id: KOK, ustGrupId: null, ad: 'Merkez' },
        { id: ALT, ustGrupId: KOK, ad: 'Muhasebe' },
      ],
      sayfa: 1,
      boyut: 100,
      sonrakiVar,
    },
    200,
  );
}

// Sayfa üst grup seçimini backend'den okur; ilk fetch cevabı grup listesidir.
async function goster(
  sorgu: Record<string, string> = {},
  kurallar: YetkiKurali[] = OLUSTURUR,
  liste: Response = listeCevabi(),
) {
  sahteFetch.mockResolvedValueOnce(liste);
  render(
    <YetkiSaglayici kurallar={kurallar}>
      <Yakalayici>
        {await YeniGrupSayfasi({ searchParams: Promise.resolve(sorgu) })}
      </Yakalayici>
    </YetkiSaglayici>,
  );
}

async function gonder(ad: string, ustGrup: string | null) {
  if (ad !== '') {
    await userEvent.type(screen.getByLabelText('Ad'), ad);
  }
  if (ustGrup !== null) {
    await userEvent.selectOptions(screen.getByLabelText('Üst grup'), ustGrup);
  }
  await userEvent.click(screen.getByRole('button', { name: 'Grubu oluştur' }));
}

// Backend'e giden isteklerin adresi, yöntemi ve gövdesi.
function istekler() {
  return sahteFetch.mock.calls.map(([adres, init]) => {
    if (!(adres instanceof URL)) {
      throw new Error('backend isteği URL nesnesiyle atılmadı');
    }
    const govde: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    return { yol: `${adres.pathname}${adres.search}`, yontem: init?.method, govde };
  });
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

function seciliUstGrup(): string {
  const secim = screen.getByLabelText('Üst grup');
  if (!(secim instanceof HTMLSelectElement)) {
    throw new Error('üst grup seçimi select değil');
  }
  return secim.value;
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

describe('YeniGrupSayfasi üst grup seçimi', () => {
  it('seçenekler grup listesinin ilk 100 kaydından kurulur; adreste üst grup yoksa seçili grup yoktur', async () => {
    await goster();

    expect(istekler()).toEqual([
      { yol: '/kimlik/grup?sayfa=1&boyut=100', yontem: 'GET', govde: null },
    ]);
    const secenekler = within(screen.getByLabelText('Üst grup'))
      .getAllByRole('option')
      .map((secenek) => secenek.textContent);
    expect(secenekler).toEqual(['Seç', 'Merkez', 'Muhasebe']);
    expect(seciliUstGrup()).toBe('');
    expect(screen.queryByText('İlk 100 grup gösteriliyor')).toBeNull();
  });

  it('adresteki ustGrupId ön seçili gelir', async () => {
    await goster({ ustGrupId: ALT });

    expect(seciliUstGrup()).toBe(ALT);
  });

  it('daha fazla grup varsa seçimin altında not gösterilir', async () => {
    await goster({}, OLUSTURUR, listeCevabi(true));

    expect(screen.getByText('İlk 100 grup gösteriliyor')).toBeDefined();
  });

  it('grup listesi 403 dönerse form yerine yetki iletisi gösterilir', async () => {
    await goster({}, OLUSTURUR, hataCevabi('yetki_yok', 'Yetki yok', 403));

    expect(screen.getByRole('alert').textContent).toBe('Bu sayfayı görme yetkin yok');
    expect(screen.queryByRole('button', { name: 'Grubu oluştur' })).toBeNull();
  });
});

describe('YeniGrupSayfasi başarı', () => {
  it('ad ve seçilen üst grup POST kimlik/grup gövdesine gider ve kayıt sayfasına yönlendirir', async () => {
    // React, hata sınırının yakaladığı yönlendirmeyi günlüğe yazar.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster({ ustGrupId: KOK });
    sahteFetch.mockResolvedValueOnce(jsonCevap({ id: YENI }, 201));

    await gonder('  Satış ', 'Muhasebe');

    expect(await screen.findByText(`yonlendirildi:/gruplar/${YENI}`)).toBeDefined();
    expect(istekler()[1]).toEqual({
      yol: '/kimlik/grup',
      yontem: 'POST',
      govde: { ad: 'Satış', ustGrupId: ALT },
    });
    const [, init] = sahteFetch.mock.calls[1] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
    expect(redirect).toHaveBeenCalledExactlyOnceWith(`/gruplar/${YENI}`);
  });

  it('adresten ön seçili üst grup değiştirilmeden gönderilir', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster({ ustGrupId: KOK });
    sahteFetch.mockResolvedValueOnce(jsonCevap({ id: YENI }, 201));

    await gonder('Satış', null);

    await screen.findByText(`yonlendirildi:/gruplar/${YENI}`);
    expect(istekler()[1]?.govde).toEqual({ ad: 'Satış', ustGrupId: KOK });
  });
});

describe('YeniGrupSayfasi doğrulama', () => {
  it('boş ad backend çağrılmadan alan hatası verir', async () => {
    await goster();

    await gonder('', 'Merkez');

    await vi.waitFor(() => {
      expect(alanHatasi('Ad')).toBe('Ad boş olamaz');
    });
    expect(alanHatasi('Üst grup')).toBeNull();
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });

  it('101 karakterlik ad backend çağrılmadan alan hatası verir', async () => {
    await goster();

    await gonder('a'.repeat(101), 'Merkez');

    await vi.waitFor(() => {
      expect(alanHatasi('Ad')).toBe('Ad en çok 100 karakter olabilir');
    });
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });

  it('üst grup seçilmezse backend çağrılmadan alan hatası verir', async () => {
    await goster();

    await gonder('Satış', null);

    await vi.waitFor(() => {
      expect(alanHatasi('Üst grup')).toBe('Üst grup seçilmeli');
    });
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });
});

describe('YeniGrupSayfasi hatalar', () => {
  it('409 cakisma dönünce backend\'in iletisi formun üstünde görünür', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('cakisma', 'Üst grup silinmiş', 409));

    await gonder('Satış', 'Merkez');

    expect((await screen.findByRole('alert')).textContent).toBe('Üst grup silinmiş');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce yetki iletisi formun üstünde görünür', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await gonder('Satış', 'Merkez');

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('YeniGrupSayfasi yazılanın korunması', () => {
  function ad(): string {
    const girdi = screen.getByLabelText('Ad');
    return girdi instanceof HTMLInputElement ? girdi.value : '';
  }

  it('409 dönünce yazılan ad ve seçilen üst grup formda kalır', async () => {
    await goster({ ustGrupId: KOK });
    sahteFetch.mockResolvedValueOnce(hataCevabi('cakisma', 'Üst grup silinmiş', 409));

    await gonder('Satış', 'Muhasebe');

    expect((await screen.findByRole('alert')).textContent).toBe('Üst grup silinmiş');
    expect(ad()).toBe('Satış');
    expect(seciliUstGrup()).toBe(ALT);
  });

  it('alan hatasında seçilen üst grup ve yazılan ad formda kalır', async () => {
    await goster();

    await gonder('a'.repeat(101), 'Muhasebe');

    await vi.waitFor(() => {
      expect(alanHatasi('Ad')).toBe('Ad en çok 100 karakter olabilir');
    });
    expect(ad()).toBe('a'.repeat(101));
    expect(seciliUstGrup()).toBe(ALT);
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });
});

describe('YeniGrupSayfasi yetki', () => {
  it('Grup olustur kuralı olmayan kişi formu görmez', async () => {
    await goster({}, [{ action: 'oku', subject: 'Grup' }]);

    expect(screen.queryByRole('button', { name: 'Grubu oluştur' })).toBeNull();
    expect(screen.queryByLabelText('Ad')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Bu iş için yetkin yok');
  });
});
