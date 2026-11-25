import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import YeniYetenekSayfasi from './page';

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

const YENI_ID = '5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const GRUP = '11111111-1111-4111-8111-111111111111';
const ROL = '22222222-2222-4222-8222-222222222222';
const IZIN = '33333333-3333-4333-8333-333333333333';
const OLUSTURUR: YetkiKurali[] = [{ action: 'olustur', subject: 'Yetenek' }];

const AD_LISTELERI: Readonly<Record<string, unknown[]>> = {
  '/kimlik/grup': [{ id: GRUP, ad: 'Merkez' }],
  '/kimlik/rol': [{ id: ROL, ad: 'Yönetici' }],
  '/kimlik/izin': [{ id: IZIN, kaynak: 'Kullanici', eylem: 'oku' }],
};

// Ad listesi olmayan istekler sırayla verilen cevapları alır.
function backend(...cevaplar: Response[]) {
  sahteFetch.mockImplementation((adres) => {
    const yol = adres instanceof URL ? adres.pathname : '';
    const adlar = AD_LISTELERI[yol];
    if (adlar !== undefined) {
      return Promise.resolve(
        jsonCevap({ kayitlar: adlar, sayfa: 1, boyut: 100, sonrakiVar: false }, 200),
      );
    }
    const cevap = cevaplar.shift();
    return cevap === undefined
      ? Promise.reject(new Error(`beklenmeyen istek: ${yol}`))
      : Promise.resolve(cevap);
  });
}

async function goster(kurallar: YetkiKurali[] = OLUSTURUR, ...cevaplar: Response[]) {
  backend(...cevaplar);
  render(
    <YetkiSaglayici kurallar={kurallar}>
      <Yakalayici>{await YeniYetenekSayfasi()}</Yakalayici>
    </YetkiSaglayici>,
  );
}

// Ad listeleri dışında backend'e giden isteklerin yolu, yöntemi ve gövdesi.
function istekler() {
  return sahteFetch.mock.calls
    .map(([adres, init]) => {
      if (!(adres instanceof URL)) {
        throw new Error('backend isteği URL nesnesiyle atılmadı');
      }
      const govde: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      return { yol: adres.pathname, yontem: init?.method, govde, init };
    })
    .filter(({ yol }) => AD_LISTELERI[yol] === undefined);
}

async function sec() {
  await userEvent.selectOptions(screen.getByLabelText('Grup'), 'Merkez');
  await userEvent.selectOptions(screen.getByLabelText('Rol'), 'Yönetici');
  await userEvent.selectOptions(screen.getByLabelText('İzin'), 'Kullanici:oku');
}

const DEGER = /^Değer( \(virgülle ayrılmış\))?$/;

// Son eklenen şart satırını doldurur; yer tutucu türünde değer seçilir.
async function sartEkle(alan: string, islec: string, tur: string, deger: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Şart ekle' }));
  const son = <T,>(ogeler: T[]): T => {
    const oge = ogeler.at(-1);
    if (oge === undefined) {
      throw new Error('satır yok');
    }
    return oge;
  };
  await userEvent.type(son(screen.getAllByLabelText('Alan')), alan);
  await userEvent.selectOptions(son(screen.getAllByLabelText('İşleç')), islec);
  await userEvent.selectOptions(son(screen.getAllByLabelText('Değer türü')), tur);
  const degerGirdisi = son(screen.getAllByLabelText(DEGER));
  if (degerGirdisi instanceof HTMLSelectElement) {
    await userEvent.selectOptions(degerGirdisi, deger);
  } else {
    await userEvent.type(degerGirdisi, deger);
  }
}

async function gonder() {
  await userEvent.click(screen.getByRole('button', { name: 'Yeteneği yaz' }));
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

// Şartın hatası şart bölümüne bağlıdır.
function sartHatasi(): string | null {
  const kimlik = screen.getByRole('group', { name: 'Şart' }).getAttribute('aria-describedby');
  return kimlik === null ? null : (document.getElementById(kimlik)?.textContent ?? null);
}

// Şart satırının hatası satırın içindedir: hatalı girdi geçersiz işaretlidir ve satırdaki iletiye
// bağlıdır.
function satirHatasi(sira: number, etiket: string | RegExp): string | null {
  const satir = screen.getByRole('group', { name: `${String(sira)}. şart` });
  const girdi = within(satir).getByLabelText(etiket);
  if (girdi.getAttribute('aria-invalid') !== 'true') {
    return null;
  }
  const ileti = document.getElementById(girdi.getAttribute('aria-describedby') ?? '');
  return ileti !== null && satir.contains(ileti) ? ileti.textContent : null;
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
  sahteFetch.mockReset();
});

describe('YeniYetenekSayfasi başarı', () => {
  it('şart satırları doğru tipte gider; gövde bütün alanları taşır ve yeni kaydın sayfasına gidilir', async () => {
    // React, hata sınırının yakaladığı yönlendirmeyi günlüğe yazar.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(OLUSTURUR, jsonCevap({ id: YENI_ID }, 201));

    await sec();
    await sartEkle('kullaniciId', 'esit', 'yerTutucu', 'isteyen');
    await sartEkle('yas', 'buyuk_esit', 'sayi', '18');
    await sartEkle('aktif', 'esit', 'mantiksal', 'true');
    await sartEkle('durum', 'listede', 'metin', 'a, b');
    await sartEkle('puan', 'listede_degil', 'sayi', '1,2.5');
    await sartEkle('grupId', 'listede', 'yerTutucu', 'yetenek_grubu_ve_alti');
    await userEvent.click(screen.getByLabelText('Bütün birimler'));
    await userEvent.type(screen.getByLabelText('Kolonlar (virgülle ayrılmış)'), 'ad, kod');
    await gonder();

    expect(await screen.findByText(`yonlendirildi:/yetenekler/${YENI_ID}`)).toBeDefined();
    const [istek] = istekler();
    expect(istekler()).toHaveLength(1);
    expect(istek?.yol).toBe('/kimlik/yetenek');
    expect(istek?.yontem).toBe('POST');
    expect(new Headers(istek?.init?.headers).get('authorization')).toBe('Bearer erisim');
    expect(istek?.govde).toEqual({
      grupId: GRUP,
      rolId: ROL,
      izinId: IZIN,
      sart: [
        { alan: 'kullaniciId', islec: 'esit', deger: { yerTutucu: 'isteyen' } },
        { alan: 'yas', islec: 'buyuk_esit', deger: 18 },
        { alan: 'aktif', islec: 'esit', deger: true },
        { alan: 'durum', islec: 'listede', deger: ['a', 'b'] },
        { alan: 'puan', islec: 'listede_degil', deger: [1, 2.5] },
        { alan: 'grupId', islec: 'listede', deger: { yerTutucu: 'yetenek_grubu_ve_alti' } },
      ],
      butunKayitlar: false,
      butunBirimler: true,
      kolonlar: ['ad', 'kod'],
      butunKolonlar: false,
    });
    expect(redirect).toHaveBeenCalledExactlyOnceWith(`/yetenekler/${YENI_ID}`);
  });

  it('boş şart ve boş kolon null gider; ikisi de boşken form gönderilir ve uyarılar görünür', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(OLUSTURUR, jsonCevap({ id: YENI_ID }, 201));

    expect(screen.getByText('Kayıt sınırı boş: bu yetenek kayıt vermez')).toBeDefined();
    expect(screen.getByText('Kolon sınırı boş: bu yetenek kolon vermez')).toBeDefined();
    await sec();
    await gonder();

    expect(await screen.findByText(`yonlendirildi:/yetenekler/${YENI_ID}`)).toBeDefined();
    expect(istekler()[0]?.govde).toEqual({
      grupId: GRUP,
      rolId: ROL,
      izinId: IZIN,
      sart: null,
      butunKayitlar: false,
      butunBirimler: false,
      kolonlar: null,
      butunKolonlar: false,
    });
  });

  it('bütün kayıtlar ve bütün kolonlar işaretlenince uyarılar kalkar ve işaretler gövdeye gider', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(OLUSTURUR, jsonCevap({ id: YENI_ID }, 201));

    await sec();
    await userEvent.click(screen.getByLabelText('Bütün kayıtlar'));
    await userEvent.click(screen.getByLabelText('Bütün kolonlar'));

    expect(screen.queryByText('Kayıt sınırı boş: bu yetenek kayıt vermez')).toBeNull();
    expect(screen.queryByText('Kolon sınırı boş: bu yetenek kolon vermez')).toBeNull();
    await gonder();
    expect(await screen.findByText(`yonlendirildi:/yetenekler/${YENI_ID}`)).toBeDefined();
    expect(istekler()[0]?.govde).toMatchObject({
      sart: null,
      butunKayitlar: true,
      kolonlar: null,
      butunKolonlar: true,
    });
  });
});

describe('YeniYetenekSayfasi doğrulama', () => {
  it('bütün kayıtlar ile şart birlikte backend çağrılmadan hata verir', async () => {
    await goster();

    await sec();
    await userEvent.click(screen.getByLabelText('Bütün kayıtlar'));
    await sartEkle('durum', 'esit', 'metin', 'a');
    await gonder();

    await vi.waitFor(() => {
      expect(sartHatasi()).toBe('Bütün kayıtlar işaretliyken şart yazılamaz');
    });
    expect(istekler()).toEqual([]);
  });

  it('bütün kolonlar ile kolonlar birlikte backend çağrılmadan hata verir', async () => {
    await goster();

    await sec();
    await userEvent.click(screen.getByLabelText('Bütün kolonlar'));
    await userEvent.type(screen.getByLabelText('Kolonlar (virgülle ayrılmış)'), 'ad');
    await gonder();

    await vi.waitFor(() => {
      expect(alanHatasi('Kolonlar (virgülle ayrılmış)')).toBe(
        'Bütün kolonlar işaretliyken kolon yazılamaz',
      );
    });
    expect(istekler()).toEqual([]);
  });

  it.each(['ad,', 'ad,,kod'])(
    'boş kolon adı (%s) backend çağrılmadan Türkçe iletiyle hata verir',
    async (yazim) => {
      await goster();

      await sec();
      await userEvent.type(screen.getByLabelText('Kolonlar (virgülle ayrılmış)'), yazim);
      await gonder();

      await vi.waitFor(() => {
        expect(alanHatasi('Kolonlar (virgülle ayrılmış)')).toBe('Kolon adı boş olamaz');
      });
      expect(istekler()).toEqual([]);
    },
  );

  it.each([
    ['tek değerde', 'esit', 'on sekiz'],
    ['listeli işleçte', 'listede', '1, iki'],
  ])('sayıya çevrilemeyen değer %s backend çağrılmadan hata verir', async (_ad, islec, deger) => {
    await goster();

    await sec();
    await sartEkle('yas', islec, 'sayi', deger);
    await gonder();

    await vi.waitFor(() => {
      expect(satirHatasi(1, DEGER)).toBe('1. şart: Değer sayıya çevrilemiyor');
    });
    expect(satirHatasi(1, 'Alan')).toBeNull();
    expect(sartHatasi()).toBeNull();
    expect(istekler()).toEqual([]);
  });

  it('hatadan sonra üstteki satır çıkarılınca hata kendi satırında kalır, öbür satıra kaymaz', async () => {
    await goster();

    await sec();
    await sartEkle('a', 'esit', 'sayi', '1');
    await sartEkle('b', 'esit', 'sayi', 'on');
    await sartEkle('c', 'esit', 'sayi', '3');
    await gonder();
    await vi.waitFor(() => {
      expect(satirHatasi(2, DEGER)).toBe('2. şart: Değer sayıya çevrilemiyor');
    });

    await userEvent.click(screen.getByRole('button', { name: '1. şartı çıkar' }));

    expect(within(screen.getByRole('group', { name: '1. şart' })).getByLabelText('Alan')).toHaveProperty(
      'value',
      'b',
    );
    expect(satirHatasi(1, DEGER)).toBe('2. şart: Değer sayıya çevrilemiyor');
    expect(satirHatasi(2, DEGER)).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(istekler()).toEqual([]);
  });

  it('true ya da false olmayan mantıksal değer backend çağrılmadan hata verir', async () => {
    await goster();

    await sec();
    await sartEkle('aktif', 'esit', 'mantiksal', 'evet');
    await gonder();

    await vi.waitFor(() => {
      expect(satirHatasi(1, DEGER)).toBe('1. şart: Değer true ya da false olmalı');
    });
    expect(sartHatasi()).toBeNull();
    expect(istekler()).toEqual([]);
  });

  it('alanı boş şart satırı backend çağrılmadan hata verir', async () => {
    await goster();

    await sec();
    await userEvent.click(screen.getByRole('button', { name: 'Şart ekle' }));
    await gonder();

    await vi.waitFor(() => {
      expect(satirHatasi(1, 'Alan')).toBe('1. şart: Alan boş olamaz');
    });
    expect(satirHatasi(1, DEGER)).toBeNull();
    expect(sartHatasi()).toBeNull();
    expect(istekler()).toEqual([]);
  });

  it('grup, rol ve izin seçilmeden backend çağrılmadan alan hataları verir', async () => {
    await goster();

    await gonder();

    await vi.waitFor(() => {
      expect(alanHatasi('Grup')).toBe('Grup seçilmeli');
    });
    expect(alanHatasi('Rol')).toBe('Rol seçilmeli');
    expect(alanHatasi('İzin')).toBe('İzin seçilmeli');
    expect(istekler()).toEqual([]);
  });

  it('yer tutucu türünde değer üç yer tutucudan seçilir', async () => {
    await goster();

    await userEvent.click(screen.getByRole('button', { name: 'Şart ekle' }));
    await userEvent.selectOptions(screen.getByLabelText('Değer türü'), 'yerTutucu');

    const secim = screen.getByLabelText('Değer');
    expect(secim instanceof HTMLSelectElement).toBe(true);
    expect(
      Array.from(secim.querySelectorAll('option')).map((secenek) => secenek.value),
    ).toEqual(['', 'isteyen', 'yetenek_grubu', 'yetenek_grubu_ve_alti']);
  });
});

describe('YeniYetenekSayfasi hatalar', () => {
  it('backend\'in dogrulama_hatasi iletisi formda görünür', async () => {
    await goster(
      OLUSTURUR,
      jsonCevap(
        {
          kod: 'dogrulama_hatasi',
          ileti: 'Yetenek doğrulanamadı',
          ayrinti: [{ alan: 'kolonlar', neden: 'bilinmeyen kolon: soyad' }],
        },
        400,
      ),
    );

    await sec();
    await userEvent.type(screen.getByLabelText('Kolonlar (virgülle ayrılmış)'), 'soyad');
    await gonder();

    await vi.waitFor(() => {
      expect(alanHatasi('Kolonlar (virgülle ayrılmış)')).toBe('bilinmeyen kolon: soyad');
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('409 cakisma dönünce backend\'in iletisi formun üstünde görünür', async () => {
    await goster(OLUSTURUR, hataCevabi('cakisma', 'İzin katalogda yok', 409));

    await sec();
    await gonder();

    expect((await screen.findByRole('alert')).textContent).toBe('İzin katalogda yok');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce yetki iletisi formun üstünde görünür', async () => {
    await goster(OLUSTURUR, hataCevabi('yetki_yok', 'Yetki yok', 403));

    await sec();
    await gonder();

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('YeniYetenekSayfasi yazılanın korunması', () => {
  function secilen(etiket: string): string {
    const secim = screen.getByLabelText(etiket);
    if (!(secim instanceof HTMLSelectElement)) {
      throw new Error('seçim değil');
    }
    return secim.value;
  }

  function deger(etiket: string | RegExp): string {
    const girdi = screen.getByLabelText(etiket);
    if (!(girdi instanceof HTMLInputElement || girdi instanceof HTMLSelectElement)) {
      throw new Error('girdi değil');
    }
    return girdi.value;
  }

  it('409 dönünce grup, rol ve izin seçimi, şart satırı, kutular ve kolonlar formda kalır', async () => {
    await goster(OLUSTURUR, hataCevabi('cakisma', 'İzin katalogda yok', 409));

    await sec();
    await sartEkle('durum', 'listede', 'metin', 'a, b');
    await userEvent.click(screen.getByLabelText('Bütün birimler'));
    await userEvent.type(screen.getByLabelText('Kolonlar (virgülle ayrılmış)'), 'ad, kod');
    await gonder();

    expect((await screen.findByRole('alert')).textContent).toBe('İzin katalogda yok');
    expect(secilen('Grup')).toBe(GRUP);
    expect(secilen('Rol')).toBe(ROL);
    expect(secilen('İzin')).toBe(IZIN);
    expect(deger('Alan')).toBe('durum');
    expect(deger('İşleç')).toBe('listede');
    expect(deger('Değer türü')).toBe('metin');
    expect(deger(DEGER)).toBe('a, b');
    const kutu = screen.getByLabelText('Bütün birimler');
    expect(kutu instanceof HTMLInputElement && kutu.checked).toBe(true);
    expect(deger('Kolonlar (virgülle ayrılmış)')).toBe('ad, kod');
  });

  it('alan hatasında da seçimler ve yazılanlar formda kalır', async () => {
    await goster();

    await sec();
    await sartEkle('yas', 'esit', 'sayi', 'on sekiz');
    await gonder();

    await vi.waitFor(() => {
      expect(satirHatasi(1, DEGER)).toBe('1. şart: Değer sayıya çevrilemiyor');
    });
    expect(secilen('Grup')).toBe(GRUP);
    expect(secilen('Rol')).toBe(ROL);
    expect(secilen('İzin')).toBe(IZIN);
    expect(deger('Alan')).toBe('yas');
    expect(deger(DEGER)).toBe('on sekiz');
    expect(istekler()).toEqual([]);
  });

  it('gönderim sürerken düğme kapalıdır', async () => {
    let cevapla: (cevap: Response) => void = () => undefined;
    await goster(OLUSTURUR);
    sahteFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((coz) => {
          cevapla = coz;
        }),
    );

    await sec();
    await gonder();

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Yeteneği yaz' }).hasAttribute('disabled')).toBe(
        true,
      );
    });
    cevapla(hataCevabi('cakisma', 'İzin katalogda yok', 409));
    expect((await screen.findByRole('alert')).textContent).toBe('İzin katalogda yok');
    expect(screen.getByRole('button', { name: 'Yeteneği yaz' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('hatadan sonra değiştirilen seçimle ikinci gönderim başarılı olur ve yeni seçim gider', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(
      OLUSTURUR,
      hataCevabi('cakisma', 'İzin katalogda yok', 409),
      jsonCevap({ id: YENI_ID }, 201),
    );

    await sec();
    await gonder();
    expect((await screen.findByRole('alert')).textContent).toBe('İzin katalogda yok');
    await userEvent.selectOptions(screen.getByLabelText('Grup'), 'Seç');
    await gonder();

    await vi.waitFor(() => {
      expect(alanHatasi('Grup')).toBe('Grup seçilmeli');
    });
    expect(secilen('Grup')).toBe('');
    expect(secilen('Rol')).toBe(ROL);
    await userEvent.selectOptions(screen.getByLabelText('Grup'), 'Merkez');
    await gonder();

    expect(await screen.findByText(`yonlendirildi:/yetenekler/${YENI_ID}`)).toBeDefined();
    expect(istekler()).toHaveLength(2);
    expect(istekler()[1]?.govde).toMatchObject({ grupId: GRUP, rolId: ROL, izinId: IZIN });
  });
});

// Ad listesi alınamayınca form yerine ileti çıkar (GV-099). Verilen ad listesi bu cevabı alır.
function adListesiCevabi(yol: string, cevap: () => Response) {
  const onceki = sahteFetch.getMockImplementation();
  sahteFetch.mockImplementation((adres, init) => {
    if (adres instanceof URL && adres.pathname === yol) {
      return Promise.resolve(cevap());
    }
    return onceki === undefined
      ? Promise.reject(new Error('backend kurulmadı'))
      : onceki(adres, init);
  });
}

async function listeAlinamazkenGoster(
  yollar: readonly string[],
  cevap: () => Response,
  kurallar: YetkiKurali[] = OLUSTURUR,
) {
  backend();
  for (const yol of yollar) {
    adListesiCevabi(yol, cevap);
  }
  render(
    <YetkiSaglayici kurallar={kurallar}>
      <Yakalayici>{await YeniYetenekSayfasi()}</Yakalayici>
    </YetkiSaglayici>,
  );
}

describe('YeniYetenekSayfasi ad listesi alınamayınca', () => {
  it('izin listesi 403 dönünce form yerine İzin listesi alınamadı iletisi görünür', async () => {
    await listeAlinamazkenGoster(['/kimlik/izin'], () => hataCevabi('yetki_yok', 'Yetki yok', 403));

    expect(screen.queryByRole('button', { name: 'Yeteneği yaz' })).toBeNull();
    expect(screen.queryByLabelText('Grup')).toBeNull();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'İzin listesi alınamadı',
    ]);
  });

  it('grup ve rol listesine ulaşılamayınca iki liste de adıyla söylenir', async () => {
    await listeAlinamazkenGoster(
      ['/kimlik/grup', '/kimlik/rol'],
      () => new Response('Bad Gateway', { status: 502 }),
    );

    expect(screen.queryByRole('button', { name: 'Yeteneği yaz' })).toBeNull();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Grup listesi alınamadı',
      'Rol listesi alınamadı',
    ]);
  });

  it('olustur kuralı olmayan kişi liste iletisini görmez, yetki iletisini görür', async () => {
    await listeAlinamazkenGoster(
      ['/kimlik/izin'],
      () => hataCevabi('yetki_yok', 'Yetki yok', 403),
      [{ action: 'oku', subject: 'Yetenek' }],
    );

    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Bu iş için yetkin yok',
    ]);
  });

  it('ad listesi 401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    backend();
    adListesiCevabi('/kimlik/grup', () => hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401));

    await expect(YeniYetenekSayfasi()).rejects.toThrow('yonlendirildi:/oturum-bitti');
    expect(redirect).toHaveBeenCalledWith('/oturum-bitti');
  });
});

describe('YeniYetenekSayfasi yetki', () => {
  it('Yetenek olustur kuralı olmayan kişi formu görmez', async () => {
    await goster([{ action: 'oku', subject: 'Yetenek' }]);

    expect(screen.queryByRole('button', { name: 'Yeteneği yaz' })).toBeNull();
    expect(screen.queryByLabelText('Grup')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Bu iş için yetkin yok');
  });
});
