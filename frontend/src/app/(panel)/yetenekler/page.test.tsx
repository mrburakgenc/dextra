import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tarihSaat } from '../../../shared/bicim/bicim';
import type { YetkiKurali } from '../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../shared/yetki/yetki-saglayici';
import YeteneklerSayfasi from './page';

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

function hataCevabi(kod: string, ileti: string, durum: number): Response {
  return jsonCevap({ kod, ileti, ayrinti: null }, durum);
}

const GRUP = '11111111-1111-4111-8111-111111111111';
const ROL = '22222222-2222-4222-8222-222222222222';
const IZIN = '33333333-3333-4333-8333-333333333333';
const ADI_OLMAYAN_GRUP = '44444444-4444-4444-8444-444444444444';
const BUTUN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SARTLI = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OLUSTURMA = '2026-01-15T10:30:00.000Z';

const AD_LISTELERI: Readonly<Record<string, unknown[]>> = {
  '/kimlik/grup': [{ id: GRUP, ad: 'Merkez' }],
  '/kimlik/rol': [{ id: ROL, ad: 'Yönetici' }],
  '/kimlik/izin': [{ id: IZIN, kaynak: 'Kullanici', eylem: 'oku' }],
};

const ORTAK = {
  rolId: ROL,
  izinId: IZIN,
  butunBirimler: false,
  yerineGectigiId: null,
  koken: 'elle',
  olusturmaZamani: OLUSTURMA,
  silinmeZamani: null,
};

// Bütün kayıtları ve kolonları veren sistem satırı; adı bulunamayan gruba bağlı şartlı satır.
const IKI_KAYIT = [
  {
    ...ORTAK,
    id: BUTUN,
    grupId: GRUP,
    sart: null,
    butunKayitlar: true,
    kolonlar: [],
    butunKolonlar: true,
    sistemSatiri: true,
    tohumAnahtari: 'yonetici-butun',
  },
  {
    ...ORTAK,
    id: SARTLI,
    grupId: ADI_OLMAYAN_GRUP,
    sart: [
      { alan: 'kullaniciId', islec: 'esit', deger: { yerTutucu: 'isteyen' } },
      { alan: 'durum', islec: 'listede', deger: ['a', 'b'] },
    ],
    butunKayitlar: false,
    kolonlar: ['ad', 'kod'],
    butunKolonlar: false,
    sistemSatiri: false,
    tohumAnahtari: null,
  },
];

function listeCevabi(ek: Partial<{ kayitlar: unknown[]; sayfa: number; sonrakiVar: boolean }> = {}) {
  return jsonCevap({ kayitlar: IKI_KAYIT, sayfa: 1, boyut: 20, sonrakiVar: false, ...ek }, 200);
}

// Ad listeleri yoldan tanınır; yetenek listesi verilen cevabı alır.
function backend(yetenekCevabi: () => Response, adCevabi?: () => Response) {
  sahteFetch.mockImplementation((adres) => {
    const yol = adres instanceof URL ? adres.pathname : '';
    const adlar = AD_LISTELERI[yol];
    if (adlar === undefined) {
      return Promise.resolve(yetenekCevabi());
    }
    return Promise.resolve(
      adCevabi?.() ??
        jsonCevap({ kayitlar: adlar, sayfa: 1, boyut: 100, sonrakiVar: false }, 200),
    );
  });
}

// Yetenekleri bütün kolonlarıyla okuyabilen kişi.
const OKU: YetkiKurali[] = [{ action: 'oku', subject: 'Yetenek' }];

// Sayfa korumalı düzenin yetki sağlayıcısı içinde çizilir; kural verilmezse kişi yetenekleri
// okuyabilir (liste kolonları tür düzeyindeki okuma kuralına göre çizilir).
async function goster(
  sorgu: Record<string, string | string[]> = {},
  kurallar: YetkiKurali[] = OKU,
) {
  render(
    <YetkiSaglayici kurallar={kurallar}>
      {await YeteneklerSayfasi({ searchParams: Promise.resolve(sorgu) })}
    </YetkiSaglayici>,
  );
}

function istekAdresi(yol: string): URL {
  const adres = sahteFetch.mock.calls
    .map(([istek]) => istek)
    .find((istek) => istek instanceof URL && istek.pathname === yol);
  if (!(adres instanceof URL)) {
    throw new Error(`${yol} isteği atılmadı`);
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
  sahteFetch.mockReset();
});

describe('YeteneklerSayfasi liste', () => {
  it('iki kayıt tabloya dökülür; adlar eşlenir, adı bulunamayan kimlik kısaltılarak görünür', async () => {
    backend(() => listeCevabi());

    await goster();

    const tablo = screen.getByRole('table', { name: /Yetenekler/ });
    expect(
      within(tablo)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      'Grup',
      'Rol',
      'İzin',
      'Kayıt sınırı',
      'Kolon sınırı',
      'Tür',
      'Oluşturma zamanı',
    ]);
    const [, butun, sartli] = within(tablo).getAllByRole('row');
    expect(hucreler(butun)).toEqual([
      'Merkez',
      'Yönetici',
      'Kullanici:oku',
      'Bütün kayıtlar',
      'Bütün kolonlar',
      'Sistem',
      tarihSaat(OLUSTURMA),
    ]);
    expect(hucreler(sartli)).toEqual([
      '…44444444',
      'Yönetici',
      'Kullanici:oku',
      'kullaniciId esit {isteyen} ve durum listede [a, b]',
      'ad, kod',
      '',
      tarihSaat(OLUSTURMA),
    ]);
  });

  it('şartı ve işareti olmayan kayıtta Kayıt vermez ve Kolon vermez görünür; tohum satırı Tohum olur', async () => {
    backend(() =>
      listeCevabi({
        kayitlar: [
          {
            ...IKI_KAYIT[1],
            sart: null,
            kolonlar: [],
            tohumAnahtari: 'okuyucu',
          },
        ],
      }),
    );

    await goster();

    const [, satir] = screen.getAllByRole('row');
    expect(hucreler(satir).slice(3, 6)).toEqual(['Kayıt vermez', 'Kolon vermez', 'Tohum']);
  });

  it('kayıtta gelmeyen kolonların hücresi boş işarettir', async () => {
    backend(() => listeCevabi({ kayitlar: [{ id: SARTLI }] }));

    await goster();

    const [, satir] = screen.getAllByRole('row');
    expect(hucreler(satir)).toEqual(['—', '—', '—', '—', '—', '—', '—']);
  });

  it('izin yazısı kayıt sayfasına bağlantıdır', async () => {
    backend(() => listeCevabi({ kayitlar: [IKI_KAYIT[0]] }));

    await goster();

    expect(baglanti('Kullanici:oku')).toBe(`/yetenekler/${BUTUN}`);
  });

  it('backend\'e oturumlu GET isteği atar; sayfa, sıralama ve süzgeç adresten gider; adlar ilk 100 kayıttan okunur', async () => {
    backend(() => listeCevabi({ sayfa: 2 }));

    await goster({ sayfa: '2', sirala: '-olusturmaZamani', grupId: GRUP, rolId: ROL });

    const istek = sahteFetch.mock.calls.find(
      ([adres]) => adres instanceof URL && adres.pathname === '/kimlik/yetenek',
    );
    expect(istekAdresi('/kimlik/yetenek').search).toBe(
      `?sayfa=2&sirala=-olusturmaZamani&grupId=${GRUP}&rolId=${ROL}`,
    );
    expect(istek?.[1]?.method).toBe('GET');
    expect(new Headers(istek?.[1]?.headers).get('authorization')).toBe('Bearer erisim');
    for (const yol of ['/kimlik/grup', '/kimlik/rol', '/kimlik/izin']) {
      expect(istekAdresi(yol).search).toBe('?sayfa=1&boyut=100');
    }
  });
});

describe('YeteneklerSayfasi süzgeç', () => {
  it('süzgeç seçimi adrese yazılır, sıralamayı korur ve backend isteğine gider', async () => {
    backend(() => listeCevabi());
    await goster({ sirala: 'olusturmaZamani' });

    const form = screen.getByRole('form', { name: 'Süzgeç' });
    expect(form.getAttribute('action')).toBe('/yetenekler');
    await userEvent.selectOptions(within(form).getByLabelText('Grup'), 'Merkez');
    await userEvent.selectOptions(within(form).getByLabelText('Rol'), 'Yönetici');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('form değil');
    }
    const adres = new URLSearchParams();
    for (const [ad, deger] of new FormData(form)) {
      if (typeof deger === 'string') {
        adres.append(ad, deger);
      }
    }
    expect(adres.toString()).toBe(`sirala=olusturmaZamani&grupId=${GRUP}&rolId=${ROL}`);
    cleanup();
    sahteFetch.mockClear();

    await goster(Object.fromEntries(adres));

    expect(istekAdresi('/kimlik/yetenek').search).toBe(
      `?sayfa=1&sirala=olusturmaZamani&grupId=${GRUP}&rolId=${ROL}`,
    );
  });

  it('adresteki süzgeç seçimde seçili gelir; sıralama ve sayfa bağlantıları süzgeci korur', async () => {
    backend(() => listeCevabi({ sayfa: 2, sonrakiVar: true }));

    await goster({ sayfa: '2', grupId: GRUP, rolId: ROL });

    const form = screen.getByRole('form', { name: 'Süzgeç' });
    const grup = within(form).getByLabelText('Grup');
    const rol = within(form).getByLabelText('Rol');
    expect(grup instanceof HTMLSelectElement ? grup.value : null).toBe(GRUP);
    expect(rol instanceof HTMLSelectElement ? rol.value : null).toBe(ROL);
    expect(baglanti('Oluşturma zamanı')).toBe(
      `/yetenekler?sirala=olusturmaZamani&grupId=${GRUP}&rolId=${ROL}`,
    );
    expect(baglanti('Önceki')).toBe(`/yetenekler?sayfa=1&grupId=${GRUP}&rolId=${ROL}`);
    expect(baglanti('Sonraki')).toBe(`/yetenekler?sayfa=3&grupId=${GRUP}&rolId=${ROL}`);
  });

  it('geçersiz süzgeç, sayfa ve sıralama değeri backend\'e gitmez', async () => {
    backend(() => listeCevabi());

    await goster({ sayfa: '0', sirala: 'ad', grupId: 'merkez&rolId=x', rolId: '' });

    expect(istekAdresi('/kimlik/yetenek').search).toBe('?sayfa=1');
  });
});

describe('YeteneklerSayfasi Yeni yetenek bağlantısı', () => {
  it('Yetenek olustur kuralı olan kişi Yeni yetenek bağlantısını görür', async () => {
    backend(() => listeCevabi());

    await goster({}, [{ action: 'olustur', subject: 'Yetenek' }]);

    expect(baglanti('Yeni yetenek')).toBe('/yetenekler/yeni');
  });

  it('Yetenek olustur kuralı olmayan kişi Yeni yetenek bağlantısını görmez', async () => {
    backend(() => listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Yetenek' }]);

    expect(screen.queryByRole('link', { name: 'Yeni yetenek' })).toBeNull();
  });
});

describe('YeteneklerSayfasi durumlar', () => {
  it('kayıt yoksa Kayıt yok iletisi gösterilir', async () => {
    backend(() => listeCevabi({ kayitlar: [] }));

    await goster();

    expect(screen.getByText('Kayıt yok')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('403 yetki_yok dönünce yetki iletisi gösterilir', async () => {
    backend(() => hataCevabi('yetki_yok', 'Yetki yok', 403));

    await goster();

    expect(screen.getByRole('alert').textContent).toBe('Bu sayfayı görme yetkin yok');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('ad listeleri 403 dönünce tablo çizilir, kimlikler kısaltılır; süzgeç seçimlerinin yerinde ileti çıkar', async () => {
    backend(
      () => listeCevabi(),
      () => hataCevabi('yetki_yok', 'Yetki yok', 403),
    );

    await goster();

    const [, butun, sartli] = within(screen.getByRole('table')).getAllByRole('row');
    expect(hucreler(butun).slice(0, 3)).toEqual(['…11111111', '…22222222', '…33333333']);
    expect(hucreler(sartli).slice(0, 3)).toEqual(['…44444444', '…22222222', '…33333333']);
    expect(
      within(butun ?? document.body)
        .getByRole('link', { name: '…33333333' })
        .getAttribute('href'),
    ).toBe(`/yetenekler/${BUTUN}`);
    const suzgec = screen.getByRole('form', { name: 'Süzgeç' });
    expect(within(suzgec).queryByLabelText('Grup')).toBeNull();
    expect(within(suzgec).queryByLabelText('Rol')).toBeNull();
    expect(within(suzgec).getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Grup listesi alınamadı',
      'Rol listesi alınamadı',
    ]);
  });

  it('yalnız izin listesi 403 dönünce izin hücresi kısaltılır; grup ve rol adları ve süzgeç kalır', async () => {
    sahteFetch.mockImplementation((adres) => {
      const yol = adres instanceof URL ? adres.pathname : '';
      if (yol === '/kimlik/izin') {
        return Promise.resolve(hataCevabi('yetki_yok', 'Yetki yok', 403));
      }
      const adlar = AD_LISTELERI[yol];
      return Promise.resolve(
        adlar === undefined
          ? listeCevabi({ kayitlar: [IKI_KAYIT[0]] })
          : jsonCevap({ kayitlar: adlar, sayfa: 1, boyut: 100, sonrakiVar: false }, 200),
      );
    });

    await goster();

    const [, satir] = within(screen.getByRole('table')).getAllByRole('row');
    expect(hucreler(satir).slice(0, 3)).toEqual(['Merkez', 'Yönetici', '…33333333']);
    expect(screen.getByLabelText('Grup')).toBeDefined();
    expect(screen.getByLabelText('Rol')).toBeDefined();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('listede olup ad kolonu gelmeyen grup, rol ve izin kısaltılmış kimlikle görünür', async () => {
    const adsizListeler: Readonly<Record<string, unknown[]>> = {
      '/kimlik/grup': [{ id: GRUP }],
      '/kimlik/rol': [{ id: ROL }],
      '/kimlik/izin': [{ id: IZIN, kaynak: 'Kullanici' }],
    };
    sahteFetch.mockImplementation((adres) => {
      const yol = adres instanceof URL ? adres.pathname : '';
      const adlar = adsizListeler[yol];
      return Promise.resolve(
        adlar === undefined
          ? listeCevabi({ kayitlar: [IKI_KAYIT[0]] })
          : jsonCevap({ kayitlar: adlar, sayfa: 1, boyut: 100, sonrakiVar: false }, 200),
      );
    });

    await goster();

    const [, satir] = within(screen.getByRole('table')).getAllByRole('row');
    expect(hucreler(satir).slice(0, 3)).toEqual(['…11111111', '…22222222', '…33333333']);
  });

  it('grup listesine ulaşılamayınca seçili grup süzgeci formda korunur', async () => {
    backend(
      () => listeCevabi(),
      () => new Response('Bad Gateway', { status: 502 }),
    );

    await goster({ grupId: GRUP });

    const suzgec = screen.getByRole('form', { name: 'Süzgeç' });
    if (!(suzgec instanceof HTMLFormElement)) {
      throw new Error('form değil');
    }
    expect(new FormData(suzgec).get('grupId')).toBe(GRUP);
    expect(istekAdresi('/kimlik/yetenek').searchParams.get('grupId')).toBe(GRUP);
  });

  it('ad listesi 401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    backend(
      () => listeCevabi(),
      () => hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401),
    );

    await expect(YeteneklerSayfasi({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    backend(() => hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401));

    await expect(YeteneklerSayfasi({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
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

describe('YeteneklerSayfasi kolonların yetkisi', () => {
  it('türün iki alanını ve oluşturma zamanını okuma kuralı olmayan kişide kolonların başlığı, sıralama bağlantısı ve hücreleri yoktur', async () => {
    backend(() => listeCevabi());

    await goster({}, [
      {
        action: 'oku',
        subject: 'Yetenek',
        fields: ['grupId', 'rolId', 'izinId', 'butunKayitlar', 'sart', 'butunKolonlar', 'kolonlar'],
      },
    ]);

    expect(basliklar()).toEqual(['Grup', 'Rol', 'İzin', 'Kayıt sınırı', 'Kolon sınırı']);
    expect(screen.queryByRole('link', { name: 'Oluşturma zamanı' })).toBeNull();
    expect(screen.queryByText('Sistem')).toBeNull();
    expect(screen.queryByText(tarihSaat(OLUSTURMA))).toBeNull();
    expect(hucreSayilari()).toEqual([5, 5]);
  });

  it('türün alanlarından birini bir kuralla okuyabilen kişide kolon çizilir; alanları taşımayan kaydın hücresi boş işarettir', async () => {
    backend(() =>
      listeCevabi({ kayitlar: [IKI_KAYIT[0], { id: SARTLI, izinId: IZIN }] }),
    );

    await goster({}, [{ action: 'oku', subject: 'Yetenek', fields: ['izinId', 'tohumAnahtari'] }]);

    expect(basliklar()).toEqual(['İzin', 'Tür']);
    const [, ilk, ikinci] = screen.getAllByRole('row');
    expect(hucreler(ilk)[1]).toBe('Sistem');
    expect(hucreler(ikinci)[1]).toBe('—');
    expect(hucreSayilari()).toEqual([2, 2]);
  });

  it('şartı ekrana gelmeyen bir kolona bakan kuralla okuyabilen kişide kolonlar yine çizilir', async () => {
    backend(() => listeCevabi());

    await goster({}, [{ action: 'oku', subject: 'Yetenek', conditions: { koken: 'elle' } }]);

    expect(basliklar()).toEqual([
      'Grup',
      'Rol',
      'İzin',
      'Kayıt sınırı',
      'Kolon sınırı',
      'Tür',
      'Oluşturma zamanı',
    ]);
    expect(hucreSayilari()).toEqual([7, 7]);
  });

  it('gelmiş ama boş tohum anahtarı kolonu kaldırmaz', async () => {
    backend(() => listeCevabi({ kayitlar: [{ id: SARTLI, izinId: IZIN, tohumAnahtari: null }] }));

    await goster({}, [{ action: 'oku', subject: 'Yetenek', fields: ['izinId', 'tohumAnahtari'] }]);

    expect(basliklar()).toEqual(['İzin', 'Tür']);
    const [, satir] = screen.getAllByRole('row');
    expect(hucreler(satir)[1]).toBe('—');
  });
});
