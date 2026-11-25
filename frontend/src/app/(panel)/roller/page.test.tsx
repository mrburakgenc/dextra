import { cleanup, render, screen, within } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YetkiKurali } from '../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../shared/yetki/yetki-saglayici';
import RollerSayfasi from './page';

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

// Birincisi sistem rolü (kodu dolu), ikincisi değil.
const IKI_KAYIT = [
  { id: 'r1', kod: 'yonetici', ad: 'Yönetici' },
  { id: 'r2', kod: null, ad: 'Muhasebe' },
];

function listeCevabi(
  ek: Partial<{ kayitlar: unknown[]; sayfa: number; sonrakiVar: boolean }> = {},
) {
  return jsonCevap(
    { kayitlar: IKI_KAYIT, sayfa: 1, boyut: 20, sonrakiVar: false, ...ek },
    200,
  );
}

// Rolleri bütün kolonlarıyla okuyabilen kişi.
const OKU: YetkiKurali[] = [{ action: 'oku', subject: 'Rol' }];

// Sayfa korumalı düzenin yetki sağlayıcısı içinde çizilir; kural verilmezse kişi rolleri okuyabilir
// (liste kolonları tür düzeyindeki okuma kuralına göre çizilir).
async function goster(
  sorgu: Record<string, string | string[]> = {},
  kurallar: YetkiKurali[] = OKU,
) {
  render(
    <YetkiSaglayici kurallar={kurallar}>
      {await RollerSayfasi({ searchParams: Promise.resolve(sorgu) })}
    </YetkiSaglayici>,
  );
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

describe('RollerSayfasi liste', () => {
  it('iki kaydı tabloya döker; kodu dolu rol sistem rolü olarak işaretlenir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    const tablo = screen.getByRole('table', { name: /Roller/ });
    expect(
      within(tablo)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Ad', 'Kod']);
    const [, ilk, ikinci] = within(tablo).getAllByRole('row');
    expect(hucreler(ilk)).toEqual(['Yönetici', 'yonetici sistem rolü']);
    expect(within(ilk ?? tablo).getByText('sistem rolü')).toBeDefined();
    expect(hucreler(ikinci)).toEqual(['Muhasebe', '—']);
    expect(within(ikinci ?? tablo).queryByText('sistem rolü')).toBeNull();
  });

  it('kayıtta gelmeyen kolon boş işaretle gösterilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ kayitlar: [{ id: 'r3' }] }));

    await goster();

    // Ad gelmeyince bağlantı kalır, yazısı kısaltılmış kimliktir (sekizden kısa kimlik olduğu gibi).
    const [, satir] = screen.getAllByRole('row');
    expect(hucreler(satir)).toEqual(['r3', '—']);
    expect(baglanti('r3')).toBe('/roller/r3');
  });

  it('backend\'e oturumlu GET isteği atar', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(istekAdresi().pathname).toBe('/kimlik/rol');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer erisim',
    );
  });
});

describe('RollerSayfasi bağlantılar', () => {
  it('her satırın adı kayıt sayfasına bağlantıdır', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    expect(baglanti('Yönetici')).toBe('/roller/r1');
    expect(baglanti('Muhasebe')).toBe('/roller/r2');
  });

  it('Rol olustur kuralı olan kişi Yeni rol bağlantısını görür', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'olustur', subject: 'Rol' }]);

    expect(baglanti('Yeni rol')).toBe('/roller/yeni');
  });

  it('Rol olustur kuralı olmayan kişi Yeni rol bağlantısını görmez', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Rol' }]);

    expect(screen.queryByRole('link', { name: 'Yeni rol' })).toBeNull();
  });
});

describe('RollerSayfasi sorgu ve gezinti', () => {
  it('adresteki sayfa ve sıralama backend isteğine aynen gider', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2 }));

    await goster({ sayfa: '2', sirala: '-kod' });

    expect(istekAdresi().search).toBe('?sayfa=2&sirala=-kod');
  });

  it('geçersiz sayfa ve sıralama varsayılana döner', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({ sayfa: 'abc', sirala: 'olusturmaZamani' });

    expect(istekAdresi().search).toBe('?sayfa=1');
  });

  it('sıralama başlıkları yönü çevirir ve ilk sayfaya döner', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2 }));

    await goster({ sayfa: '2', sirala: 'ad' });

    expect(baglanti('Ad')).toBe('/roller?sirala=-ad');
    expect(baglanti('Kod')).toBe('/roller?sirala=kod');
    expect(
      screen.getByRole('columnheader', { name: /Ad/ }).getAttribute('aria-sort'),
    ).toBe('ascending');
  });

  it('Önceki ve Sonraki sıralamayı koruyarak sayfa değiştirir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2, sonrakiVar: true }));

    await goster({ sayfa: '2', sirala: '-ad' });

    expect(baglanti('Önceki')).toBe('/roller?sayfa=1&sirala=-ad');
    expect(baglanti('Sonraki')).toBe('/roller?sayfa=3&sirala=-ad');
  });
});

describe('RollerSayfasi durumlar', () => {
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
      RollerSayfasi({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('yonlendirildi:/oturum-bitti');
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });

  it('erişim çerezi yok, yenileme ve cihaz çerezi varken backend çağrılmaz; ulaşılamıyor iletisi gösterilir', async () => {
    depo.get.mockImplementation((ad: string) =>
      ad === 'dextra_yenileme' || ad === 'dextra_cihaz'
        ? { name: ad, value: 'deger' }
        : undefined,
    );

    await goster();

    expect(screen.getByRole('alert').textContent).toBe('Şu an ulaşılamıyor');
    expect(sahteFetch).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(depo.delete).not.toHaveBeenCalled();
  });

  it('üç çerez de yokken backend çağrılmaz; /oturum-bitti yoluna yönlendirir', async () => {
    depo.get.mockReturnValue(undefined);

    await expect(
      RollerSayfasi({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('yonlendirildi:/oturum-bitti');
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});

// Kolonun çizilip çizilmeyeceğini ekran tür düzeyindeki okuma kuralına sorar (TS-004 "Yönetim
// ekranları").
function basliklar(): (string | null)[] {
  return screen.getAllByRole('columnheader').map((h) => h.textContent);
}

// Her kayıt satırının hücre sayısı.
function hucreSayilari(): number[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((satir) => within(satir).getAllByRole('cell').length);
}

describe('RollerSayfasi kolonların yetkisi', () => {
  it('kodu okuma kuralı olmayan kişide kolonun başlığı, sıralama bağlantısı ve hücreleri yoktur', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Rol', fields: ['ad'] }]);

    expect(basliklar()).toEqual(['Ad']);
    expect(screen.queryByRole('link', { name: 'Kod' })).toBeNull();
    expect(screen.queryByText('sistem rolü')).toBeNull();
    expect(hucreSayilari()).toEqual([1, 1]);
  });

  it('kodu bir kuralla okuyabilen kişide kolon çizilir; alanı taşımayan kaydın hücresi ve gelmiş boş kod boş işarettir', async () => {
    sahteFetch.mockResolvedValue(
      listeCevabi({ kayitlar: [{ id: 'r3', ad: 'Gizli' }, IKI_KAYIT[1]] }),
    );

    await goster({}, [{ action: 'oku', subject: 'Rol', fields: ['ad', 'kod'] }]);

    expect(basliklar()).toEqual(['Ad', 'Kod']);
    expect(baglanti('Kod')).toBe('/roller?sirala=kod');
    const [, ilk, ikinci] = screen.getAllByRole('row');
    expect(hucreler(ilk)).toEqual(['Gizli', '—']);
    expect(hucreler(ikinci)).toEqual(['Muhasebe', '—']);
    expect(hucreSayilari()).toEqual([2, 2]);
  });

  it('şartı ekrana gelmeyen bir kolona bakan kuralla okuyabilen kişide kolon yine çizilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Rol', conditions: { silinmeZamani: null } }]);

    expect(basliklar()).toEqual(['Ad', 'Kod']);
    expect(hucreSayilari()).toEqual([2, 2]);
  });
});
