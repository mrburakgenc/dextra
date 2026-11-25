import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { Component, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tarihSaat } from '../../../../shared/bicim/bicim';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import GrupSayfasi from './page';

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

const KOK = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const HEDEF = '33333333-3333-4333-8333-333333333333';
const YOL = `/kimlik/grup/${ID}`;
const OLUSTURMA = '2026-01-15T10:30:00.000Z';

const GRUP = { id: ID, ustGrupId: KOK, ad: 'Muhasebe', olusturmaZamani: OLUSTURMA };

function listeCevabi(): Response {
  return jsonCevap(
    {
      kayitlar: [
        { id: KOK, ustGrupId: null, ad: 'Merkez' },
        { id: ID, ustGrupId: KOK, ad: 'Muhasebe' },
        { id: HEDEF, ustGrupId: KOK, ad: 'Satış' },
      ],
      sayfa: 1,
      boyut: 100,
      sonrakiVar: false,
    },
    200,
  );
}

const ISLER = ['guncelle', 'tasi', 'sil'];

function kurallar(...isler: string[]): YetkiKurali[] {
  return isler.map((action) => ({ action, subject: 'Grup' }));
}

function isHaric(is: string): YetkiKurali[] {
  return kurallar(...ISLER.filter((ad) => ad !== is));
}

// Sayfa önce kaydı, sonra üst grup seçimi için grup listesini backend'den okur.
async function goster(
  kayit: object = GRUP,
  yetki: YetkiKurali[] = kurallar(...ISLER),
  liste: Response = listeCevabi(),
) {
  sahteFetch.mockResolvedValueOnce(jsonCevap(kayit, 200));
  sahteFetch.mockResolvedValueOnce(liste);
  render(
    <YetkiSaglayici kurallar={yetki}>
      <Yakalayici>{await GrupSayfasi({ params: Promise.resolve({ id: ID }) })}</Yakalayici>
    </YetkiSaglayici>,
  );
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

function kayitSatirlari(): string[][] {
  const etiketler = screen.getAllByRole('term').map((t) => t.textContent);
  const degerler = screen.getAllByRole('definition').map((d) => d.textContent);
  return etiketler.map((etiket, sira) => [etiket, degerler[sira] ?? '']);
}

function dugme(ad: string) {
  return screen.queryByRole('button', { name: ad });
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

describe('GrupSayfasi kayıt', () => {
  it('kaydı ve grup listesini oturumlu GET ile okur; üst grubun adı listeden gösterilir', async () => {
    await goster();

    expect(istekler()).toEqual([
      { yol: YOL, yontem: 'GET', govde: null },
      { yol: '/kimlik/grup?sayfa=1&boyut=100', yontem: 'GET', govde: null },
    ]);
    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Muhasebe');
    expect(kayitSatirlari()).toEqual([
      ['Ad', 'Muhasebe'],
      ['Üst grup', 'Merkez'],
      ['Oluşturma zamanı', tarihSaat(OLUSTURMA)],
    ]);
  });

  it('kolonu gelmeyen alanlar boş işaretle görünür', async () => {
    await goster({ id: ID });

    expect(kayitSatirlari()).toEqual([
      ['Ad', '—'],
      ['Üst grup', '—'],
      ['Oluşturma zamanı', '—'],
    ]);
  });

  it('404 bulunamadi dönünce Kayıt bulunamadı iletisi gösterilir ve liste istenmez', async () => {
    sahteFetch.mockResolvedValueOnce(hataCevabi('bulunamadi', 'Bulunamadı', 404));

    render(
      <YetkiSaglayici kurallar={kurallar(...ISLER)}>
        {await GrupSayfasi({ params: Promise.resolve({ id: ID }) })}
      </YetkiSaglayici>,
    );

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401),
    );

    await expect(GrupSayfasi({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });

  it('grup listesi 403 dönünce taşı yerine liste iletisi görünür, üst grup kısaltılır; öbür işler kalır', async () => {
    await goster(GRUP, kurallar(...ISLER), hataCevabi('yetki_yok', 'Yetki yok', 403));

    expect(screen.queryByRole('form', { name: 'Taşı' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Grup listesi alınamadı');
    expect(kayitSatirlari()).toEqual([
      ['Ad', 'Muhasebe'],
      ['Üst grup', '…11111111'],
      ['Oluşturma zamanı', tarihSaat(OLUSTURMA)],
    ]);
    expect(screen.queryByLabelText('Yeni ad')).not.toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('grup listesine ulaşılamayınca da taşı yerine liste iletisi görünür; silme çalışır', async () => {
    // React, hata sınırının yakaladığı yönlendirmeyi günlüğe yazar.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster(GRUP, kurallar(...ISLER), new Response('Bad Gateway', { status: 502 }));

    expect(screen.queryByRole('form', { name: 'Taşı' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Grup listesi alınamadı');

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    sahteFetch.mockResolvedValueOnce(bosCevap());
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect(await screen.findByText('yonlendirildi:/gruplar')).toBeDefined();
    expect(istekler()[2]).toEqual({ yol: YOL, yontem: 'DELETE', govde: null });
  });

  it('taşı kuralı olmayan kişi liste iletisini de görmez', async () => {
    await goster(GRUP, isHaric('tasi'), hataCevabi('yetki_yok', 'Yetki yok', 403));

    expect(screen.queryByText('Grup listesi alınamadı')).toBeNull();
  });

  it('grup listesi 401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    sahteFetch.mockResolvedValueOnce(jsonCevap(GRUP, 200));
    sahteFetch.mockResolvedValueOnce(hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401));

    await expect(GrupSayfasi({ params: Promise.resolve({ id: ID }) })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
  });

  it('üst grup listede yoksa … ve kimliğin son sekiz karakteri görünür', async () => {
    await goster({ ...GRUP, ustGrupId: '44444444-4444-4444-8444-444444444444' });

    expect(kayitSatirlari()[1]).toEqual(['Üst grup', '…44444444']);
  });

  it('ustGrupId kolonu kayıtta gelmediyse boş işaret görünür', async () => {
    await goster({ id: ID, ad: 'Muhasebe', olusturmaZamani: OLUSTURMA });

    expect(kayitSatirlari()[1]).toEqual(['Üst grup', '—']);
  });
});

// Silinmiş kayıt sayfası (GV-099).
describe('GrupSayfasi silinmiş kayıt', () => {
  const SILINME = '2026-04-02T12:00:00.000Z';

  it('silinmeZamani doluysa Silinmiş işareti ve zamanı görünür; hiçbir iş formu ve düğmesi yoktur', async () => {
    await goster({ ...GRUP, silinmeZamani: SILINME });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Muhasebe');
    expect(screen.getByText('Silinmiş').parentElement?.textContent).toBe(
      `Silinmiş ${tarihSaat(SILINME)}`,
    );
    expect(screen.queryAllByRole('form')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByLabelText('Yeni ad')).toBeNull();
    expect(screen.queryByLabelText('Yeni üst grup')).toBeNull();
  });

  it('silinmeZamani boşsa işaret yoktur ve işler bugünkü gibidir', async () => {
    await goster({ ...GRUP, silinmeZamani: null });

    expect(screen.queryByText('Silinmiş')).toBeNull();
    expect(screen.getByRole('form', { name: 'Adını değiştir' })).toBeDefined();
    expect(screen.getByRole('form', { name: 'Taşı' })).toBeDefined();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('silinmeZamani kolonu gelmediyse işaret yoktur ve işler bugünkü gibidir', async () => {
    await goster(GRUP);

    expect(screen.queryByText('Silinmiş')).toBeNull();
    expect(screen.getByRole('form', { name: 'Adını değiştir' })).toBeDefined();
    expect(screen.getByRole('form', { name: 'Taşı' })).toBeDefined();
    expect(dugme('Sil')).not.toBeNull();
  });
});

describe('GrupSayfasi ad', () => {
  it('değişiklik backend\'e PATCH ile kırpılmış adla gider ve sayfa tazelenir', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(bosCevap());

    await userEvent.type(screen.getByLabelText('Yeni ad'), ' Finans ');
    await userEvent.click(screen.getByRole('button', { name: 'Adını değiştir' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[2]).toEqual({ yol: YOL, yontem: 'PATCH', govde: { ad: 'Finans' } });
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.type(screen.getByLabelText('Yeni ad'), 'Finans');
    await userEvent.click(screen.getByRole('button', { name: 'Adını değiştir' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('GrupSayfasi taşı', () => {
  it('seçilen üst grup POST kimlik/grup/:id/tasi gövdesine gider ve sayfa tazelenir', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(bosCevap());

    await userEvent.selectOptions(screen.getByLabelText('Yeni üst grup'), 'Satış');
    await userEvent.click(screen.getByRole('button', { name: 'Taşı' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[2]).toEqual({
      yol: `${YOL}/tasi`,
      yontem: 'POST',
      govde: { ustGrupId: HEDEF },
    });
  });

  it('üst grup seçilmezse backend çağrılmadan alan hatası verir', async () => {
    await goster();

    await userEvent.click(screen.getByRole('button', { name: 'Taşı' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Üst grup seçilmeli');
    expect(sahteFetch).toHaveBeenCalledTimes(2);
  });

  it('409 cakisma (döngü) dönünce backend\'in iletisi görünür ve sayfa tazelenmez', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('cakisma', 'Grup kendi altına taşınamaz', 409),
    );

    await userEvent.selectOptions(screen.getByLabelText('Yeni üst grup'), 'Satış');
    await userEvent.click(screen.getByRole('button', { name: 'Taşı' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Grup kendi altına taşınamaz',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.selectOptions(screen.getByLabelText('Yeni üst grup'), 'Satış');
    await userEvent.click(screen.getByRole('button', { name: 'Taşı' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('GrupSayfasi sil', () => {
  it('ilk düğme onay satırını açar ve backend henüz çağrılmamıştır; onaydan sonra DELETE gider ve listeye döner', async () => {
    // React, hata sınırının yakaladığı yönlendirmeyi günlüğe yazar.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await goster();

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));

    expect(screen.getByText('Grup silinsin mi?')).toBeDefined();
    expect(sahteFetch).toHaveBeenCalledTimes(2);

    sahteFetch.mockResolvedValueOnce(bosCevap());
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect(await screen.findByText('yonlendirildi:/gruplar')).toBeDefined();
    expect(istekler()[2]).toEqual({ yol: YOL, yontem: 'DELETE', govde: null });
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/gruplar');
  });

  it('409 cakisma (dolu grup) dönünce backend\'in iletisi görünür ve listeye dönülmez', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('cakisma', 'Grubun üyesi var', 409));

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Grubun üyesi var');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.click(screen.getByRole('button', { name: 'Sil' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evet, sil' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('GrupSayfasi yetki', () => {
  it('bütün kurallar varken ad formu, taşı ve sil görünür', async () => {
    await goster();

    expect(screen.queryByRole('form', { name: 'Adını değiştir' })).not.toBeNull();
    expect(screen.queryByRole('form', { name: 'Taşı' })).not.toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('guncelle kuralı olmayan kişi ad formunu görmez', async () => {
    await goster(GRUP, isHaric('guncelle'));

    expect(screen.queryByLabelText('Yeni ad')).toBeNull();
    expect(screen.queryByRole('form', { name: 'Taşı' })).not.toBeNull();
    expect(dugme('Sil')).not.toBeNull();
  });

  it('tasi kuralı olmayan kişi taşı formunu görmez', async () => {
    await goster(GRUP, isHaric('tasi'));

    expect(screen.queryByRole('form', { name: 'Taşı' })).toBeNull();
    expect(screen.queryByLabelText('Yeni üst grup')).toBeNull();
    expect(screen.queryByLabelText('Yeni ad')).not.toBeNull();
  });

  it('sil kuralı olmayan kişi sil düğmesini görmez', async () => {
    await goster(GRUP, isHaric('sil'));

    expect(dugme('Sil')).toBeNull();
    expect(screen.queryByRole('form', { name: 'Taşı' })).not.toBeNull();
  });
});
