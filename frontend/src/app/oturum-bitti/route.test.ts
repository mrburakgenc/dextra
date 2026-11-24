// @vitest-environment node
import { redirect } from 'next/navigation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('server-only', () => ({}));
// Gerçek çerez modülü sahte çerez deposuyla koşar.
const depo = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(depo) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((yol: string) => {
    throw new Error(`yonlendirildi:${yol}`);
  }),
}));

const sahteFetch = vi.fn<typeof fetch>();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('/oturum-bitti', () => {
  it('üç oturum çerezini siler ve /giris adresine yönlendirir; backend\'e istek atmaz', async () => {
    vi.stubGlobal('fetch', sahteFetch);

    await expect(GET()).rejects.toThrow('yonlendirildi:/giris');

    expect(depo.delete.mock.calls).toEqual([
      ['dextra_erisim'],
      ['dextra_yenileme'],
      ['dextra_cihaz'],
    ]);
    expect(depo.set).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/giris');
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});
