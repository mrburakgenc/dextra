// @vitest-environment node
import { createHmac } from 'node:crypto';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest, type NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config, proxy } from './proxy';

vi.mock('server-only', () => ({}));

const SIR = 'sinama-sirri-0123456789abcdefghijklmnop';
const SIMDI = 1768512600000;
const ADRES = '203.0.113.7';
const TARAYICI = 'Mozilla/5.0 (deneme)';

const sahteFetch = vi.fn<typeof fetch>();

function jsonCevap(govde: unknown, durum: number): Response {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { 'content-type': 'application/json' },
  });
}

// Panel sayfasına gelen istek; cerez: tarayıcının gönderdiği çerez başlığı.
function panelIstegi(cerez: string | null): NextRequest {
  const basliklar = new Headers({
    'x-forwarded-for': `${ADRES}, 10.0.0.1`,
    'user-agent': TARAYICI,
  });
  if (cerez !== null) {
    basliklar.set('cookie', cerez);
  }
  return new NextRequest('http://localhost:3100/kullanicilar', {
    headers: basliklar,
  });
}

const UC_CEREZ = 'dextra_yenileme=eski-yenileme; dextra_cihaz=cihaz-sirri';

// Çatı, süren isteğin değişen başlıklarını cevabın x-middleware-request-* başlıklarıyla taşır.
function surenIstekCerezi(cevap: NextResponse): string | null {
  return cevap.headers.get('x-middleware-request-cookie');
}

// İstek değişmeden sürer: çatıya "devam" der, çerez yazmaz, süren isteği değiştirmez.
function degismedenSurer(cevap: NextResponse): void {
  expect(cevap.headers.get('x-middleware-next')).toBe('1');
  expect(cevap.headers.get('set-cookie')).toBeNull();
  expect(cevap.headers.get('x-middleware-override-headers')).toBeNull();
}

beforeEach(() => {
  vi.useFakeTimers({ now: SIMDI, toFake: ['Date'] });
  vi.stubEnv('BACKEND_ADRESI', 'http://backend.sinama:3001');
  vi.stubEnv('ARACI_KATMAN_SIRRI', SIR);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubGlobal('fetch', sahteFetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ara katman: oturumun sessiz yenilenmesi', () => {
  it("erişim çerezi yokken backend'e doğru yol, yöntem, gövde ve imzayla tek istek atar", async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { erisimBelirteci: 'yeni-erisim', yenilemeBelirteci: 'yeni-yenileme' },
        200,
      ),
    );

    await proxy(panelIstegi(UC_CEREZ));

    expect(sahteFetch).toHaveBeenCalledTimes(1);
    const [url, init = {}] = sahteFetch.mock.calls[0] ?? [];
    expect(url instanceof URL ? url.href : url).toBe(
      'http://backend.sinama:3001/kimlik/oturum/yenile',
    );
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({
        yenilemeBelirteci: 'eski-yenileme',
        cihazSirri: 'cihaz-sirri',
      }),
    );
    const basliklar = new Headers(init.headers);
    const imza = createHmac('sha256', SIR)
      .update(`${ADRES}\n${TARAYICI}\n${String(SIMDI)}`, 'utf8')
      .digest('hex');
    expect(basliklar.get('x-istemci-adresi')).toBe(ADRES);
    expect(basliklar.get('x-istemci-tarayici')).toBe(TARAYICI);
    expect(basliklar.get('x-istemci-zaman')).toBe(String(SIMDI));
    expect(basliklar.get('x-istemci-imza')).toBe(imza);
    expect(basliklar.get('content-type')).toBe('application/json');
    expect(basliklar.get('authorization')).toBeNull();
  });

  it('başarıda süren istek yeni belirteçleri taşır, cevap iki yeni çerezi doğru özniteliklerle yazar', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { erisimBelirteci: 'yeni-erisim', yenilemeBelirteci: 'yeni-yenileme' },
        200,
      ),
    );

    const cevap = await proxy(panelIstegi(UC_CEREZ));

    expect(cevap.headers.get('x-middleware-next')).toBe('1');
    expect(cevap.headers.get('x-middleware-override-headers')).toContain(
      'cookie',
    );
    const suren = (surenIstekCerezi(cevap) ?? '').split('; ').map((c) => {
      const [ad = '', deger = ''] = c.split('=');
      return [ad, deger];
    });
    expect(Object.fromEntries(suren)).toEqual({
      dextra_yenileme: 'yeni-yenileme',
      dextra_cihaz: 'cihaz-sirri',
      dextra_erisim: 'yeni-erisim',
    });

    const ortak = { httpOnly: true, sameSite: 'lax', path: '/', secure: false };
    expect(cevap.cookies.getAll()).toEqual([
      {
        name: 'dextra_erisim',
        value: 'yeni-erisim',
        ...ortak,
        maxAge: 840,
        expires: new Date(SIMDI + 840 * 1000),
      },
      {
        name: 'dextra_yenileme',
        value: 'yeni-yenileme',
        ...ortak,
        maxAge: 604800,
        expires: new Date(SIMDI + 604800 * 1000),
      },
    ]);
    const setCookie = cevap.headers.getSetCookie();
    expect(setCookie).toHaveLength(2);
    for (const satir of setCookie) {
      expect(satir).toContain('HttpOnly');
    }
    expect(setCookie[0]).toContain('Max-Age=840');
    expect(setCookie[1]).toContain('Max-Age=604800');
  });

  it('backend 401 dönerse üç çerezi siler ve /giris adresine yönlendirir', async () => {
    sahteFetch.mockResolvedValue(
      jsonCevap(
        { kod: 'kimlik_gerekli', ileti: 'Oturum yenilenemedi', ayrinti: null },
        401,
      ),
    );

    const cevap = await proxy(panelIstegi(UC_CEREZ));

    expect(cevap.status).toBe(307);
    expect(cevap.headers.get('location')).toBe('http://localhost:3100/giris');
    const silinen = cevap.cookies.getAll();
    expect(silinen.map((c) => c.name)).toEqual([
      'dextra_erisim',
      'dextra_yenileme',
      'dextra_cihaz',
    ]);
    for (const cerez of silinen) {
      expect(cerez).toMatchObject({
        value: '',
        path: '/',
        expires: new Date(0),
      });
    }
  });

  it.each([
    [
      "backend'e ulaşılamaz",
      () => sahteFetch.mockRejectedValue(new TypeError('fetch failed')),
    ],
    [
      'backend 500 döner',
      () =>
        sahteFetch.mockResolvedValue(
          jsonCevap(
            { kod: 'beklenmeyen_hata', ileti: 'x', ayrinti: null },
            500,
          ),
        ),
    ],
    [
      'backend 200 ile sözleşmeye uymayan gövde döner',
      () =>
        sahteFetch.mockResolvedValue(
          jsonCevap({ erisimBelirteci: 'yeni-erisim' }, 200),
        ),
    ],
  ])('%s: çerezler değişmez ve istek sürer', async (_ad, kur) => {
    kur();

    const cevap = await proxy(panelIstegi(UC_CEREZ));

    expect(sahteFetch).toHaveBeenCalledTimes(1);
    degismedenSurer(cevap);
  });

  it("erişim çerezi varsa backend'e yenileme isteği gitmez", async () => {
    const cevap = await proxy(panelIstegi(`dextra_erisim=erisim; ${UC_CEREZ}`));

    expect(sahteFetch).not.toHaveBeenCalled();
    degismedenSurer(cevap);
  });

  it('üç çerez de yoksa backend çağrılmaz ve istek değişmeden sürer', async () => {
    const cevap = await proxy(panelIstegi(null));

    expect(sahteFetch).not.toHaveBeenCalled();
    degismedenSurer(cevap);
  });
});

describe('ara katmanın eşleme kuralı', () => {
  it.each([
    '/',
    '/kullanicilar',
    '/kullanicilar/yeni',
    '/kullanicilar/0b6f3c2e-1a2b-4c5d-8e9f-0a1b2c3d4e5f',
    '/roller?sayfa=2',
    '/kullanicilar.rsc',
    '/girisler',
  ])('panel yolunda (%s) çalışır', (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each([
    '/giris',
    '/giris/',
    '/parola-belirle',
    '/parola-belirle?kod=abc',
    '/oturum-bitti',
    '/_next/static/chunks/main.js',
    '/_next/image?url=%2Flogo.png&w=64&q=75',
    '/favicon.ico',
    '/robots.txt',
  ])(
    'açık sayfa, /oturum-bitti, çatının iç yolu ya da durağan dosyada (%s) çalışmaz',
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );
});
