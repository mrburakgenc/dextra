import { cleanup, render, screen, within } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YetkiKurali } from '../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../shared/yetki/yetki-saglayici';
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

// İzinleri bütün kolonlarıyla okuyabilen kişi.
const OKU: YetkiKurali[] = [{ action: 'oku', subject: 'Izin' }];

// Sayfa korumalı düzenin yetki sağlayıcısı içinde çizilir; kural verilmezse kişi izinleri okuyabilir
// (liste kolonları tür düzeyindeki okuma kuralına göre çizilir).
async function goster(
  sorgu: Record<string, string | string[]> = {},
  kurallar: YetkiKurali[] = OKU,
) {
  render(
    <YetkiSaglayici kurallar={kurallar}>
      {await IzinlerSayfasi({ searchParams: Promise.resolve(sorgu) })}
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

  // İzin adları katalogdan gelir; ekran hiçbir izne ayrı ad yazmaz (TS-008: yasakla ve teshis).
  it('yasakla ve teshis izinleri öbür izinler gibi kaynak ve eylemiyle yazılır', async () => {
    sahteFetch.mockResolvedValue(
      listeCevabi({
        kayitlar: [
          ...IKI_KAYIT,
          { id: 'i3', kaynak: 'Yetenek', eylem: 'yasakla' },
          { id: 'i4', kaynak: 'Yetenek', eylem: 'teshis' },
        ],
      }),
    );

    await goster();

    const [, , , ucuncu, dorduncu] = screen.getAllByRole('row');
    expect(hucreler(ucuncu)).toEqual(['Yetenek', 'yasakla']);
    expect(hucreler(dorduncu)).toEqual(['Yetenek', 'teshis']);
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

describe('IzinlerSayfasi kolonların yetkisi', () => {
  it('eylemi okuma kuralı olmayan kişide kolonun başlığı, sıralama bağlantısı ve hücreleri yoktur', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Izin', fields: ['kaynak'] }]);

    expect(basliklar()).toEqual(['Kaynak']);
    expect(screen.queryByRole('link', { name: 'Eylem' })).toBeNull();
    expect(screen.queryByText('olustur')).toBeNull();
    expect(hucreSayilari()).toEqual([1, 1]);
  });

  it('eylemi bir kuralla okuyabilen kişide kolon çizilir; alanı taşımayan kaydın hücresi boş işarettir', async () => {
    sahteFetch.mockResolvedValue(
      listeCevabi({ kayitlar: [IKI_KAYIT[0], { id: 'i3', kaynak: 'Grup' }] }),
    );

    await goster({}, [{ action: 'oku', subject: 'Izin', fields: ['kaynak', 'eylem'] }]);

    expect(basliklar()).toEqual(['Kaynak', 'Eylem']);
    expect(baglanti('Eylem')).toBe('/izinler?sirala=eylem');
    const [, ilk, ikinci] = screen.getAllByRole('row');
    expect(hucreler(ilk)).toEqual(['Kullanici', 'oku']);
    expect(hucreler(ikinci)).toEqual(['Grup', '—']);
    expect(hucreSayilari()).toEqual([2, 2]);
  });

  it('şartı ekrana gelmeyen bir kolona bakan kuralla okuyabilen kişide kolonlar yine çizilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [
      {
        action: 'oku',
        subject: 'Izin',
        conditions: { yetenekler: { some: { silinmeZamani: null } } },
      },
    ]);

    expect(basliklar()).toEqual(['Kaynak', 'Eylem']);
    expect(hucreSayilari()).toEqual([2, 2]);
  });
});
