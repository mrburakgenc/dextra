import { cleanup, render, screen, within } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tarihSaat } from '../../../shared/bicim/bicim';
import type { YetkiKurali } from '../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../shared/yetki/yetki-saglayici';
import GruplarSayfasi from './page';

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

const KOK = '11111111-1111-4111-8111-111111111111';
const ALT = '22222222-2222-4222-8222-222222222222';
const BASKA = '33333333-3333-4333-8333-333333333333';
const SAYFADA_OLMAYAN = '44444444-4444-4444-8444-444444444444';
const OLUSTURMA = '2026-01-15T10:30:00.000Z';

// Kök grup, aynı sayfadaki üst grubu olan grup ve üst grubu sayfada olmayan grup.
const UC_KAYIT = [
  { id: KOK, ustGrupId: null, ad: 'Merkez', olusturmaZamani: OLUSTURMA },
  { id: ALT, ustGrupId: KOK, ad: 'Muhasebe', olusturmaZamani: OLUSTURMA },
  {
    id: BASKA,
    ustGrupId: SAYFADA_OLMAYAN,
    ad: 'Satış',
    olusturmaZamani: OLUSTURMA,
  },
];

function listeCevabi(
  ek: Partial<{ kayitlar: unknown[]; sayfa: number; sonrakiVar: boolean }> = {},
) {
  return jsonCevap(
    { kayitlar: UC_KAYIT, sayfa: 1, boyut: 20, sonrakiVar: false, ...ek },
    200,
  );
}

// Grupları bütün kolonlarıyla okuyabilen kişi.
const OKU: YetkiKurali[] = [{ action: 'oku', subject: 'Grup' }];

// Sayfa korumalı düzenin yetki sağlayıcısı içinde çizilir; kural verilmezse kişi grupları
// okuyabilir (liste kolonları tür düzeyindeki okuma kuralına göre çizilir).
async function goster(
  sorgu: Record<string, string | string[]> = {},
  kurallar: YetkiKurali[] = OKU,
) {
  render(
    <YetkiSaglayici kurallar={kurallar}>
      {await GruplarSayfasi({ searchParams: Promise.resolve(sorgu) })}
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

// Adı verilen grubun satırındaki 'Alt gruplar' bağlantısının adresi.
function altGruplar(ad: string): string | null {
  const satir = screen.getByRole('link', { name: ad }).closest('tr');
  return within(satir ?? document.body)
    .getByRole('link', { name: 'Alt gruplar' })
    .getAttribute('href');
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

describe('GruplarSayfasi liste', () => {
  it('üst grup adı aynı sayfadaki kayıttan gösterilir; kök grupta boş işaret, sayfada olmayan üst grupta kısaltılmış kimlik', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    const tablo = screen.getByRole('table', { name: /Gruplar/ });
    expect(
      within(tablo)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Ad', 'Üst grup', 'Oluşturma zamanı', 'Alt gruplar']);
    const [, kok, alt, baska] = within(tablo).getAllByRole('row');
    expect(hucreler(kok)).toEqual([
      'Merkez',
      '—',
      tarihSaat(OLUSTURMA),
      'Alt gruplar',
    ]);
    expect(hucreler(alt)).toEqual([
      'Muhasebe',
      'Merkez',
      tarihSaat(OLUSTURMA),
      'Alt gruplar',
    ]);
    expect(hucreler(baska)).toEqual([
      'Satış',
      '…44444444',
      tarihSaat(OLUSTURMA),
      'Alt gruplar',
    ]);
  });

  it('kayıtta gelmeyen kolonlar boş işaretle gösterilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ kayitlar: [{ id: KOK }] }));

    await goster();

    // Ad gelmeyince bağlantı kalır, yazısı kısaltılmış kimliktir.
    const [, satir] = screen.getAllByRole('row');
    expect(hucreler(satir)).toEqual([`…${KOK.slice(-8)}`, '—', '—', 'Alt gruplar']);
    expect(baglanti(`…${KOK.slice(-8)}`)).toBe(`/gruplar/${KOK}`);
  });

  it('grup adı kayıt sayfasına bağlantıdır', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({ sirala: 'ad' });

    expect(baglanti('Merkez')).toBe(`/gruplar/${KOK}`);
    expect(baglanti('Muhasebe')).toBe(`/gruplar/${ALT}`);
  });

  it('backend\'e oturumlu GET isteği atar; sayfa ve sıralama adresten gider', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2 }));

    await goster({ sayfa: '2', sirala: '-olusturmaZamani' });

    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(istekAdresi().pathname).toBe('/kimlik/grup');
    expect(istekAdresi().search).toBe('?sayfa=2&sirala=-olusturmaZamani');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      'Bearer erisim',
    );
  });
});

describe('GruplarSayfasi üst grup süzgeci', () => {
  it('Alt gruplar bağlantısı ustGrupId süzgecini adrese yazar, sıralamayı korur ve ilk sayfaya döner', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2 }));

    await goster({ sayfa: '2', sirala: 'ad' });

    expect(altGruplar('Merkez')).toBe(`/gruplar?sirala=ad&ustGrupId=${KOK}`);
    expect(altGruplar('Muhasebe')).toBe(`/gruplar?sirala=ad&ustGrupId=${ALT}`);
  });

  it('Alt gruplar bağlantısı izlenince ustGrupId backend isteğine gider', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());
    await goster({ sirala: '-ad' });
    const hedef = new URL(altGruplar('Muhasebe') ?? '', 'http://ekran.sinama');
    cleanup();
    sahteFetch.mockClear();

    await goster(Object.fromEntries(hedef.searchParams));

    expect(istekAdresi().search).toBe(`?sayfa=1&sirala=-ad&ustGrupId=${ALT}`);
  });

  it('adresteki ustGrupId backend isteğine gider; sıralama ve sayfa bağlantıları süzgeci korur', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ sayfa: 2, sonrakiVar: true }));

    await goster({ sayfa: '2', sirala: 'ad', ustGrupId: KOK });

    expect(istekAdresi().search).toBe(`?sayfa=2&sirala=ad&ustGrupId=${KOK}`);
    expect(baglanti('Ad')).toBe(`/gruplar?sirala=-ad&ustGrupId=${KOK}`);
    expect(baglanti('Önceki')).toBe(`/gruplar?sayfa=1&sirala=ad&ustGrupId=${KOK}`);
    expect(baglanti('Sonraki')).toBe(`/gruplar?sayfa=3&sirala=ad&ustGrupId=${KOK}`);
  });

  it('Hepsi bağlantısı süzgeci kaldırır ve sıralamayı korur', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({ sirala: 'ad', ustGrupId: KOK });

    const hepsi = screen.getByRole('link', { name: 'Hepsi' });
    expect(hepsi.getAttribute('href')).toBe('/gruplar?sirala=ad');
    expect(hepsi.getAttribute('aria-current')).toBeNull();
  });

  it('süzgeç yokken Hepsi seçili gösterilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster();

    expect(
      screen.getByRole('link', { name: 'Hepsi' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('geçersiz ustGrupId, sayfa ve sıralama varsayılana döner', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({ sayfa: '0', sirala: 'kod', ustGrupId: 'kok&sayfa=9' });

    expect(istekAdresi().search).toBe('?sayfa=1');
  });
});

describe('GruplarSayfasi Yeni grup bağlantısı', () => {
  const OLUSTURUR: YetkiKurali[] = [{ action: 'olustur', subject: 'Grup' }];

  it('Grup olustur kuralı olan kişi Yeni grup bağlantısını görür', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, OLUSTURUR);

    expect(baglanti('Yeni grup')).toBe('/gruplar/yeni');
  });

  it('liste bir grubun altıyla süzülmüşse bağlantı o grubu ustGrupId olarak taşır', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({ sirala: 'ad', ustGrupId: KOK }, OLUSTURUR);

    expect(baglanti('Yeni grup')).toBe(`/gruplar/yeni?ustGrupId=${KOK}`);
  });

  it('Grup olustur kuralı olmayan kişi Yeni grup bağlantısını görmez', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Grup' }]);

    expect(screen.queryByRole('link', { name: 'Yeni grup' })).toBeNull();
  });
});

describe('GruplarSayfasi durumlar', () => {
  it('kayıt yoksa Kayıt yok iletisi gösterilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ kayitlar: [] }));

    await goster({ ustGrupId: KOK });

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
      GruplarSayfasi({ searchParams: Promise.resolve({}) }),
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

describe('GruplarSayfasi kolonların yetkisi', () => {
  it('oluşturma zamanını okuma kuralı olmayan kişide kolonun başlığı, sıralama bağlantısı ve hücreleri yoktur', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Grup', fields: ['ad', 'ustGrupId'] }]);

    expect(basliklar()).toEqual(['Ad', 'Üst grup', 'Alt gruplar']);
    expect(screen.queryByRole('link', { name: 'Oluşturma zamanı' })).toBeNull();
    expect(screen.queryByText(tarihSaat(OLUSTURMA))).toBeNull();
    expect(hucreSayilari()).toEqual([3, 3, 3]);
  });

  it('oluşturma zamanını bir kuralla okuyabilen kişide kolon çizilir; alanı taşımayan kaydın hücresi boş işarettir', async () => {
    sahteFetch.mockResolvedValue(
      listeCevabi({
        kayitlar: [{ id: KOK, ad: 'Merkez' }, UC_KAYIT[1]],
      }),
    );

    await goster({}, [{ action: 'oku', subject: 'Grup', fields: ['ad', 'olusturmaZamani'] }]);

    expect(basliklar()).toEqual(['Ad', 'Oluşturma zamanı', 'Alt gruplar']);
    expect(baglanti('Oluşturma zamanı')).toBe('/gruplar?sirala=olusturmaZamani');
    const [, ilk, ikinci] = screen.getAllByRole('row');
    expect(hucreler(ilk)).toEqual(['Merkez', '—', 'Alt gruplar']);
    expect(hucreler(ikinci)).toEqual(['Muhasebe', tarihSaat(OLUSTURMA), 'Alt gruplar']);
    expect(hucreSayilari()).toEqual([3, 3]);
  });

  it('şartı ekrana gelmeyen bir kolona bakan kuralla okuyabilen kişide kolonlar yine çizilir', async () => {
    sahteFetch.mockResolvedValue(listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Grup', conditions: { silinmeZamani: null } }]);

    expect(basliklar()).toEqual(['Ad', 'Üst grup', 'Oluşturma zamanı', 'Alt gruplar']);
    expect(hucreSayilari()).toEqual([4, 4, 4]);
  });

  it('gelmiş ama boş üst grup boş işaretle çizilir; kolon kalkmaz', async () => {
    sahteFetch.mockResolvedValue(listeCevabi({ kayitlar: [UC_KAYIT[0]] }));

    await goster({}, [{ action: 'oku', subject: 'Grup', fields: ['ad', 'ustGrupId'] }]);

    expect(basliklar()).toEqual(['Ad', 'Üst grup', 'Alt gruplar']);
    const [, satir] = screen.getAllByRole('row');
    expect(hucreler(satir)).toEqual(['Merkez', '—', 'Alt gruplar']);
  });
});
