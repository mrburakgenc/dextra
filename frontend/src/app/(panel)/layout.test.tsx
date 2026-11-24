import { cleanup, render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PanelDuzeni from './layout';

vi.mock('server-only', () => ({}));
// Gerçek çerez modülü sahte çerez deposuyla koşar.
const depo = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(depo) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((yol: string) => {
    throw new Error(`yonlendirildi:${yol}`);
  }),
}));
vi.mock('../../features/kimlik/eylemler', () => ({ cikisYap: vi.fn() }));

const sahteFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', sahteFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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
    depo.get.mockImplementation((ad: string) =>
      ad === 'dextra_erisim' ? { name: ad, value: 'erisim' } : undefined,
    );

    render(await PanelDuzeni({ children: <p>içerik</p> }));

    expect(screen.getByText('içerik')).toBeDefined();
    expect(screen.getByRole('banner').textContent).toContain('Dextra');
    expect(screen.getByRole('button', { name: 'Çıkış' })).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});
