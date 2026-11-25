import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { redirect } from 'next/navigation';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tarihSaat } from '../../../../shared/bicim/bicim';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import YetenekSayfasi from './page';

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
const YENI_ID = '8d2e3f4a-5b6c-4d7e-8f9a-1b2c3d4e5f6a';
const GRUP = '11111111-1111-4111-8111-111111111111';
const ROL = '22222222-2222-4222-8222-222222222222';
const IZIN = '33333333-3333-4333-8333-333333333333';
const YOL = `/kimlik/yetenek/${ID}`;
const OLUSTURMA = '2026-01-15T10:30:00.000Z';

// Ad listeleri her sayfa çiziminde istenir; sahte backend onları yoldan tanır.
const AD_LISTELERI: Readonly<Record<string, unknown[]>> = {
  '/kimlik/grup': [{ id: GRUP, ad: 'Merkez' }],
  '/kimlik/rol': [{ id: ROL, ad: 'Yönetici' }],
  '/kimlik/izin': [{ id: IZIN, kaynak: 'Kullanici', eylem: 'oku' }],
};

// Yer tutuculu, sayılı, mantıksal ve listeli öğeler.
const SART = [
  { alan: 'kullaniciId', islec: 'esit', deger: { yerTutucu: 'isteyen' } },
  { alan: 'yas', islec: 'buyuk', deger: 18 },
  { alan: 'aktif', islec: 'esit_degil', deger: false },
  { alan: 'durum', islec: 'listede', deger: ['a', 'b'] },
  { alan: 'puan', islec: 'listede_degil', deger: [1, 2.5] },
];

const YETENEK = {
  id: ID,
  grupId: GRUP,
  rolId: ROL,
  izinId: IZIN,
  sart: SART,
  butunKayitlar: false,
  butunBirimler: true,
  kolonlar: ['ad', 'kod'],
  butunKolonlar: false,
  sistemSatiri: false,
  tohumAnahtari: null,
  yerineGectigiId: null,
  koken: 'elle',
  olusturmaZamani: OLUSTURMA,
  silinmeZamani: null,
};

const ISLER = ['yenile', 'olustur', 'sil'];

function kurallar(...isler: string[]): YetkiKurali[] {
  return isler.map((action) => ({ action, subject: 'Yetenek' }));
}

function isHaric(is: string): YetkiKurali[] {
  return kurallar(...ISLER.filter((ad) => ad !== is));
}

// Ad listesi olmayan istekler sırayla verilen cevapları alır: ilki kayıt, sonrakiler işler.
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

async function sayfa(yetki: YetkiKurali[], id = ID) {
  return (
    <YetkiSaglayici kurallar={yetki}>
      <Yakalayici>{await YetenekSayfasi({ params: Promise.resolve({ id }) })}</Yakalayici>
    </YetkiSaglayici>
  );
}

async function goster(
  kayit: object,
  yetki: YetkiKurali[] = kurallar(...ISLER),
  ...isCevaplari: Response[]
) {
  backend(jsonCevap(kayit, 200), ...isCevaplari);
  return render(await sayfa(yetki));
}

// Ad listeleri dışında backend'e giden isteklerin yolu, yöntemi ve gövdesi.
function istekler() {
  return sahteFetch.mock.calls
    .map(([adres, init]) => {
      if (!(adres instanceof URL)) {
        throw new Error('backend isteği URL nesnesiyle atılmadı');
      }
      const govde: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      return { yol: adres.pathname, yontem: init?.method, govde };
    })
    .filter(({ yol }) => AD_LISTELERI[yol] === undefined);
}

function kayitSatirlari(): string[][] {
  const etiketler = screen.getAllByRole('term').map((t) => t.textContent);
  const degerler = screen.getAllByRole('definition').map((d) => d.textContent);
  return etiketler.map((etiket, sira) => [etiket, degerler[sira] ?? '']);
}

function dugme(ad: string) {
  return screen.queryByRole('button', { name: ad });
}

function yenileFormu() {
  return screen.queryByRole('form', { name: 'Yenile' });
}

function degerler(etiket: string | RegExp): string[] {
  return screen.getAllByLabelText(etiket).map((oge) => {
    if (oge instanceof HTMLInputElement || oge instanceof HTMLSelectElement) {
      return oge.value;
    }
    throw new Error('girdi değil');
  });
}

function isaretli(etiket: string): boolean {
  const kutu = screen.getByLabelText(etiket);
  if (!(kutu instanceof HTMLInputElement)) {
    throw new Error('kutu değil');
  }
  return kutu.checked;
}

const DEGER = /^Değer( \(virgülle ayrılmış\))?$/;

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

describe('YetenekSayfasi kayıt', () => {
  it('backend\'e oturumlu GET isteği atar ve kaydı listedeki yazımla gösterir', async () => {
    await goster(YETENEK);

    expect(istekler()).toEqual([{ yol: YOL, yontem: 'GET', govde: null }]);
    const kayitIstegi = sahteFetch.mock.calls.find(
      ([adres]) => adres instanceof URL && adres.pathname === YOL,
    );
    expect(new Headers(kayitIstegi?.[1]?.headers).get('authorization')).toBe('Bearer erisim');
    expect(kayitSatirlari()).toEqual([
      ['Grup', 'Merkez'],
      ['Rol', 'Yönetici'],
      ['İzin', 'Kullanici:oku'],
      [
        'Kayıt sınırı',
        'kullaniciId esit {isteyen} ve yas buyuk 18 ve aktif esit_degil false ve durum listede [a, b] ve puan listede_degil [1, 2.5]',
      ],
      ['Bütün birimler', 'Evet'],
      ['Kolon sınırı', 'ad, kod'],
      ['Tür', ''],
      ['Oluşturma zamanı', tarihSaat(OLUSTURMA)],
    ]);
  });

  it('kolonu gelmeyen alanlar boş işaretle görünür ve iş gösterilmez', async () => {
    await goster({ id: ID });

    expect(kayitSatirlari().map(([, deger]) => deger)).toEqual([
      '—', '—', '—', '—', '—', '—', '—', '—',
    ]);
    expect(yenileFormu()).toBeNull();
    expect(dugme('Sil')).toBeNull();
  });

  it('404 bulunamadi dönünce Kayıt bulunamadı iletisi gösterilir', async () => {
    backend(hataCevabi('bulunamadi', 'Bulunamadı', 404));

    render(await sayfa(kurallar(...ISLER)));

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('uuid olmayan kimlikte kayıt backend\'den istenmeden Kayıt bulunamadı gösterilir', async () => {
    backend();

    render(await sayfa(kurallar(...ISLER), '..'));

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(istekler()).toEqual([]);
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    backend(hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401));

    await expect(YetenekSayfasi({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });
});

describe('YetenekSayfasi yenile', () => {
  it('form var olan içerikle dolu gelir; değer türü saklanan değerin tipinden çıkarılır', async () => {
    await goster(YETENEK);

    expect(degerler('Alan')).toEqual(['kullaniciId', 'yas', 'aktif', 'durum', 'puan']);
    expect(degerler('İşleç')).toEqual(['esit', 'buyuk', 'esit_degil', 'listede', 'listede_degil']);
    expect(degerler('Değer türü')).toEqual(['yerTutucu', 'sayi', 'mantiksal', 'metin', 'sayi']);
    expect(degerler(DEGER)).toEqual(['isteyen', '18', 'false', 'a, b', '1, 2.5']);
    expect(isaretli('Bütün kayıtlar')).toBe(false);
    expect(isaretli('Bütün birimler')).toBe(true);
    expect(isaretli('Bütün kolonlar')).toBe(false);
    expect(degerler('Kolonlar (virgülle ayrılmış)')).toEqual(['ad, kod']);
  });

  it('değiştirilmeden gönderilen form aynı içeriği yenile yoluna POST eder ve yeni satırın sayfasına gider', async () => {
    // React, hata sınırının yakaladığı yönlendirmeyi günlüğe yazar.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(YETENEK, kurallar(...ISLER), jsonCevap({ id: YENI_ID }, 201));

    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }));

    expect(await screen.findByText(`yonlendirildi:/yetenekler/${YENI_ID}`)).toBeDefined();
    expect(istekler()[1]).toEqual({
      yol: `${YOL}/yenile`,
      yontem: 'POST',
      govde: {
        sart: SART,
        butunKayitlar: false,
        butunBirimler: true,
        kolonlar: ['ad', 'kod'],
        butunKolonlar: false,
      },
    });
    expect(redirect).toHaveBeenCalledExactlyOnceWith(`/yetenekler/${YENI_ID}`);
  });

  it('bütün kayıtlar ve bütün kolonlar işaretli, içeriği boş kayıt null içerikle yenilenir', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(
      { ...YETENEK, sart: null, butunKayitlar: true, kolonlar: [], butunKolonlar: true },
      kurallar(...ISLER),
      jsonCevap({ id: YENI_ID }, 201),
    );
    expect(isaretli('Bütün kayıtlar')).toBe(true);
    expect(isaretli('Bütün kolonlar')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }));

    expect(await screen.findByText(`yonlendirildi:/yetenekler/${YENI_ID}`)).toBeDefined();
    expect(istekler()[1]?.govde).toEqual({
      sart: null,
      butunKayitlar: true,
      butunBirimler: true,
      kolonlar: null,
      butunKolonlar: true,
    });
  });

  it('şart satırı çıkarılınca öbürleri kalır ve gövdeye gitmez', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(YETENEK, kurallar(...ISLER), jsonCevap({ id: YENI_ID }, 201));

    await userEvent.click(screen.getByRole('button', { name: '1. şartı çıkar' }));

    expect(degerler('Alan')).toEqual(['yas', 'aktif', 'durum', 'puan']);
    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }));
    expect(await screen.findByText(`yonlendirildi:/yetenekler/${YENI_ID}`)).toBeDefined();
    expect(istekler()[1]?.govde).toMatchObject({ sart: SART.slice(1) });
  });

  it('sayıya çevrilemeyen değer backend çağrılmadan hata verir', async () => {
    await goster(YETENEK);

    const [, yas] = screen.getAllByLabelText(DEGER);
    await userEvent.clear(yas ?? document.body);
    await userEvent.type(yas ?? document.body, 'on sekiz');
    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      '2. şart: Değer sayıya çevrilemiyor',
    );
    expect(istekler()).toHaveLength(1);
  });

  it('409 cakisma dönünce backend\'in iletisi görünür', async () => {
    await goster(
      YETENEK,
      kurallar(...ISLER),
      hataCevabi('cakisma', 'Tohum satırı yenilenemez', 409),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Tohum satırı yenilenemez');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster(YETENEK, kurallar(...ISLER), hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('backend\'in dogrulama_hatasi iletisi şartın altında görünür', async () => {
    await goster(
      YETENEK,
      kurallar(...ISLER),
      jsonCevap(
        {
          kod: 'dogrulama_hatasi',
          ileti: 'Yetenek doğrulanamadı',
          ayrinti: [{ alan: 'sart', neden: 'bilinmeyen alan: yas' }],
        },
        400,
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }));

    expect((await screen.findByRole('alert')).textContent).toBe('bilinmeyen alan: yas');
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ['sistem satırında', { sistemSatiri: true }],
    ['tohum satırında', { tohumAnahtari: 'yonetici-butun' }],
    ['sistemSatiri kolonu gelmeyen kayıtta', { sistemSatiri: undefined }],
    ['tohumAnahtari kolonu gelmeyen kayıtta', { tohumAnahtari: undefined }],
  ])('%s yenile formu yoktur', async (_ad, ek) => {
    await goster({ ...YETENEK, ...ek });

    expect(yenileFormu()).toBeNull();
    expect(dugme('Yenile')).toBeNull();
  });
});

describe('YetenekSayfasi sil', () => {
  it('ilk düğme onay satırını açar ve backend henüz çağrılmamıştır; onaydan sonra DELETE gider ve listeye döner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(YETENEK, kurallar(...ISLER), bosCevap());

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));

    expect(screen.getByText('Yetenek silinsin mi?')).toBeDefined();
    expect(istekler()).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect(await screen.findByText('yonlendirildi:/yetenekler')).toBeDefined();
    expect(istekler()[1]).toEqual({ yol: YOL, yontem: 'DELETE', govde: null });
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/yetenekler');
  });

  it('409 cakisma dönünce backend\'in iletisi görünür ve listeye dönülmez', async () => {
    await goster(YETENEK, kurallar(...ISLER), hataCevabi('cakisma', 'Sistem satırı silinemez', 409));

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Sistem satırı silinemez');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster(YETENEK, kurallar(...ISLER), hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sistem satırında sil düğmesi yoktur', async () => {
    await goster({ ...YETENEK, sistemSatiri: true });

    expect(dugme('Sil')).toBeNull();
  });

  it('tohum satırında sil düğmesi vardır', async () => {
    await goster({ ...YETENEK, tohumAnahtari: 'yonetici-butun' });

    expect(dugme('Sil')).not.toBeNull();
  });
});

describe('YetenekSayfasi yetki', () => {
  it('bütün kurallar varken yenile formu ve sil görünür', async () => {
    await goster(YETENEK);

    expect(yenileFormu()).not.toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('yenile kuralı olup olustur kuralı olmayan kişi yenile formunu görmez', async () => {
    await goster(YETENEK, isHaric('olustur'));

    expect(yenileFormu()).toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('olustur kuralı olup yenile kuralı olmayan kişi yenile formunu görmez', async () => {
    await goster(YETENEK, isHaric('yenile'));

    expect(yenileFormu()).toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('sil kuralı olmayan kişi sil düğmesini görmez', async () => {
    await goster(YETENEK, isHaric('sil'));

    expect(dugme('Sil')).toBeNull();
    expect(yenileFormu()).not.toBeNull();
  });
});
