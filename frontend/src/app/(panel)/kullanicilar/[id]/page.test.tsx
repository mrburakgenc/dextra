import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tarihSaat } from '../../../../shared/bicim/bicim';
import type { YetkiKurali } from '../../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../../shared/yetki/yetki-saglayici';
import KullaniciSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek sayfa, gerçek Server Action'lar ve gerçek backend isteği sahte çerez deposu ve sahte
// fetch ile koşar.
const depo = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(depo),
  headers: () =>
    Promise.resolve(
      new Headers({ 'user-agent': 'deneme', origin: 'http://panel.sinama:3100' }),
    ),
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

const ID = '0b8f6a1e-3c2d-4e5f-8a9b-1c2d3e4f5a6b';
const YOL = `/kimlik/kullanici/${ID}`;
const OLUSTURMA = '2026-01-15T10:30:00.000Z';
const PASIF = '2026-03-01T09:00:00.000Z';
const KOD = 'kod-0123456789';

const ETKIN_KAYIT = {
  id: ID,
  kullaniciAdi: 'ada',
  gorunenAd: 'Ada Yılmaz',
  telefon: '+905551112233',
  sistemAktoru: false,
  pasifZamani: null,
  unutulmaZamani: null,
  olusturmaZamani: OLUSTURMA,
};
const PASIF_KAYIT = { ...ETKIN_KAYIT, pasifZamani: PASIF };

const ISLER = ['guncelle', 'pasife_al', 'yeniden_ac', 'parola_baglantisi_uret'];

function kurallar(...isler: string[]): YetkiKurali[] {
  return isler.map((action) => ({ action, subject: 'Kullanici' }));
}

function isHaric(is: string): YetkiKurali[] {
  return kurallar(...ISLER.filter((ad) => ad !== is));
}

async function sayfa(yetki: YetkiKurali[], id = ID) {
  return (
    <YetkiSaglayici kurallar={yetki}>
      {await KullaniciSayfasi({ params: Promise.resolve({ id }) })}
    </YetkiSaglayici>
  );
}

// Sayfa kaydı backend'den okur; ilk fetch cevabı kayıttır.
async function goster(kayit: object, yetki: YetkiKurali[] = kurallar(...ISLER)) {
  sahteFetch.mockResolvedValueOnce(jsonCevap(kayit, 200));
  return render(await sayfa(yetki));
}

// Backend'e giden isteklerin yolu, yöntemi ve gövdesi.
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
  // Kullanılmadan kalan sıralı cevaplar sonraki teste geçmesin.
  sahteFetch.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe('KullaniciSayfasi kayıt', () => {
  it('backend\'e oturumlu GET isteği atar ve kaydın kolonlarını gösterir', async () => {
    await goster(ETKIN_KAYIT);

    expect(istekler()).toEqual([{ yol: YOL, yontem: 'GET', govde: null }]);
    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ada Yılmaz');
    expect(kayitSatirlari()).toEqual([
      ['Kullanıcı adı', 'ada'],
      ['Görünen ad', 'Ada Yılmaz'],
      ['Telefon', '+905551112233'],
      ['Sistem aktörü', 'Hayır'],
      ['Durum', 'Etkin'],
      ['Unutulma zamanı', '—'],
      ['Oluşturma zamanı', tarihSaat(OLUSTURMA)],
    ]);
  });

  it('pasif kayıtta durum pasife alınma zamanıyla gösterilir', async () => {
    await goster({ ...PASIF_KAYIT, sistemAktoru: true });

    const satirlar = new Map(kayitSatirlari().map(([e, d]) => [e, d]));
    expect(satirlar.get('Durum')).toBe(`Pasif (${tarihSaat(PASIF)})`);
    expect(satirlar.get('Sistem aktörü')).toBe('Evet');
  });

  it('kolonu gelmeyen alanlar boş işaretle görünür', async () => {
    await goster({ id: ID, gorunenAd: 'Gizli' });

    expect(kayitSatirlari()).toEqual([
      ['Kullanıcı adı', '—'],
      ['Görünen ad', 'Gizli'],
      ['Telefon', '—'],
      ['Sistem aktörü', '—'],
      ['Durum', '—'],
      ['Unutulma zamanı', '—'],
      ['Oluşturma zamanı', '—'],
    ]);
  });

  it('durumu gelmeyen kayıtta ne pasife al ne yeniden aç görünür', async () => {
    await goster({ id: ID, gorunenAd: 'Gizli' });

    expect(dugme('Pasife al')).toBeNull();
    expect(dugme('Yeniden aç')).toBeNull();
  });
});

describe('KullaniciSayfasi hatalar', () => {
  it('404 bulunamadi dönünce Kayıt bulunamadı iletisi gösterilir', async () => {
    sahteFetch.mockResolvedValueOnce(hataCevabi('bulunamadi', 'Bulunamadı', 404));

    render(await sayfa(kurallar(...ISLER)));

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(screen.queryByRole('term')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('uuid olmayan kimlikte backend çağrılmadan Kayıt bulunamadı gösterilir', async () => {
    render(await sayfa(kurallar(...ISLER), '..'));

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce yetki iletisi gösterilir', async () => {
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    render(await sayfa(kurallar(...ISLER)));

    expect(screen.getByRole('alert').textContent).toBe('Bu sayfayı görme yetkin yok');
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401),
    );

    await expect(
      KullaniciSayfasi({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow('yonlendirildi:/oturum-bitti');
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });
});

describe('KullaniciSayfasi görünen ad', () => {
  it('değişiklik backend\'e PATCH ile gider, sayfa tazelenir ve güncel ad görünür', async () => {
    const yetki = kurallar(...ISLER);
    const { rerender } = await goster(ETKIN_KAYIT, yetki);
    sahteFetch.mockResolvedValueOnce(bosCevap());

    await userEvent.type(screen.getByLabelText('Yeni görünen ad'), ' Ada Kaya ');
    await userEvent.click(screen.getByRole('button', { name: 'Görünen adı değiştir' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[1]).toEqual({
      yol: YOL,
      yontem: 'PATCH',
      govde: { gorunenAd: 'Ada Kaya' },
    });

    // refresh sayfayı yeniden çizer; sayfa güncel kaydı backend'den okur.
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ ...ETKIN_KAYIT, gorunenAd: 'Ada Kaya' }, 200),
    );
    rerender(await sayfa(yetki));

    expect(istekler()[2]).toEqual({ yol: YOL, yontem: 'GET', govde: null });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ada Kaya');
    expect(screen.queryByText('Ada Yılmaz')).toBeNull();
  });

  it('boş ad backend çağrılmadan alan hatası verir', async () => {
    await goster(ETKIN_KAYIT);

    await userEvent.type(screen.getByLabelText('Yeni görünen ad'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Görünen adı değiştir' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Görünen ad boş olamaz');
    expect(screen.getByLabelText('Yeni görünen ad').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(sahteFetch).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi gösterilir', async () => {
    await goster(ETKIN_KAYIT);
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.type(screen.getByLabelText('Yeni görünen ad'), 'Ada Kaya');
    await userEvent.click(screen.getByRole('button', { name: 'Görünen adı değiştir' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('KullaniciSayfasi pasife al ve yeniden aç', () => {
  it('ilk düğme onay satırını açar ve backend henüz çağrılmamıştır; onaydan sonra doğru yola POST gider', async () => {
    await goster(ETKIN_KAYIT);

    await userEvent.click(screen.getByRole('button', { name: 'Pasife al' }));

    expect(screen.getByText('Kullanıcı pasife alınsın mı?')).toBeDefined();
    expect(sahteFetch).toHaveBeenCalledTimes(1);

    sahteFetch.mockResolvedValueOnce(bosCevap());
    await userEvent.click(screen.getByRole('button', { name: 'Evet, pasife al' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[1]).toEqual({
      yol: `${YOL}/pasife-al`,
      yontem: 'POST',
      govde: null,
    });
  });

  it('Vazgeç onay satırını kapatır ve backend çağrılmaz', async () => {
    await goster(ETKIN_KAYIT);

    await userEvent.click(screen.getByRole('button', { name: 'Pasife al' }));
    await userEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(screen.queryByText('Kullanıcı pasife alınsın mı?')).toBeNull();
    expect(dugme('Pasife al')).not.toBeNull();
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });

  it('409 cakisma dönünce backend\'in iletisi görünür ve sayfa tazelenmez', async () => {
    await goster(ETKIN_KAYIT);
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('cakisma', 'Son yönetici pasife alınamaz', 409),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Pasife al' }));
    await userEvent.click(screen.getByRole('button', { name: 'Evet, pasife al' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Son yönetici pasife alınamaz',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('etkin kayıtta yeniden aç görünmez; pasif kayıtta pasife al görünmez', async () => {
    await goster(ETKIN_KAYIT);
    expect(dugme('Yeniden aç')).toBeNull();
    cleanup();

    await goster(PASIF_KAYIT);
    expect(dugme('Pasife al')).toBeNull();
    expect(dugme('Yeniden aç')).not.toBeNull();
  });

  it('yeniden aç pasif kayıtta doğru yola POST gönderir ve sayfayı tazeler', async () => {
    await goster(PASIF_KAYIT);
    sahteFetch.mockResolvedValueOnce(bosCevap());

    await userEvent.click(screen.getByRole('button', { name: 'Yeniden aç' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[1]).toEqual({
      yol: `${YOL}/yeniden-ac`,
      yontem: 'POST',
      govde: null,
    });
  });
});

describe('KullaniciSayfasi parola belirleme kodu', () => {
  it('doğru yola POST gider ve kodu taşıyan adres bir kez gösterilir; kod hiçbir yere yazılmaz', async () => {
    await goster(ETKIN_KAYIT);
    sahteFetch.mockResolvedValueOnce(jsonCevap({ parolaBaglantisiKodu: KOD }, 201));

    await userEvent.click(
      screen.getByRole('button', { name: 'Parola belirleme kodu üret' }),
    );

    const kutu = await screen.findByRole('status');
    expect(istekler()[1]).toEqual({
      yol: `${YOL}/parola-baglantisi`,
      yontem: 'POST',
      govde: null,
    });
    expect(kutu.textContent).toContain(
      `http://panel.sinama:3100/parola-belirle?kod=${KOD}`,
    );
    expect(kutu.textContent).toContain('Bu kod yeniden gösterilmez');
    expect(screen.getAllByText(/parola-belirle\?kod=/)).toHaveLength(1);
    expect(window.location.href).not.toContain(KOD);
    expect(document.cookie).not.toContain(KOD);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('KullaniciSayfasi yetki', () => {
  it('bütün kurallar varken etkin kayıtta görünen ad formu, pasife al ve kod üret görünür', async () => {
    await goster(ETKIN_KAYIT);

    expect(screen.queryByRole('form', { name: 'Görünen adı değiştir' })).not.toBeNull();
    expect(dugme('Pasife al')).not.toBeNull();
    expect(dugme('Parola belirleme kodu üret')).not.toBeNull();
  });

  it('guncelle kuralı olmayan kişi görünen ad formunu görmez', async () => {
    await goster(ETKIN_KAYIT, isHaric('guncelle'));

    expect(screen.queryByRole('form', { name: 'Görünen adı değiştir' })).toBeNull();
    expect(screen.queryByLabelText('Yeni görünen ad')).toBeNull();
    expect(dugme('Pasife al')).not.toBeNull();
  });

  it('guncelle kuralı yalnız başka kolonlara verilmişse görünen ad formu görünmez', async () => {
    await goster(ETKIN_KAYIT, [
      ...isHaric('guncelle'),
      { action: 'guncelle', subject: 'Kullanici', fields: ['telefon'] },
    ]);

    expect(screen.queryByLabelText('Yeni görünen ad')).toBeNull();
  });

  it('pasife_al kuralı olmayan kişi pasife al düğmesini görmez', async () => {
    await goster(ETKIN_KAYIT, isHaric('pasife_al'));

    expect(dugme('Pasife al')).toBeNull();
    expect(dugme('Parola belirleme kodu üret')).not.toBeNull();
  });

  it('yeniden_ac kuralı olmayan kişi pasif kayıtta yeniden aç düğmesini görmez', async () => {
    await goster(PASIF_KAYIT, isHaric('yeniden_ac'));

    expect(dugme('Yeniden aç')).toBeNull();
    expect(dugme('Parola belirleme kodu üret')).not.toBeNull();
  });

  it('parola_baglantisi_uret kuralı olmayan kişi kod üret düğmesini görmez', async () => {
    await goster(ETKIN_KAYIT, isHaric('parola_baglantisi_uret'));

    expect(dugme('Parola belirleme kodu üret')).toBeNull();
    expect(dugme('Pasife al')).not.toBeNull();
  });

  it('koşulu bu kaydı tutmayan kuralla pasife al görünmez, tutan kayıtta görünür', async () => {
    const yalnizSistemDisi: YetkiKurali[] = [
      { action: 'pasife_al', subject: 'Kullanici', conditions: { sistemAktoru: false } },
    ];

    await goster({ ...ETKIN_KAYIT, sistemAktoru: true }, yalnizSistemDisi);
    expect(dugme('Pasife al')).toBeNull();
    cleanup();

    await goster(ETKIN_KAYIT, yalnizSistemDisi);
    expect(dugme('Pasife al')).not.toBeNull();
  });
});
