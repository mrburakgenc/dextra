// @vitest-environment node
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erisimBelirteciniOku } from '../oturum/cerezler';
import { backendIstegi } from './istek';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('../oturum/cerezler', () => ({ erisimBelirteciniOku: vi.fn() }));

const SIR = 'sinama-sirri-0123456789abcdefghijklmnop';
const SIMDI = 1768512600000;

const sahteFetch = vi.fn<typeof fetch>();

function jsonCevap(govde: unknown, durum: number): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { 'content-type': 'application/json' },
  });
}

// Sahte fetch'e giden son isteğin adresi ve başlıkları.
function sonIstek(): {
  url: string | Request;
  init: RequestInit;
  basliklar: Headers;
} {
  const cagri = sahteFetch.mock.calls.at(-1);
  if (cagri === undefined) {
    throw new Error('fetch çağrılmadı');
  }
  const [url, init = {}] = cagri;
  return {
    url: url instanceof URL ? url.href : url,
    init,
    basliklar: new Headers(init.headers),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: SIMDI, toFake: ['Date'] });
  vi.stubEnv('BACKEND_ADRESI', 'http://backend.sinama:3001');
  vi.stubEnv('ARACI_KATMAN_SIRRI', SIR);
  vi.stubGlobal('fetch', sahteFetch);
  vi.mocked(headers).mockResolvedValue(
    new Headers({
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'user-agent': 'Mozilla/5.0 (deneme)',
    }),
  );
  vi.mocked(erisimBelirteciniOku).mockResolvedValue('erisim-belirteci');
  sahteFetch.mockResolvedValue(jsonCevap({ tamam: true }, 200));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('backend isteği', () => {
  it('adresi kurar, gövdeyi JSON gönderir ve başarıyı döner', async () => {
    const sonuc = await backendIstegi({
      yol: '/kimlik/giris',
      yontem: 'POST',
      govde: { kullaniciAdi: 'ali' },
      oturumlu: false,
    });

    const { url, init, basliklar } = sonIstek();
    expect(url).toBe('http://backend.sinama:3001/kimlik/giris');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"kullaniciAdi":"ali"}');
    expect(basliklar.get('content-type')).toBe('application/json');
    expect(sonuc).toEqual({ basarili: true, durum: 200, govde: { tamam: true } });
  });

  it('dört imza başlığını ekler; imza başlıklardaki değerlerle yeniden hesaplanınca tutar', async () => {
    await backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: false });

    const { basliklar } = sonIstek();
    const adres = basliklar.get('x-istemci-adresi');
    const tarayici = basliklar.get('x-istemci-tarayici');
    const zaman = basliklar.get('x-istemci-zaman');
    expect(adres).toBe('203.0.113.7');
    expect(tarayici).toBe('Mozilla/5.0 (deneme)');
    expect(zaman).toBe(String(SIMDI));
    const beklenen = createHmac('sha256', SIR)
      .update(`${adres ?? ''}\n${tarayici ?? ''}\n${zaman ?? ''}`, 'utf8')
      .digest('hex');
    expect(basliklar.get('x-istemci-imza')).toBe(beklenen);
  });

  it('oturumlu istekte Authorization başlığı çerezdeki belirteci taşır', async () => {
    await backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: true });

    expect(sonIstek().basliklar.get('authorization')).toBe(
      'Bearer erisim-belirteci',
    );
  });

  it('oturumsuz istekte Authorization başlığı yoktur', async () => {
    await backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: false });

    expect(sonIstek().basliklar.has('authorization')).toBe(false);
    expect(erisimBelirteciniOku).not.toHaveBeenCalled();
  });

  it('backend hata gövdesini koda, iletiye, ayrıntıya ve duruma çevirir', async () => {
    const ayrinti = [{ alan: 'parola', neden: 'Çok kısa' }];
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kod: 'dogrulama_hatasi', ileti: 'İstek doğrulanamadı', ayrinti },
        400,
      ),
    );

    await expect(
      backendIstegi({ yol: '/x', yontem: 'POST', govde: {}, oturumlu: false }),
    ).resolves.toEqual({
      basarili: false,
      hata: {
        kod: 'dogrulama_hatasi',
        ileti: 'İstek doğrulanamadı',
        ayrinti,
        durum: 400,
      },
    });
  });

  it('ağ hatası ulasilamadi döner, fırlatmaz', async () => {
    sahteFetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: false }),
    ).resolves.toEqual({
      basarili: false,
      hata: {
        kod: 'ulasilamadi',
        ileti: 'Şu an ulaşılamıyor',
        ayrinti: null,
        durum: 0,
      },
    });
  });

  it.each([
    ['başarılı durumda', 200],
    ['hata durumunda', 502],
  ])('JSON olmayan cevap (%s) ulasilamadi döner', async (_ad, durum) => {
    sahteFetch.mockResolvedValue(
      new Response('<html>vekil hatası</html>', {
        status: durum,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const sonuc = await backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: false });
    expect(sonuc).toEqual({
      basarili: false,
      hata: { kod: 'ulasilamadi', ileti: 'Şu an ulaşılamıyor', ayrinti: null, durum },
    });
  });

  it('gövdesiz cevap null gövdeli başarıdır', async () => {
    sahteFetch.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      backendIstegi({ yol: '/x', yontem: 'POST', oturumlu: true }),
    ).resolves.toEqual({ basarili: true, durum: 204, govde: null });
  });
});

describe('ortam değişkenleri', () => {
  it.each(['BACKEND_ADRESI', 'ARACI_KATMAN_SIRRI'])(
    '%s eksikken hata adını söyler, öbür değerleri söylemez',
    async (ad) => {
      vi.stubEnv(ad, undefined);

      const hata = await backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: false }).then(
        () => undefined,
        (e: unknown) => e,
      );
      if (!(hata instanceof Error)) throw new Error('hata beklenirdi');
      const ileti = hata.message;
      expect(ileti).toContain(ad);
      expect(ileti).not.toContain(SIR);
      expect(ileti).not.toContain('backend.sinama');
      expect(sahteFetch).not.toHaveBeenCalled();
    },
  );

  it('şemasız BACKEND_ADRESI ulaşılamadı sayılmaz, fırlatılır', async () => {
    vi.stubEnv('BACKEND_ADRESI', 'backend:3001');

    await expect(
      backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: false }),
    ).rejects.toThrow(TypeError);
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('32 karakterden kısa sırda hata adı söyler, değeri söylemez', async () => {
    const kisa = 'k'.repeat(15) + 'gizli-deger';
    vi.stubEnv('ARACI_KATMAN_SIRRI', kisa);

    const hata = await backendIstegi({ yol: '/x', yontem: 'GET', oturumlu: false }).then(
      () => undefined,
      (e: unknown) => e,
    );
    if (!(hata instanceof Error)) throw new Error('hata beklenirdi');
    const ileti = hata.message;
    expect(ileti).toContain('ARACI_KATMAN_SIRRI');
    expect(ileti).toContain('32');
    expect(ileti).not.toContain(kisa);
    expect(ileti).not.toContain('gizli-deger');
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});
