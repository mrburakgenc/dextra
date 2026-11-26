import { cleanup, render, screen, within } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tarihSaat } from '../../../shared/bicim/bicim';
import type { YetkiKurali } from '../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../shared/yetki/yetki-saglayici';
import TeshisSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek çerez modülü ve gerçek backend isteği sahte çerez deposu ve sahte fetch ile koşar.
const depo = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}));
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

function hataCevabi(
  kod: string,
  ileti: string,
  durum: number,
  ayrinti: unknown = null,
): Response {
  return jsonCevap({ kod, ileti, ayrinti }, durum);
}

const KISI = '11111111-1111-4111-8111-111111111111';
const KAYIT = '22222222-2222-4222-8222-222222222222';
const IZIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa0001';
const YASAK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0002';
const BOZUK = 'cccccccc-cccc-4ccc-8ccc-cccccccc0003';
const MUAF = 'dddddddd-dddd-4ddd-8ddd-dddddddd0004';
const GIZLI = 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0005';
const RET_ZAMANI = '2026-11-26T09:30:00.000Z';

const KATALOG = [
  { id: 'i1', kaynak: 'Kullanici', eylem: 'oku' },
  { id: 'i2', kaynak: 'Oturum', eylem: 'kapat' },
];

const KURAL = {
  oncelik: 0,
  butunKolonlar: true,
  kolonlar: [],
  muaf: false,
  bozuk: false,
  degerlendirilemedi: false,
};

// İzin, kolon yasağı, bozuk yasak, muaf izin ve değerlendirilemeyen izin; üç kolonun kararı açık,
// kapalı ve belirsizdir.
const CEVAP = {
  tutanKurallar: [
    { ...KURAL, yetenekId: IZIN, etki: 'izin' },
    {
      ...KURAL,
      yetenekId: YASAK,
      etki: 'yasak',
      oncelik: 10,
      butunKolonlar: false,
      kolonlar: ['telefon', 'eposta'],
    },
    { ...KURAL, yetenekId: BOZUK, etki: 'yasak', oncelik: 100, bozuk: true },
    { ...KURAL, yetenekId: MUAF, etki: 'izin', muaf: true },
    { ...KURAL, yetenekId: GIZLI, etki: 'izin', degerlendirilemedi: true },
  ],
  kolonKararlari: [
    { kolon: 'gorunenAd', acik: true, kararVeren: IZIN },
    { kolon: 'telefon', acik: false, kararVeren: YASAK },
    { kolon: 'eposta', acik: null, kararVeren: GIZLI },
    { kolon: 'parola', acik: false, kararVeren: null },
  ],
  kayitKarari: { acik: true, kararVeren: MUAF },
  retKayitlari: [],
};

// Katalog yoldan tanınır; teşhis isteği verilen cevabı alır.
function backend(teshisCevabi: () => Response, katalogCevabi?: () => Response) {
  sahteFetch.mockImplementation((adres) => {
    const yol = adres instanceof URL ? adres.pathname : '';
    if (yol === '/kimlik/izin') {
      return Promise.resolve(
        katalogCevabi?.() ??
          jsonCevap(
            { kayitlar: KATALOG, sayfa: 1, boyut: 100, sonrakiVar: false },
            200,
          ),
      );
    }
    return Promise.resolve(teshisCevabi());
  });
}

const TESHIS: YetkiKurali[] = [
  { action: 'teshis', subject: 'Yetenek' },
  { action: 'oku', subject: 'Yetenek' },
];

const TAM_SORGU = { kullaniciId: KISI, izin: 'Kullanici:oku', kayitId: KAYIT };

async function goster(
  sorgu: Record<string, string | string[]> = {},
  kurallar: YetkiKurali[] = TESHIS,
) {
  render(
    <YetkiSaglayici kurallar={kurallar}>
      {await TeshisSayfasi({ searchParams: Promise.resolve(sorgu) })}
    </YetkiSaglayici>,
  );
}

function teshisIstekleri(): URL[] {
  return sahteFetch.mock.calls
    .map(([istek]) => istek)
    .filter(
      (istek): istek is URL =>
        istek instanceof URL && istek.pathname === '/kimlik/yetenek/teshis',
    );
}

function alanHatasi(etiket: string): string | null {
  const kimlik = screen.getByLabelText(etiket).getAttribute('aria-describedby');
  return kimlik === null
    ? null
    : (document.getElementById(kimlik)?.textContent ?? null);
}

function girdiDegeri(etiket: string): string {
  return screen.getByLabelText<HTMLInputElement>(etiket).value;
}

function tablo(ad: string): HTMLElement {
  return screen.getByRole('table', { name: ad });
}

function basliklar(ad: string): string[] {
  return within(tablo(ad))
    .getAllByRole('columnheader')
    .map((baslik) => baslik.textContent);
}

function satirlar(ad: string): string[][] {
  return within(tablo(ad))
    .getAllByRole('row')
    .slice(1)
    .map((satir) =>
      within(satir)
        .getAllByRole('cell')
        .map((hucre) => hucre.textContent),
    );
}

function baglantiAdresi(kapsam: HTMLElement, ad: string): string | null {
  return within(kapsam).getByRole('link', { name: ad }).getAttribute('href');
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

describe('TeshisSayfasi izin ve form', () => {
  it("Yetenek:teshis kuralı yokken (Yetenek:oku olsa da) form çizilmez, 'yetkin yok' iletisi görünür", async () => {
    backend(() => hataCevabi('yetki_yok', 'Bu işlem için yetki yok', 403));

    await goster(TAM_SORGU, [{ action: 'oku', subject: 'Yetenek' }]);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Teşhis',
    );
    expect(screen.getByRole('alert').textContent).toBe(
      'Bu sayfayı görme yetkin yok',
    );
    expect(screen.queryByRole('form', { name: 'Teşhis sorgusu' })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('kuralı olan kişide sorgusuz adreste form çizilir; izin seçimi katalogdan gelir, teşhis sorulmaz', async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster();

    const form = screen.getByRole('form', { name: 'Teşhis sorgusu' });
    expect(form.getAttribute('action')).toBe('/teshis');
    expect(form.getAttribute('method')).toBeNull();
    expect(
      screen.getByLabelText('Kullanıcı kimliği').getAttribute('name'),
    ).toBe('kullaniciId');
    expect(screen.getByLabelText('Kayıt kimliği').getAttribute('name')).toBe(
      'kayitId',
    );
    const secim = screen.getByLabelText('İzin');
    expect(secim.getAttribute('name')).toBe('izin');
    expect(
      within(secim)
        .getAllByRole('option')
        .map((secenek) => [secenek.getAttribute('value'), secenek.textContent]),
    ).toEqual([
      ['', 'Seç'],
      ['Kullanici:oku', 'Kullanici:oku'],
      ['Oturum:kapat', 'Oturum:kapat'],
    ]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(teshisIstekleri()).toHaveLength(0);
    const katalog = sahteFetch.mock.calls[0]?.[0];
    expect(katalog instanceof URL ? katalog.search : null).toBe(
      '?sayfa=1&boyut=100',
    );
  });

  it('izin kataloğu alınamazsa form yerine ileti görünür', async () => {
    backend(
      () => jsonCevap(CEVAP, 200),
      () => hataCevabi('yetki_yok', 'Bu işlem için yetki yok', 403),
    );

    await goster();

    expect(screen.queryByRole('form', { name: 'Teşhis sorgusu' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(
      'İzin listesi alınamadı',
    );
  });
});

describe('TeshisSayfasi doğrulama', () => {
  it('boş alanlar alan hatası verir ve teşhis backend’e sorulmaz', async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster({ kullaniciId: '', izin: '', kayitId: '' });

    expect(alanHatasi('Kullanıcı kimliği')).toBe(
      'Kullanıcı kimliği boş olamaz',
    );
    expect(alanHatasi('İzin')).toBe('İzin seçilmeli');
    expect(alanHatasi('Kayıt kimliği')).toBe('Kayıt kimliği boş olamaz');
    expect(teshisIstekleri()).toHaveLength(0);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('adreste yalnız bir alan varsa öbürleri eksik sayılır', async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster({ kullaniciId: KISI });

    expect(alanHatasi('Kullanıcı kimliği')).toBeNull();
    expect(alanHatasi('İzin')).toBe('İzin seçilmeli');
    expect(alanHatasi('Kayıt kimliği')).toBe('Kayıt kimliği boş olamaz');
    expect(teshisIstekleri()).toHaveLength(0);
  });

  it('bozuk kimlikler ve biçimsiz izin alan hatası verir, yazılan değerler formda kalır, teşhis sorulmaz', async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster({ kullaniciId: 'bozuk', izin: 'Kullanici', kayitId: '123' });

    expect(alanHatasi('Kullanıcı kimliği')).toBe(
      'Kullanıcı kimliği geçerli bir kimlik değil',
    );
    expect(alanHatasi('İzin')).toBe('İzin seçilmeli');
    expect(alanHatasi('Kayıt kimliği')).toBe(
      'Kayıt kimliği geçerli bir kimlik değil',
    );
    expect(girdiDegeri('Kullanıcı kimliği')).toBe('bozuk');
    expect(girdiDegeri('Kayıt kimliği')).toBe('123');
    expect(teshisIstekleri()).toHaveLength(0);
  });
});

describe('TeshisSayfasi sorgu ve sonuç', () => {
  it('adresle açılan sayfa aynı teşhis isteğini atar ve formu adresteki değerlerle açar', async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster(TAM_SORGU);

    const istekler = teshisIstekleri();
    expect(istekler).toHaveLength(1);
    expect(Object.fromEntries(istekler[0]?.searchParams ?? [])).toEqual({
      kullaniciId: KISI,
      kaynak: 'Kullanici',
      eylem: 'oku',
      kayitId: KAYIT,
    });
    expect(girdiDegeri('Kullanıcı kimliği')).toBe(KISI);
    expect(screen.getByLabelText<HTMLSelectElement>('İzin').value).toBe(
      'Kullanici:oku',
    );
    expect(girdiDegeri('Kayıt kimliği')).toBe(KAYIT);
  });

  it('kaydın bütünü kararı, tutan kurallar ve kolon kararları beklenen satırlarla çizilir; bozuk, muaf ve değerlendirilemeyen kural işaretlidir', async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster(TAM_SORGU);

    const butun = screen.getByRole('heading', {
      name: 'Kaydın bütünü',
    }).parentElement;
    if (butun === null) {
      throw new Error('kaydın bütünü bölümü yok');
    }
    expect(
      within(butun)
        .getAllByRole('definition')
        .map((dd) => dd.textContent),
    ).toEqual(['Açık', '…dddd0004']);
    expect(baglantiAdresi(butun, '…dddd0004')).toBe(`/yetenekler/${MUAF}`);

    expect(basliklar('Kaydı tutan kurallar')).toEqual([
      'Kural',
      'Etki',
      'Öncelik',
      'Kolonlar',
      'Muaf',
      'Bozuk',
      'Değerlendirilemedi',
    ]);
    expect(satirlar('Kaydı tutan kurallar')).toEqual([
      ['…aaaa0001', 'İzin', '0', 'Bütün kolonlar', 'Hayır', 'Hayır', 'Hayır'],
      [
        '…bbbb0002',
        'Yasak',
        '10',
        'telefon, eposta',
        'Hayır',
        'Hayır',
        'Hayır',
      ],
      ['…cccc0003', 'Yasak', '100', 'Bütün kolonlar', 'Hayır', 'Evet', 'Hayır'],
      ['…dddd0004', 'İzin', '0', 'Bütün kolonlar', 'Evet', 'Hayır', 'Hayır'],
      ['…eeee0005', 'İzin', '0', 'Bütün kolonlar', 'Hayır', 'Hayır', 'Evet'],
    ]);
    expect(baglantiAdresi(tablo('Kaydı tutan kurallar'), '…cccc0003')).toBe(
      `/yetenekler/${BOZUK}`,
    );

    expect(basliklar('Kolon kararları')).toEqual([
      'Kolon',
      'Karar',
      'Kararı veren kural',
    ]);
    expect(satirlar('Kolon kararları')).toEqual([
      ['gorunenAd', 'Açık', '…aaaa0001'],
      ['telefon', 'Kapalı', '…bbbb0002'],
      ['eposta', 'Belirsiz', '…eeee0005'],
      ['parola', 'Kapalı', '—'],
    ]);
    expect(baglantiAdresi(tablo('Kolon kararları'), '…bbbb0002')).toBe(
      `/yetenekler/${YASAK}`,
    );
  });

  it("ret kaydı yokken 'Ret kaydı yok' yazar; varken ret tablosu çizilir", async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster(TAM_SORGU);

    expect(screen.getByText('Ret kaydı yok')).toBeDefined();
    expect(
      screen.queryByRole('table', { name: 'Son ret kayıtları' }),
    ).toBeNull();
    cleanup();

    backend(() =>
      jsonCevap(
        {
          ...CEVAP,
          retKayitlari: [
            {
              zaman: RET_ZAMANI,
              eylem: 'kapat',
              kaynak: 'Oturum',
              kayitId: KAYIT,
              kararVerenYasakId: YASAK,
            },
            {
              zaman: RET_ZAMANI,
              eylem: 'olustur',
              kaynak: 'Kullanici',
              kayitId: null,
              kararVerenYasakId: BOZUK,
            },
          ],
        },
        200,
      ),
    );

    await goster(TAM_SORGU);

    expect(screen.queryByText('Ret kaydı yok')).toBeNull();
    expect(basliklar('Son ret kayıtları')).toEqual([
      'Zaman',
      'Eylem',
      'Kaynak',
      'Kayıt',
      'Kararı veren yasak',
    ]);
    expect(satirlar('Son ret kayıtları')).toEqual([
      [tarihSaat(RET_ZAMANI), 'kapat', 'Oturum', '…22222222', '…bbbb0002'],
      [tarihSaat(RET_ZAMANI), 'olustur', 'Kullanici', '—', '…cccc0003'],
    ]);
    expect(baglantiAdresi(tablo('Son ret kayıtları'), '…cccc0003')).toBe(
      `/yetenekler/${BOZUK}`,
    );
  });

  it('kaydın bütünü kararı belirsiz ve kararı veren yoksa öyle yazılır; tutan kural yoksa ileti görünür', async () => {
    backend(() =>
      jsonCevap(
        {
          ...CEVAP,
          tutanKurallar: [],
          kayitKarari: { acik: null, kararVeren: null },
        },
        200,
      ),
    );

    await goster(TAM_SORGU);

    const butun = screen.getByRole('heading', {
      name: 'Kaydın bütünü',
    }).parentElement;
    expect(
      within(butun ?? document.body)
        .getAllByRole('definition')
        .map((dd) => dd.textContent),
    ).toEqual(['Belirsiz', '—']);
    expect(screen.getByText('Tutan kural yok')).toBeDefined();
    expect(
      screen.queryByRole('table', { name: 'Kaydı tutan kurallar' }),
    ).toBeNull();
  });

  it('kaydın kolon değeri gösterilmez: cevaba değer eklense de sayfada görünmez, değer kolonu yoktur', async () => {
    backend(() =>
      jsonCevap(
        { ...CEVAP, kayit: { gorunenAd: 'Gizli Ad', telefon: '05550000000' } },
        200,
      ),
    );

    await goster(TAM_SORGU);

    const metin = document.body.textContent;
    expect(metin).not.toContain('Gizli Ad');
    expect(metin).not.toContain('05550000000');
    expect(
      screen.getAllByRole('columnheader').map((baslik) => baslik.textContent),
    ).not.toContain('Değer');
  });

  it('Yetenek kolonları tür düzeyinde okunamıyorsa etki, öncelik ve kolonlar kolonu çizilmez', async () => {
    backend(() => jsonCevap(CEVAP, 200));

    await goster(TAM_SORGU, [
      { action: 'teshis', subject: 'Yetenek' },
      { action: 'oku', subject: 'Yetenek', fields: ['id'] },
    ]);

    expect(basliklar('Kaydı tutan kurallar')).toEqual([
      'Kural',
      'Muaf',
      'Bozuk',
      'Değerlendirilemedi',
    ]);
  });
});

describe('TeshisSayfasi hata', () => {
  it("bulunamadı cevabı 'Kayıt bulunamadı' iletisiyle gösterilir; form kalır", async () => {
    backend(() => hataCevabi('bulunamadi', 'Kayıt bulunamadı', 404));

    await goster(TAM_SORGU);

    expect(screen.getByRole('alert').textContent).toBe('Kayıt bulunamadı');
    expect(screen.getByRole('form', { name: 'Teşhis sorgusu' })).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('backend’in doğrulama hatası alanına yazılır; kaynak hatası izin seçiminin altındadır', async () => {
    backend(() =>
      hataCevabi('dogrulama_hatasi', 'İstek doğrulanamadı', 400, [
        { alan: 'kaynak', neden: 'kaynak ve eylem izin kataloğunda yok' },
      ]),
    );

    await goster({ ...TAM_SORGU, izin: 'Yok:ucur' });

    expect(teshisIstekleri()).toHaveLength(1);
    expect(alanHatasi('İzin')).toBe('kaynak ve eylem izin kataloğunda yok');
    expect(alanHatasi('Kullanıcı kimliği')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it("kuralı olan kişiye backend 403 dönerse 'yetkin yok' iletisi görünür", async () => {
    backend(() => hataCevabi('yetki_yok', 'Bu işlem için yetki yok', 403));

    await goster(TAM_SORGU);

    expect(screen.getByRole('alert').textContent).toBe(
      'Bu sayfayı görme yetkin yok',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('backend 401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    backend(() => hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401));

    await expect(goster(TAM_SORGU)).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
    expect(redirect).toHaveBeenCalledWith('/oturum-bitti');
  });
});
