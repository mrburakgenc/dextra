import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parolaDegistir } from '../../../features/kimlik/eylemler';
import { BOS_FORM_DURUMU } from '../../../features/kimlik/form-durumu';
import ParolaSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek sayfa, gerçek Server Action ve gerçek backend isteği sahte çerez deposu ve sahte fetch ile
// koşar.
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

const ESKI = 'eski-parola-0123';
const YENI = 'yeni-parola-012345';
const ALANLAR = ['Eski parola', 'Yeni parola', 'Yeni parola (tekrar)'] as const;

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

function girdi(etiket: string): HTMLInputElement {
  const alan = screen.getByLabelText(etiket);
  if (!(alan instanceof HTMLInputElement)) {
    throw new Error(`${etiket} bir girdi değil`);
  }
  return alan;
}

async function doldurVeGonder(eski: string, yeni: string, tekrar: string) {
  await userEvent.type(girdi('Eski parola'), eski);
  await userEvent.type(girdi('Yeni parola'), yeni);
  await userEvent.type(girdi('Yeni parola (tekrar)'), tekrar);
  await userEvent.click(screen.getByRole('button', { name: 'Parolamı değiştir' }));
}

function form(alanlar: Record<string, string>): FormData {
  const veri = new FormData();
  for (const [ad, deger] of Object.entries(alanlar)) {
    veri.set(ad, deger);
  }
  return veri;
}

async function alanlarBosalinca() {
  await vi.waitFor(() => {
    expect(ALANLAR.map((etiket) => girdi(etiket).value)).toEqual(['', '', '']);
  });
}

beforeEach(() => {
  vi.stubEnv('BACKEND_ADRESI', 'http://backend.sinama:3001');
  vi.stubEnv('ARACI_KATMAN_SIRRI', 'sinama-sirri-0123456789abcdefghijklmnop');
  vi.stubGlobal('fetch', sahteFetch);
  depo.get.mockImplementation((ad: string) =>
    ad === 'dextra_erisim' ? { name: ad, value: 'erisim' } : undefined,
  );
  render(<ParolaSayfasi />);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  sahteFetch.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe('ParolaSayfasi form', () => {
  it('üç alan parola girdisidir ve uygun otomatik tamamlama değerini taşır', () => {
    expect(
      ALANLAR.map((etiket) => [
        girdi(etiket).type,
        girdi(etiket).getAttribute('autocomplete'),
      ]),
    ).toEqual([
      ['password', 'current-password'],
      ['password', 'new-password'],
      ['password', 'new-password'],
    ]);
  });

  it('14 karakterlik yeni parola backend çağrılmadan alanın yanında hata verir', async () => {
    await doldurVeGonder(ESKI, 'a'.repeat(14), 'a'.repeat(14));

    const hata = await screen.findByText('Parola en az 15 karakter olmalı');
    expect(girdi('Yeni parola').getAttribute('aria-describedby')).toBe(hata.id);
    expect(sahteFetch).not.toHaveBeenCalled();
    await alanlarBosalinca();
  });

  it('uyuşmayan tekrar backend çağrılmadan tekrar alanının yanında hata verir', async () => {
    await doldurVeGonder(ESKI, YENI, `${YENI}x`);

    const hata = await screen.findByText('Parolalar birbirini tutmuyor');
    expect(girdi('Yeni parola (tekrar)').getAttribute('aria-describedby')).toBe(hata.id);
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});

describe('ParolaSayfasi backend', () => {
  it('geçerli girdide backend\'e oturumlu POST gider, gövdede tekrar yoktur', async () => {
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ kod: 'cakisma', ileti: 'Parola başka yoldan değişti', ayrinti: null }, 409),
    );

    await doldurVeGonder(ESKI, YENI, YENI);

    await screen.findByRole('alert');
    expect(istekler()).toEqual([
      {
        yol: '/kimlik/parola/degistir',
        yontem: 'POST',
        govde: { eskiParola: ESKI, yeniParola: YENI },
      },
    ]);
    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
  });

  it('backend\'in eskiParola hatası o alanın yanında görünür; üç alan boşalır', async () => {
    sahteFetch.mockResolvedValueOnce(
      jsonCevap(
        {
          kod: 'dogrulama_hatasi',
          ileti: 'Doğrulama hatası',
          ayrinti: [{ alan: 'eskiParola', neden: 'Eski parola yanlış' }],
        },
        400,
      ),
    );

    await doldurVeGonder(ESKI, YENI, YENI);

    const hata = await screen.findByText('Eski parola yanlış');
    expect(girdi('Eski parola').getAttribute('aria-describedby')).toBe(hata.id);
    expect(girdi('Eski parola').getAttribute('aria-invalid')).toBe('true');
    await alanlarBosalinca();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('409 dönünce backend\'in iletisi görünür; üç alan boşalır ve çerezler silinmez', async () => {
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ kod: 'cakisma', ileti: 'Parola başka yoldan değişti', ayrinti: null }, 409),
    );

    await doldurVeGonder(ESKI, YENI, YENI);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Parola başka yoldan değişti',
    );
    await alanlarBosalinca();
    expect(depo.delete).not.toHaveBeenCalled();
  });

  it('403 dönünce yetki iletisi görünür', async () => {
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ kod: 'yetki_yok', ileti: 'Yetki yok', ayrinti: null }, 403),
    );

    await doldurVeGonder(ESKI, YENI, YENI);

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
  });

  it('parola hiçbir tarayıcı deposuna yazılmaz', async () => {
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ kod: 'cakisma', ileti: 'Parola başka yoldan değişti', ayrinti: null }, 409),
    );

    await doldurVeGonder(ESKI, YENI, YENI);

    await screen.findByRole('alert');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain(YENI);
  });
});

// Başarıdaki yönlendirme çatının işidir; iş doğrudan çağrılarak sınanır.
describe('parolaDegistir başarı ve oturum', () => {
  it('204\'te üç oturum çerezi silinir ve notlu giriş adresine yönlendirilir', async () => {
    sahteFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      parolaDegistir(
        BOS_FORM_DURUMU,
        form({ eskiParola: ESKI, yeniParola: YENI, yeniParolaTekrar: YENI }),
      ),
    ).rejects.toThrow('yonlendirildi:/giris?parola=degisti');

    expect(istekler()).toEqual([
      {
        yol: '/kimlik/parola/degistir',
        yontem: 'POST',
        govde: { eskiParola: ESKI, yeniParola: YENI },
      },
    ]);
    expect(depo.delete.mock.calls.map(([ad]: unknown[]) => ad)).toEqual([
      'dextra_erisim',
      'dextra_yenileme',
      'dextra_cihaz',
    ]);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/giris?parola=degisti');
  });

  it('401 dönünce çerezler silinir ve giriş ekranına dönülür', async () => {
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ kod: 'kimlik_gerekli', ileti: 'Oturum gerekli', ayrinti: null }, 401),
    );

    await expect(
      parolaDegistir(
        BOS_FORM_DURUMU,
        form({ eskiParola: ESKI, yeniParola: YENI, yeniParolaTekrar: YENI }),
      ),
    ).rejects.toThrow('yonlendirildi:/giris');

    expect(depo.delete).toHaveBeenCalledTimes(3);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/giris');
  });
});
