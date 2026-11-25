import { cleanup, render, screen, within } from '@testing-library/react';
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

// Kayıt bulununca sayfa üyelikleri, grup ve rol listelerini de ister; sayfa çizilirken atılan
// istek sayısı budur. İşin isteği bunlardan sonra gelir.
const SAYFA_ISTEKLERI = 4;
const LISTE_ISTEKLERI = ['/kimlik/uyelik', '/kimlik/grup', '/kimlik/rol'].map((yol) => ({
  yol,
  yontem: 'GET',
  govde: null,
}));

function listeCevabi(kayitlar: object[], sonrakiVar = false): Response {
  return jsonCevap({ kayitlar, sayfa: 1, boyut: 100, sonrakiVar }, 200);
}

// Sıraya konmuş cevap yoksa liste uçları bu kayıtlarla cevap verir; başka istek ulaşılamaz olur.
function listeler(
  uyelikler: object[] = [],
  gruplar: object[] = [],
  roller: object[] = [],
  hatalar: Partial<Record<'uyelik' | 'grup' | 'rol', () => Response>> = {},
) {
  sahteFetch.mockImplementation((adres) => {
    const yol = adres instanceof URL ? adres.pathname : '';
    if (yol === '/kimlik/uyelik') {
      return Promise.resolve(hatalar.uyelik?.() ?? listeCevabi(uyelikler));
    }
    if (yol === '/kimlik/grup') {
      return Promise.resolve(hatalar.grup?.() ?? listeCevabi(gruplar));
    }
    if (yol === '/kimlik/rol') {
      return Promise.resolve(hatalar.rol?.() ?? listeCevabi(roller));
    }
    return Promise.reject(new Error('beklenmeyen istek'));
  });
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
  listeler();
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

    expect(istekler()).toEqual([
      { yol: YOL, yontem: 'GET', govde: null },
      ...LISTE_ISTEKLERI,
    ]);
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
    expect(istekler()[SAYFA_ISTEKLERI]).toEqual({
      yol: YOL,
      yontem: 'PATCH',
      govde: { gorunenAd: 'Ada Kaya' },
    });

    // refresh sayfayı yeniden çizer; sayfa güncel kaydı backend'den okur.
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ ...ETKIN_KAYIT, gorunenAd: 'Ada Kaya' }, 200),
    );
    rerender(await sayfa(yetki));

    expect(istekler()[SAYFA_ISTEKLERI + 1]).toEqual({ yol: YOL, yontem: 'GET', govde: null });
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
    expect(sahteFetch).toHaveBeenCalledTimes(SAYFA_ISTEKLERI);
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
    expect(sahteFetch).toHaveBeenCalledTimes(SAYFA_ISTEKLERI);

    sahteFetch.mockResolvedValueOnce(bosCevap());
    await userEvent.click(screen.getByRole('button', { name: 'Evet, pasife al' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[SAYFA_ISTEKLERI]).toEqual({
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
    expect(sahteFetch).toHaveBeenCalledTimes(SAYFA_ISTEKLERI);
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
    expect(istekler()[SAYFA_ISTEKLERI]).toEqual({
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
    expect(istekler()[SAYFA_ISTEKLERI]).toEqual({
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

// Üyelikler bölümü (GV-088).
const KOK_GRUP = '11111111-1111-4111-8111-111111111111';
const SATIS = '22222222-2222-4222-8222-222222222222';
const SUPER_ADMIN = '33333333-3333-4333-8333-333333333333';
const UYE = '44444444-4444-4444-8444-444444444444';
const SILINMIS_GRUP = '55555555-5555-4555-8555-555555555555';
const SILINMIS_ROL = '66666666-6666-4666-8666-666666666666';
const UYELIK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADSIZ_UYELIK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const YENI_UYELIK = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const VERILME = '2026-02-10T08:15:00.000Z';

const GRUPLAR = [
  { id: KOK_GRUP, ustGrupId: null, ad: 'Merkez' },
  { id: SATIS, ustGrupId: KOK_GRUP, ad: 'Satış' },
];
const ROLLER = [
  { id: SUPER_ADMIN, kod: 'SuperAdmin', ad: 'Süper yönetici' },
  { id: UYE, kod: null, ad: 'Üye' },
];
const UYELIKLER = [
  { id: UYELIK, kullaniciId: ID, grupId: KOK_GRUP, rolId: UYE, olusturmaZamani: VERILME },
  // Grubu ve rolü listelerde olmayan, verilme zamanı gelmeyen üyelik.
  { id: ADSIZ_UYELIK, kullaniciId: ID, grupId: SILINMIS_GRUP, rolId: SILINMIS_ROL },
];

function uyelikKurallari(...isler: string[]): YetkiKurali[] {
  return isler.map((action) => ({ action, subject: 'Uyelik' }));
}

const TUM_KURALLAR = [
  ...kurallar(...ISLER),
  ...uyelikKurallari('oku', 'olustur', 'sil'),
];

function istekAdresi(yol: string): URL {
  const adres = sahteFetch.mock.calls
    .map(([a]) => a)
    .find((a): a is URL => a instanceof URL && a.pathname === yol);
  if (adres === undefined) {
    throw new Error(`${yol} isteği atılmadı`);
  }
  return adres;
}

// Üyelikler tablosunun satırları (başlık satırı hariç).
function uyelikSatirlari(): HTMLElement[] {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

// Satırın grup, rol ve verilme zamanı hücreleri.
function hucreler(satir: HTMLElement | undefined): (string | null)[] {
  return within(satir ?? document.body)
    .getAllByRole('cell')
    .slice(0, 3)
    .map((hucre) => hucre.textContent);
}

function uyelikFormu() {
  return screen.queryByRole('form', { name: 'Üyelik ver' });
}

async function uyelikVer(grup: string, rol: string) {
  await userEvent.selectOptions(screen.getByLabelText('Grup'), grup);
  await userEvent.selectOptions(screen.getByLabelText('Rol'), rol);
  await userEvent.click(screen.getByRole('button', { name: 'Üyelik ver' }));
}

describe('KullaniciSayfasi üyelikler', () => {
  it('backend\'e kullaniciId süzgeciyle istek gider; grup ve rol adları listelerden eşlenir, bulunamayan boş işaretle görünür', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);

    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    const uyelik = istekAdresi('/kimlik/uyelik');
    expect(uyelik.searchParams.get('kullaniciId')).toBe(ID);
    expect(uyelik.searchParams.get('boyut')).toBe('100');
    for (const yol of ['/kimlik/grup', '/kimlik/rol']) {
      const adres = istekAdresi(yol);
      expect(adres.searchParams.get('sayfa')).toBe('1');
      expect(adres.searchParams.get('boyut')).toBe('100');
    }
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Üyelikler');
    const [ilk, adsiz] = uyelikSatirlari();
    expect(hucreler(ilk)).toEqual(['Merkez', 'Üye', tarihSaat(VERILME)]);
    expect(hucreler(adsiz)).toEqual(['—', '—', '—']);
  });

  it('üyelik yoksa Kayıt yok gösterilir', async () => {
    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    expect(screen.getByText('Kayıt yok')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('üyelik listesi 403 dönünce bölümde yetki iletisi gösterilir', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER, {
      uyelik: () => hataCevabi('yetki_yok', 'Yetki yok', 403),
    });

    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    expect(screen.getByRole('alert').textContent).toBe('Bu sayfayı görme yetkin yok');
    expect(screen.queryByRole('table')).toBeNull();
    expect(uyelikFormu()).toBeNull();
  });

  it('rol listesi 401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER, {
      rol: () => hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401),
    });
    sahteFetch.mockResolvedValueOnce(jsonCevap(ETKIN_KAYIT, 200));

    await expect(
      KullaniciSayfasi({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow('yonlendirildi:/oturum-bitti');
  });
});

describe('KullaniciSayfasi üyelik ver', () => {
  it('seçilen grup ve rol kişinin kimliğiyle POST edilir; sayfa tazelenir ve güncel liste görünür', async () => {
    listeler([], GRUPLAR, ROLLER);
    const { rerender } = await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch.mockResolvedValueOnce(jsonCevap({ id: YENI_UYELIK }, 201));

    await uyelikVer('Satış', 'Üye');

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[SAYFA_ISTEKLERI]).toEqual({
      yol: '/kimlik/uyelik',
      yontem: 'POST',
      govde: { kullaniciId: ID, grupId: SATIS, rolId: UYE },
    });
    expect(screen.queryByRole('status')).toBeNull();

    // refresh sayfayı yeniden çizer; sayfa güncel üyelikleri backend'den okur.
    listeler(
      [{ id: YENI_UYELIK, kullaniciId: ID, grupId: SATIS, rolId: UYE, olusturmaZamani: VERILME }],
      GRUPLAR,
      ROLLER,
    );
    sahteFetch.mockResolvedValueOnce(jsonCevap(ETKIN_KAYIT, 200));
    rerender(await sayfa(TUM_KURALLAR));

    expect(uyelikSatirlari().map(hucreler)).toEqual([
      ['Satış', 'Üye', tarihSaat(VERILME)],
    ]);
  });

  it('cevap kod taşıyınca parola belirleme adresi ve not bir kez görünür; kod hiçbir yere yazılmaz', async () => {
    listeler([], GRUPLAR, ROLLER);
    const { rerender } = await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch.mockResolvedValueOnce(
      jsonCevap({ id: YENI_UYELIK, parolaBaglantisiKodu: KOD }, 201),
    );

    await uyelikVer('Merkez', 'Süper yönetici');

    expect(
      (await screen.findByText(/parola-belirle\?kod=/)).textContent,
    ).toBe(`http://panel.sinama:3100/parola-belirle?kod=${KOD}`);
    expect(istekler()[SAYFA_ISTEKLERI]?.govde).toEqual({
      kullaniciId: ID,
      grupId: KOK_GRUP,
      rolId: SUPER_ADMIN,
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    // Tazelenen sayfada adres ve not yine bir kez görünür.
    sahteFetch.mockResolvedValueOnce(jsonCevap(ETKIN_KAYIT, 200));
    rerender(await sayfa(TUM_KURALLAR));

    expect(screen.getAllByText(/parola-belirle\?kod=/)).toHaveLength(1);
    expect(
      screen.getAllByText('Bu kişinin oturumları kapatıldı ve parolası sıfırlandı'),
    ).toHaveLength(1);
    expect(window.location.href).not.toContain(KOD);
    expect(document.cookie).not.toContain(KOD);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('seçim yapılmadan gönderilince backend çağrılmadan alan hataları verir', async () => {
    listeler([], GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    await userEvent.click(screen.getByRole('button', { name: 'Üyelik ver' }));

    const hatalar = await screen.findAllByRole('alert');
    expect(hatalar.map((h) => h.textContent)).toEqual(['Grup seçilmeli', 'Rol seçilmeli']);
    expect(screen.getByLabelText('Grup').getAttribute('aria-invalid')).toBe('true');
    expect(sahteFetch).toHaveBeenCalledTimes(SAYFA_ISTEKLERI);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('409 cakisma dönünce backend\'in iletisi görünür ve sayfa tazelenmez', async () => {
    listeler([], GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('cakisma', 'Grup ya da rol yok ya da silinmiş', 409),
    );

    await uyelikVer('Satış', 'Üye');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Grup ya da rol yok ya da silinmiş',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi görünür', async () => {
    listeler([], GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await uyelikVer('Satış', 'Üye');

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('KullaniciSayfasi üyelik ver yazılanın korunması', () => {
  function secilen(etiket: string): string {
    const secim = screen.getByLabelText(etiket);
    return secim instanceof HTMLSelectElement ? secim.value : '';
  }

  it('409 dönünce seçilen grup ve rol formda kalır', async () => {
    listeler([], GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('cakisma', 'Grup ya da rol yok ya da silinmiş', 409),
    );

    await uyelikVer('Satış', 'Üye');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Grup ya da rol yok ya da silinmiş',
    );
    expect(secilen('Grup')).toBe(SATIS);
    expect(secilen('Rol')).toBe(UYE);
  });

  it('alan hatasında seçilen grup formda kalır', async () => {
    listeler([], GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    await userEvent.selectOptions(screen.getByLabelText('Grup'), 'Satış');
    await userEvent.click(screen.getByRole('button', { name: 'Üyelik ver' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Rol seçilmeli');
    expect(secilen('Grup')).toBe(SATIS);
    expect(secilen('Rol')).toBe('');
    expect(sahteFetch).toHaveBeenCalledTimes(SAYFA_ISTEKLERI);
  });

  it('hatadan sonraki başarıda seçimler bugünkü gibi boşalır', async () => {
    listeler([], GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch
      .mockResolvedValueOnce(hataCevabi('cakisma', 'Grup ya da rol yok ya da silinmiş', 409))
      .mockResolvedValueOnce(jsonCevap({ id: YENI_UYELIK }, 201));

    await uyelikVer('Satış', 'Üye');
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Üyelik ver' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[SAYFA_ISTEKLERI + 1]?.govde).toEqual({
      kullaniciId: ID,
      grupId: SATIS,
      rolId: UYE,
    });
    expect(secilen('Grup')).toBe('');
    expect(secilen('Rol')).toBe('');
  });
});

describe('KullaniciSayfasi üyelik kaldır', () => {
  it('ilk düğme onay satırını açar ve backend henüz çağrılmamıştır; onaydan sonra doğru kimlikle DELETE gider', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    const [ilk] = uyelikSatirlari();
    await userEvent.click(
      within(ilk ?? document.body).getByRole('button', { name: 'Kaldır' }),
    );

    expect(screen.getByText('Üyelik kaldırılsın mı?')).toBeDefined();
    expect(sahteFetch).toHaveBeenCalledTimes(SAYFA_ISTEKLERI);

    sahteFetch.mockResolvedValueOnce(bosCevap());
    await userEvent.click(screen.getByRole('button', { name: 'Evet, kaldır' }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[SAYFA_ISTEKLERI]).toEqual({
      yol: `/kimlik/uyelik/${UYELIK}`,
      yontem: 'DELETE',
      govde: null,
    });
  });

  it('Vazgeç onay satırını kapatır ve backend çağrılmaz', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    const [ilk] = uyelikSatirlari();
    await userEvent.click(
      within(ilk ?? document.body).getByRole('button', { name: 'Kaldır' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(screen.queryByText('Üyelik kaldırılsın mı?')).toBeNull();
    expect(sahteFetch).toHaveBeenCalledTimes(SAYFA_ISTEKLERI);
  });

  it('409 cakisma dönünce backend\'in iletisi görünür ve sayfa tazelenmez', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch.mockResolvedValueOnce(
      hataCevabi('cakisma', 'Kök üyelik kaldırılamaz', 409),
    );

    const [ilk] = uyelikSatirlari();
    await userEvent.click(
      within(ilk ?? document.body).getByRole('button', { name: 'Kaldır' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Evet, kaldır' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Kök üyelik kaldırılamaz',
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi görünür', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    const [ilk] = uyelikSatirlari();
    await userEvent.click(
      within(ilk ?? document.body).getByRole('button', { name: 'Kaldır' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Evet, kaldır' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('KullaniciSayfasi üyelik yetki', () => {
  it('bütün kurallar varken bölüm, her satırda Kaldır ve üyelik ver formu görünür', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, TUM_KURALLAR);

    expect(screen.getByRole('heading', { name: 'Üyelikler' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Kaldır' })).toHaveLength(2);
    expect(uyelikFormu()).not.toBeNull();
  });

  it('oku kuralı olmayan kişi bölümü görmez', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, [
      ...kurallar(...ISLER),
      ...uyelikKurallari('olustur', 'sil'),
    ]);

    expect(screen.queryByRole('heading', { name: 'Üyelikler' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(dugme('Kaldır')).toBeNull();
    expect(uyelikFormu()).toBeNull();
  });

  it('olustur kuralı olmayan kişi üyelik ver formunu görmez', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, [...kurallar(...ISLER), ...uyelikKurallari('oku', 'sil')]);

    expect(uyelikFormu()).toBeNull();
    expect(screen.queryByLabelText('Grup')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Kaldır' })).toHaveLength(2);
  });

  it('sil kuralı olmayan kişi Kaldır düğmesini görmez', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, [
      ...kurallar(...ISLER),
      ...uyelikKurallari('oku', 'olustur'),
    ]);

    expect(dugme('Kaldır')).toBeNull();
    expect(uyelikFormu()).not.toBeNull();
  });

  it('sil kuralının koşulu kayıt düzeyinde sorulur: yalnız tutan satırda Kaldır görünür', async () => {
    listeler(UYELIKLER, GRUPLAR, ROLLER);
    await goster(ETKIN_KAYIT, [
      ...kurallar(...ISLER),
      ...uyelikKurallari('oku', 'olustur'),
      { action: 'sil', subject: 'Uyelik', conditions: { grupId: KOK_GRUP } },
    ]);

    const [ilk, adsiz] = uyelikSatirlari();
    expect(
      within(ilk ?? document.body).queryByRole('button', { name: 'Kaldır' }),
    ).not.toBeNull();
    expect(
      within(adsiz ?? document.body).queryByRole('button', { name: 'Kaldır' }),
    ).toBeNull();
  });
});
