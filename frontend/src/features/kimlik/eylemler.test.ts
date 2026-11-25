// @vitest-environment node
import { redirect } from 'next/navigation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackendSonucu } from '../../shared/backend/istek';
import { backendIstegi } from '../../shared/backend/istek';
import { cikisYap, girisYap, parolaBelirle } from './eylemler';
import { BOS_FORM_DURUMU } from './form-durumu';

vi.mock('server-only', () => ({}));
vi.mock('../../shared/backend/istek', () => ({ backendIstegi: vi.fn() }));
// Gerçek çerez modülü sahte çerez deposuyla koşar; yazılan ve silinen çerezler depodan okunur.
const depo = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(depo) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((yol: string) => {
    throw new Error(`yonlendirildi:${yol}`);
  }),
}));

function form(alanlar: Record<string, string>): FormData {
  const veri = new FormData();
  for (const [ad, deger] of Object.entries(alanlar)) {
    veri.set(ad, deger);
  }
  return veri;
}

function hata(kod: string, durum: number, ayrinti: unknown = null): BackendSonucu {
  return { basarili: false, hata: { kod, ileti: `${kod} iletisi`, ayrinti, durum } };
}

const ULASILAMADI = hata('ulasilamadi', 0);

afterEach(() => {
  vi.clearAllMocks();
});

describe('girisYap', () => {
  const GECERLI = { kullaniciAdi: 'ali', parola: 'gizli-parola' };

  it('backend giriş ucuna doğru yol, yöntem ve gövdeyle oturumsuz istek atar', async () => {
    vi.mocked(backendIstegi).mockResolvedValue(hata('kimlik_gerekli', 401));

    await girisYap(BOS_FORM_DURUMU, form(GECERLI));

    expect(backendIstegi).toHaveBeenCalledExactlyOnceWith({
      yol: '/kimlik/oturum/giris',
      yontem: 'POST',
      govde: { kullaniciAdi: 'ali', parola: 'gizli-parola' },
      oturumlu: false,
    });
  });

  it('başarıda üç çerezi yazar ve / adresine yönlendirir', async () => {
    vi.mocked(backendIstegi).mockResolvedValue({
      basarili: true,
      durum: 200,
      govde: {
        erisimBelirteci: 'erisim',
        yenilemeBelirteci: 'yenileme',
        cihazSirri: 'cihaz',
        oturumId: 'oturum-1',
      },
    });

    await expect(girisYap(BOS_FORM_DURUMU, form(GECERLI))).rejects.toThrow(
      'yonlendirildi:/',
    );

    expect(depo.set.mock.calls.map(([ad, deger]: unknown[]) => [ad, deger])).toEqual([
      ['dextra_erisim', 'erisim'],
      ['dextra_yenileme', 'yenileme'],
      ['dextra_cihaz', 'cihaz'],
    ]);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/');
  });

  it('erişim çerezi 14 dakika, yenileme ve cihaz çerezleri 7 gün yaşar; üçü de betiğe kapalıdır', async () => {
    vi.mocked(backendIstegi).mockResolvedValue({
      basarili: true,
      durum: 200,
      govde: { erisimBelirteci: 'erisim', yenilemeBelirteci: 'yenileme', cihazSirri: 'cihaz' },
    });

    await expect(girisYap(BOS_FORM_DURUMU, form(GECERLI))).rejects.toThrow(
      'yonlendirildi:/',
    );

    expect(
      depo.set.mock.calls.map(([ad, , secenek]: unknown[]) => [ad, secenek]),
    ).toEqual([
      ['dextra_erisim', expect.objectContaining({ httpOnly: true, maxAge: 14 * 60 })],
      ['dextra_yenileme', expect.objectContaining({ httpOnly: true, maxAge: 7 * 24 * 60 * 60 })],
      ['dextra_cihaz', expect.objectContaining({ httpOnly: true, maxAge: 7 * 24 * 60 * 60 })],
    ]);
  });

  it('401 kimlik_gerekli gelince tek ileti döner ve çerez yazmaz', async () => {
    vi.mocked(backendIstegi).mockResolvedValue(hata('kimlik_gerekli', 401));

    await expect(girisYap(BOS_FORM_DURUMU, form(GECERLI))).resolves.toEqual({
      genelHata: 'Kullanıcı adı ya da parola hatalı',
      alanHatalari: {},
    });
    expect(depo.set).not.toHaveBeenCalled();
    expect(depo.delete).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    [{ kullaniciAdi: '', parola: '' }, ['kullaniciAdi', 'parola']],
    [{ kullaniciAdi: 'ali', parola: '' }, ['parola']],
    [{ kullaniciAdi: '', parola: 'x' }, ['kullaniciAdi']],
  ])('boş alanda (%o) backend çağrılmaz ve alan hatası döner', async (alanlar, hataliAlanlar) => {
    const durum = await girisYap(BOS_FORM_DURUMU, form(alanlar));

    expect(Object.keys(durum.alanHatalari).sort()).toEqual(hataliAlanlar);
    expect(durum.genelHata).toBeNull();
    expect(backendIstegi).not.toHaveBeenCalled();
  });

  it('alan formda hiç yoksa da backend çağrılmaz ve alan hatası döner', async () => {
    const durum = await girisYap(BOS_FORM_DURUMU, new FormData());

    expect(durum.alanHatalari).toEqual({
      kullaniciAdi: 'Kullanıcı adı boş olamaz',
      parola: 'Parola boş olamaz',
    });
    expect(backendIstegi).not.toHaveBeenCalled();
  });

  it('backend\'e ulaşılamayınca "Şu an ulaşılamıyor" döner ve çerez yazmaz', async () => {
    vi.mocked(backendIstegi).mockResolvedValue(ULASILAMADI);

    await expect(girisYap(BOS_FORM_DURUMU, form(GECERLI))).resolves.toEqual({
      genelHata: 'Şu an ulaşılamıyor',
      alanHatalari: {},
    });
    expect(depo.set).not.toHaveBeenCalled();
  });
});

describe('cikisYap', () => {
  it('backend\'e oturumlu çıkış isteği atar, çerezleri siler ve /giris adresine yönlendirir', async () => {
    vi.mocked(backendIstegi).mockResolvedValue({ basarili: true, durum: 204, govde: null });

    await expect(cikisYap()).rejects.toThrow('yonlendirildi:/giris');

    expect(backendIstegi).toHaveBeenCalledExactlyOnceWith({
      yol: '/kimlik/oturum/cikis',
      yontem: 'POST',
      oturumlu: true,
    });
    expect(depo.delete.mock.calls).toEqual([
      ['dextra_erisim'],
      ['dextra_yenileme'],
      ['dextra_cihaz'],
    ]);
  });

  it.each([
    ['401', hata('kimlik_gerekli', 401)],
    ['500', hata('beklenmeyen_hata', 500)],
    ['ulaşılamadı', ULASILAMADI],
  ])('backend hata dönse de (%s) çerezleri siler ve /giris adresine yönlendirir', async (_ad, sonuc) => {
    vi.mocked(backendIstegi).mockResolvedValue(sonuc);

    await expect(cikisYap()).rejects.toThrow('yonlendirildi:/giris');

    expect(depo.delete).toHaveBeenCalledTimes(3);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/giris');
  });
});

describe('parolaBelirle', () => {
  const PAROLA_15 = 'a'.repeat(15);

  it('14 karakterlik parolada backend çağrılmaz ve parola alanına hata döner', async () => {
    const parola = 'a'.repeat(14);
    const durum = await parolaBelirle(
      BOS_FORM_DURUMU,
      form({ kod: 'kod-1', parola, parolaTekrar: parola }),
    );

    expect(durum).toEqual({
      genelHata: null,
      alanHatalari: { parola: 'Parola en az 15 karakter olmalı' },
    });
    expect(backendIstegi).not.toHaveBeenCalled();
  });

  it('birbirini tutmayan tekrarda backend çağrılmaz ve tekrar alanına hata döner', async () => {
    const durum = await parolaBelirle(
      BOS_FORM_DURUMU,
      form({ kod: 'kod-1', parola: PAROLA_15, parolaTekrar: `${PAROLA_15}b` }),
    );

    expect(durum).toEqual({
      genelHata: null,
      alanHatalari: { parolaTekrar: 'Parolalar birbirini tutmuyor' },
    });
    expect(backendIstegi).not.toHaveBeenCalled();
  });

  it('kısa parola ve tutmayan tekrar birlikte iki alan hatası verir', async () => {
    const durum = await parolaBelirle(
      BOS_FORM_DURUMU,
      form({ kod: 'kod-1', parola: 'kisa', parolaTekrar: 'baska' }),
    );

    expect(Object.keys(durum.alanHatalari).sort()).toEqual(['parola', 'parolaTekrar']);
    expect(backendIstegi).not.toHaveBeenCalled();
  });

  it('uzunluğu Unicode kod noktasıyla sayar: 15 emoji (30 UTF-16 birimi) geçer, 129 kod noktası geçmez', async () => {
    vi.mocked(backendIstegi).mockResolvedValue({ basarili: true, durum: 204, govde: null });
    const emoji = '😀'.repeat(15);
    await expect(
      parolaBelirle(BOS_FORM_DURUMU, form({ kod: 'k', parola: emoji, parolaTekrar: emoji })),
    ).rejects.toThrow('yonlendirildi:/giris');

    const uzun = 'ç'.repeat(129);
    const durum = await parolaBelirle(
      BOS_FORM_DURUMU,
      form({ kod: 'k', parola: uzun, parolaTekrar: uzun }),
    );
    expect(durum.alanHatalari).toEqual({
      parola: 'Parola en çok 128 karakter olabilir',
    });
    expect(backendIstegi).toHaveBeenCalledTimes(1);
  });

  it('15 karakterlik parolayı backend\'e { kod, parola } ile gönderir ve /giris adresine yönlendirir', async () => {
    vi.mocked(backendIstegi).mockResolvedValue({ basarili: true, durum: 204, govde: null });

    await expect(
      parolaBelirle(
        BOS_FORM_DURUMU,
        form({ kod: 'kod-1', parola: PAROLA_15, parolaTekrar: PAROLA_15 }),
      ),
    ).rejects.toThrow('yonlendirildi:/giris');

    expect(backendIstegi).toHaveBeenCalledExactlyOnceWith({
      yol: '/kimlik/parola/belirle',
      yontem: 'POST',
      govde: { kod: 'kod-1', parola: PAROLA_15 },
      oturumlu: false,
    });
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/giris');
  });

  const gecerliForm = () =>
    form({ kod: 'kod-1', parola: PAROLA_15, parolaTekrar: PAROLA_15 });

  it('backend\'in dogrulama_hatasi cevabını parola alan hatasına çevirir', async () => {
    vi.mocked(backendIstegi).mockResolvedValue(
      hata('dogrulama_hatasi', 400, [{ alan: 'parola', neden: 'Parola çok uzun' }]),
    );

    await expect(parolaBelirle(BOS_FORM_DURUMU, gecerliForm())).resolves.toEqual({
      genelHata: null,
      alanHatalari: { parola: 'Parola çok uzun' },
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ['geçersiz kod', hata('kod_gecersiz', 400)],
    ['beklenmeyen hata', hata('beklenmeyen_hata', 500)],
    ['parola alanı taşımayan doğrulama hatası', hata('dogrulama_hatasi', 400, [{ alan: 'kod', neden: 'x' }])],
  ])('backend\'in öbür hatasını (%s) tek iletiye çevirir', async (_ad, sonuc) => {
    vi.mocked(backendIstegi).mockResolvedValue(sonuc);

    await expect(parolaBelirle(BOS_FORM_DURUMU, gecerliForm())).resolves.toEqual({
      genelHata: 'Parola belirlenemedi. Bağlantı geçersiz ya da süresi dolmuş olabilir.',
      alanHatalari: {},
    });
  });

  it('backend\'e ulaşılamayınca "Şu an ulaşılamıyor" döner', async () => {
    vi.mocked(backendIstegi).mockResolvedValue(ULASILAMADI);

    await expect(parolaBelirle(BOS_FORM_DURUMU, gecerliForm())).resolves.toEqual({
      genelHata: 'Şu an ulaşılamıyor',
      alanHatalari: {},
    });
  });

  it('kod boşsa backend çağrılmaz ve genel hata döner', async () => {
    const durum = await parolaBelirle(
      BOS_FORM_DURUMU,
      form({ kod: '', parola: PAROLA_15, parolaTekrar: PAROLA_15 }),
    );

    expect(durum.genelHata).toBe('Bağlantıda kod yok');
    expect(backendIstegi).not.toHaveBeenCalled();
  });
});
