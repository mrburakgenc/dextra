import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOS_FORM_DURUMU } from '../../../features/kimlik/form-durumu';
import { oturumKapat } from '../../../features/kimlik/oturum/oturum-eylemleri';
import { tarihSaat } from '../../../shared/bicim/bicim';
import type { YetkiKurali } from '../../../shared/yetki/yetki';
import { YetkiSaglayici } from '../../../shared/yetki/yetki-saglayici';
import OturumlarSayfasi from './page';

vi.mock('server-only', () => ({}));
// Gerçek sayfa, gerçek Server Action ve gerçek backend isteği sahte çerez deposu ve sahte fetch ile
// koşar.
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

const KISI = '0b8f6a1e-3c2d-4e5f-8a9b-1c2d3e4f5a6b';
const OBUR_KISI = '7d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6';
const BU_ID = '11111111-2222-4333-8444-555555555555';
const OBUR_ID = '99999999-8888-4777-8666-555555555555';
const BASLANGIC_1 = '2026-11-20T08:00:00.000Z';
const SON_1 = '2026-11-25T09:15:00.000Z';
const BASLANGIC_2 = '2026-11-18T12:30:00.000Z';
const SON_2 = '2026-11-24T18:45:00.000Z';

const BU_OTURUM = {
  id: BU_ID,
  kullaniciId: KISI,
  girisYontemi: 'parola',
  baslangicZamani: BASLANGIC_1,
  mutlakBitisZamani: '2026-11-27T08:00:00.000Z',
  sonDondurmeZamani: SON_1,
  ipAdresi: '10.0.0.1',
  tarayiciBilgisi: 'Firefox',
  kapatilmaZamani: null,
  kapatilmaNedeni: null,
};
const OBUR_OTURUM = {
  ...BU_OTURUM,
  id: OBUR_ID,
  baslangicZamani: BASLANGIC_2,
  sonDondurmeZamani: SON_2,
  ipAdresi: '10.0.0.2',
  tarayiciBilgisi: 'Safari',
};

function listeCevabi(
  ek: Partial<{ kayitlar: unknown[]; sayfa: number; sonrakiVar: boolean }> = {},
) {
  return jsonCevap(
    {
      kayitlar: [BU_OTURUM, OBUR_OTURUM],
      sayfa: 1,
      boyut: 20,
      sonrakiVar: false,
      buOturumId: BU_ID,
      ...ek,
    },
    200,
  );
}

const BUTUN_KURALLAR: YetkiKurali[] = [
  { action: 'oku', subject: 'Oturum' },
  { action: 'kapat', subject: 'Oturum' },
];

async function sayfa(sorgu: Record<string, string | string[]>, kurallar: YetkiKurali[]) {
  return (
    <YetkiSaglayici kurallar={kurallar}>
      {await OturumlarSayfasi({ searchParams: Promise.resolve(sorgu) })}
    </YetkiSaglayici>
  );
}

// Sayfa korumalı düzenin yetki sağlayıcısı içinde çizilir; ilk fetch cevabı listedir.
async function goster(
  sorgu: Record<string, string | string[]> = {},
  kurallar: YetkiKurali[] = BUTUN_KURALLAR,
  cevap: Response = listeCevabi(),
) {
  sahteFetch.mockResolvedValueOnce(cevap);
  return render(await sayfa(sorgu, kurallar));
}

// Backend'e giden isteklerin yolu, sorgusu, yöntemi ve gövdesi.
function istekler() {
  return sahteFetch.mock.calls.map(([adres, init]) => {
    if (!(adres instanceof URL)) {
      throw new Error('backend isteği URL nesnesiyle atılmadı');
    }
    const govde: unknown =
      typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    return { yol: adres.pathname, sorgu: adres.search, yontem: init?.method, govde };
  });
}

function hucreler(satir: HTMLElement): (string | null)[] {
  return within(satir)
    .getAllByRole('cell')
    .map((h) => h.textContent);
}

function satirlar(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

function baslikMetinleri(): (string | null)[] {
  return screen.getAllByRole('columnheader').map((h) => h.textContent);
}

function baglanti(ad: string): string | null {
  return screen.getByRole('link', { name: ad }).getAttribute('href');
}

const BU_ADI = `${tarihSaat(BASLANGIC_1)} başlayan …${BU_ID.slice(-8)} oturumu`;
const OBUR_ADI = `${tarihSaat(BASLANGIC_2)} başlayan …${OBUR_ID.slice(-8)} oturumu`;

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
});

describe('OturumlarSayfasi liste', () => {
  it('varsayılan istekte açık oturumlar başlangıç zamanı azalan sırayla oturumlu GET ile istenir', async () => {
    await goster();

    expect(istekler()).toEqual([
      {
        yol: '/kimlik/oturum',
        sorgu: '?sayfa=1&sirala=-baslangicZamani&acik=true',
        yontem: 'GET',
        govde: null,
      },
    ]);
    const [, init] = sahteFetch.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer erisim');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Oturumlar');
  });

  it('iki kayıt tabloya dökülür; buOturumId satırı Bu oturum işaretini taşır', async () => {
    await goster();

    expect(baslikMetinleri()).toEqual([
      'Başlangıç ▼',
      'Son etkinlik',
      'Adres',
      'Tarayıcı bilgisi',
      'Durum',
      'İşler',
    ]);
    const [bu, obur] = satirlar();
    expect(hucreler(bu ?? document.body).slice(0, 5)).toEqual([
      tarihSaat(BASLANGIC_1),
      tarihSaat(SON_1),
      '10.0.0.1',
      'Firefox',
      'Açık Bu oturum',
    ]);
    expect(hucreler(obur ?? document.body).slice(0, 5)).toEqual([
      tarihSaat(BASLANGIC_2),
      tarihSaat(SON_2),
      '10.0.0.2',
      'Safari',
      'Açık',
    ]);
    expect(screen.getAllByText('Bu oturum')).toHaveLength(1);
  });

  it('kayıtta gelmeyen kolon boş işaretle gösterilir', async () => {
    await goster({}, BUTUN_KURALLAR, listeCevabi({ kayitlar: [{ id: OBUR_ID }] }));

    const [satir] = satirlar();
    expect(hucreler(satir ?? document.body).slice(0, 5)).toEqual([
      '—',
      '—',
      '—',
      '—',
      'Açık',
    ]);
  });

  it('kayıt yoksa Kayıt yok iletisi gösterilir', async () => {
    await goster({}, BUTUN_KURALLAR, listeCevabi({ kayitlar: [] }));

    expect(screen.getByText('Kayıt yok')).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('OturumlarSayfasi geçmiş oturumlar', () => {
  const KAPATILAN = {
    ...OBUR_OTURUM,
    kapatilmaZamani: '2026-11-24T19:00:00.000Z',
    kapatilmaNedeni: 'sahibi_kapatti',
  };
  const SURESI_DOLAN = {
    ...BU_OTURUM,
    id: '22222222-3333-4444-8555-666666666666',
  };
  const TANINMAYAN = {
    ...KAPATILAN,
    id: '33333333-4444-4555-8666-777777777777',
    kapatilmaNedeni: 'yeni_neden',
  };

  it('acik=false gider; durum kapatılanda neden etiketini, kapatılmayanda Süresi doldu gösterir; tanınmayan kod olduğu gibi yazılır', async () => {
    await goster(
      { acik: 'false' },
      BUTUN_KURALLAR,
      listeCevabi({ kayitlar: [KAPATILAN, SURESI_DOLAN, TANINMAYAN] }),
    );

    expect(istekler()[0]?.sorgu).toBe('?sayfa=1&sirala=-baslangicZamani&acik=false');
    expect(satirlar().map((satir) => hucreler(satir).at(-1))).toEqual([
      'Kapatıldı: Sahibi kapattı',
      'Süresi doldu',
      'Kapatıldı: yeni_neden',
    ]);
  });

  it.each([
    ['cikis', 'Çıkış'],
    ['yonetici', 'Yönetici kapattı'],
    ['parola_degisimi', 'Parola değişti'],
    ['pasife_alma', 'Hesap pasife alındı'],
    ['oturum_siniri', 'Oturum sınırı'],
    ['sure', 'Süresi doldu'],
    ['adres_degisti', 'Adres değişti'],
    ['cihaz_uymadi', 'Cihaz uymadı'],
    ['yeniden_kullanim', 'Güvenlik: belirteç yeniden kullanıldı'],
    ['tutarsiz_nesil', 'Güvenlik: tutarsız belirteç'],
  ])('%s nedeni "%s" etiketiyle gösterilir', async (kod, etiket) => {
    await goster(
      { acik: 'false' },
      BUTUN_KURALLAR,
      listeCevabi({ kayitlar: [{ ...KAPATILAN, kapatilmaNedeni: kod }] }),
    );

    expect(hucreler(satirlar()[0] ?? document.body).at(-1)).toBe(`Kapatıldı: ${etiket}`);
  });

  it('kapatılma zamanı gelmeyen kayıtta durum boş işarettir', async () => {
    await goster({ acik: 'false' }, BUTUN_KURALLAR, listeCevabi({ kayitlar: [{ id: OBUR_ID }] }));

    expect(hucreler(satirlar()[0] ?? document.body).at(-1)).toBe('—');
  });

  it('geçmiş görünümde Kapat düğmesi ve İşler kolonu yoktur', async () => {
    await goster({ acik: 'false' }, BUTUN_KURALLAR, listeCevabi({ kayitlar: [KAPATILAN] }));

    expect(screen.queryByRole('button', { name: /^Kapat/ })).toBeNull();
    expect(baslikMetinleri()).not.toContain('İşler');
  });
});

describe('OturumlarSayfasi kullanıcı süzgeci', () => {
  it('adresteki geçerli kullaniciId backend\'e gider ve başlık kişinin oturumlarını söyler', async () => {
    await goster({ kullaniciId: KISI });

    expect(istekler()[0]?.sorgu).toBe(
      `?sayfa=1&sirala=-baslangicZamani&acik=true&kullaniciId=${KISI}`,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Kullanıcının oturumları',
    );
  });

  it.each([['kimlik-degil'], [''], ['0b8f6a1e'], [[KISI, KISI]]])(
    'geçersiz kullaniciId (%o) backend\'e gitmez ve süzgeç yok sayılır',
    async (deger) => {
      await goster({ kullaniciId: deger });

      expect(istekler()[0]?.sorgu).toBe('?sayfa=1&sirala=-baslangicZamani&acik=true');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Oturumlar');
    },
  );

  it('süzgeç yokken kayıtlar birden çok kişiye aitse Kullanıcı kolonu kısaltılmış kimlikle kayıt sayfasına bağlanır', async () => {
    await goster(
      {},
      BUTUN_KURALLAR,
      listeCevabi({ kayitlar: [BU_OTURUM, { ...OBUR_OTURUM, kullaniciId: OBUR_KISI }] }),
    );

    expect(baslikMetinleri()[0]).toBe('Kullanıcı');
    expect(baglanti(`…${KISI.slice(-8)}`)).toBe(`/kullanicilar/${KISI}`);
    expect(baglanti(`…${OBUR_KISI.slice(-8)}`)).toBe(`/kullanicilar/${OBUR_KISI}`);
  });

  it('kayıtlar tek kişiye aitse ya da süzgeç varsa Kullanıcı kolonu yoktur', async () => {
    await goster();
    expect(baslikMetinleri()).not.toContain('Kullanıcı');
    cleanup();

    await goster(
      { kullaniciId: KISI },
      BUTUN_KURALLAR,
      listeCevabi({ kayitlar: [BU_OTURUM, { ...OBUR_OTURUM, kullaniciId: OBUR_KISI }] }),
    );
    expect(baslikMetinleri()).not.toContain('Kullanıcı');
  });
});

describe('OturumlarSayfasi gezinti', () => {
  it('görünüm bağlantıları sıralamayı ve kişi süzgecini korur, ilk sayfaya döner', async () => {
    await goster({ sayfa: '2', sirala: 'sonDondurmeZamani', kullaniciId: KISI }, BUTUN_KURALLAR, listeCevabi({ sayfa: 2 }));

    expect(baglanti('Açık oturumlar')).toBe(
      `/oturumlar?sirala=sonDondurmeZamani&acik=true&kullaniciId=${KISI}`,
    );
    expect(baglanti('Geçmiş oturumlar')).toBe(
      `/oturumlar?sirala=sonDondurmeZamani&acik=false&kullaniciId=${KISI}`,
    );
    expect(
      screen.getByRole('link', { name: 'Açık oturumlar' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('sıralama başlıkları yönü çevirir; sayfalama görünümü ve süzgeci korur', async () => {
    await goster(
      { sayfa: '2', acik: 'false', kullaniciId: KISI },
      BUTUN_KURALLAR,
      listeCevabi({ sayfa: 2, sonrakiVar: true }),
    );

    const suzgec = `acik=false&kullaniciId=${KISI}`;
    expect(baglanti('Başlangıç')).toBe(`/oturumlar?sirala=baslangicZamani&${suzgec}`);
    expect(baglanti('Son etkinlik')).toBe(`/oturumlar?sirala=sonDondurmeZamani&${suzgec}`);
    expect(baglanti('Önceki')).toBe(`/oturumlar?sayfa=1&sirala=-baslangicZamani&${suzgec}`);
    expect(baglanti('Sonraki')).toBe(`/oturumlar?sayfa=3&sirala=-baslangicZamani&${suzgec}`);
  });

  it('geçersiz sayfa, sıralama ve görünüm varsayılana döner', async () => {
    await goster({ sayfa: 'abc', sirala: 'ipAdresi', acik: 'belki' });

    expect(istekler()[0]?.sorgu).toBe('?sayfa=1&sirala=-baslangicZamani&acik=true');
  });
});

describe('OturumlarSayfasi kapat', () => {
  it('ilk düğme onay satırını açar ve backend henüz çağrılmamıştır; onaydan sonra doğru kimlikle POST gider, liste yeniden istenir', async () => {
    const { rerender } = await goster();

    await userEvent.click(screen.getByRole('button', { name: `Kapat: ${OBUR_ADI}` }));

    expect(screen.getByText('Oturum kapatılsın mı?')).toBeDefined();
    expect(sahteFetch).toHaveBeenCalledTimes(1);

    sahteFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await userEvent.click(screen.getByRole('button', { name: `Evet, kapat: ${OBUR_ADI}` }));

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(istekler()[1]).toEqual({
      yol: `/kimlik/oturum/${OBUR_ID}/kapat`,
      sorgu: '',
      yontem: 'POST',
      govde: null,
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(depo.delete).not.toHaveBeenCalled();

    // refresh sayfayı yeniden çizer; sayfa güncel listeyi backend'den okur.
    sahteFetch.mockResolvedValueOnce(listeCevabi({ kayitlar: [BU_OTURUM] }));
    rerender(await sayfa({}, BUTUN_KURALLAR));

    expect(istekler()[2]).toEqual({
      yol: '/kimlik/oturum',
      sorgu: '?sayfa=1&sirala=-baslangicZamani&acik=true',
      yontem: 'GET',
      govde: null,
    });
    expect(satirlar()).toHaveLength(1);
  });

  it('Vazgeç onay satırını kapatır ve backend çağrılmaz', async () => {
    await goster();

    await userEvent.click(screen.getByRole('button', { name: `Kapat: ${OBUR_ADI}` }));
    await userEvent.click(screen.getByRole('button', { name: `Vazgeç: ${OBUR_ADI} açık kalsın` }));

    expect(screen.queryByText('Oturum kapatılsın mı?')).toBeNull();
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });

  it('satırların düğme adları farklıdır ve görünen yazı Kapat kalır', async () => {
    await goster();

    const dugmeler = screen.getAllByRole('button', { name: /^Kapat: / });
    expect(dugmeler.map((d) => d.getAttribute('aria-label'))).toEqual([
      `Kapat: ${BU_ADI}`,
      `Kapat: ${OBUR_ADI}`,
    ]);
    expect(dugmeler.map((d) => d.textContent)).toEqual(['Kapat', 'Kapat']);
  });

  it('aynı dakikada açılan, kimliğinin baş tarafı aynı iki oturumun düğme adları farklıdır', async () => {
    // Kimlikler zaman sıralıdır: baş tarafları aynı, sonları farklı.
    const ILK = '019a6b2c-7d10-7e2f-8a3b-4c5d91b2c3d4';
    const IKINCI = '019a6b2c-7d10-7e2f-8a3b-4c5de5f6a7b8';
    await goster(
      {},
      BUTUN_KURALLAR,
      listeCevabi({
        kayitlar: [
          { ...BU_OTURUM, id: ILK },
          { ...BU_OTURUM, id: IKINCI },
        ],
      }),
    );

    const dugmeler = screen.getAllByRole('button', { name: /^Kapat: / });
    expect(dugmeler.map((d) => d.getAttribute('aria-label'))).toEqual([
      `Kapat: ${tarihSaat(BASLANGIC_1)} başlayan …91b2c3d4 oturumu`,
      `Kapat: ${tarihSaat(BASLANGIC_1)} başlayan …e5f6a7b8 oturumu`,
    ]);
  });

  it('bu oturumun onay satırı oturumun biteceğini söyler ve formla işaret gider', async () => {
    await goster();

    await userEvent.click(screen.getByRole('button', { name: `Kapat: ${BU_ADI}` }));

    expect(screen.getByText('Bu oturum kapatılsın mı? Oturumun biter.')).toBeDefined();
    const form = screen.getByRole('button', { name: `Evet, kapat: ${BU_ADI}` }).closest('form');
    expect(form?.querySelector('input[name="buOturum"]')?.getAttribute('value')).toBe('evet');
    expect(sahteFetch).toHaveBeenCalledTimes(1);
  });

  it('409 cakisma dönünce backend\'in iletisi görünür ve liste tazelenmez', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('cakisma', 'Oturum zaten kapalı', 409));

    await userEvent.click(screen.getByRole('button', { name: `Kapat: ${OBUR_ADI}` }));
    await userEvent.click(screen.getByRole('button', { name: `Evet, kapat: ${OBUR_ADI}` }));

    expect((await screen.findByRole('alert')).textContent).toBe('Oturum zaten kapalı');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('403 yetki_yok dönünce iş için yetki iletisi görünür', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('yetki_yok', 'Yetki yok', 403));

    await userEvent.click(screen.getByRole('button', { name: `Kapat: ${OBUR_ADI}` }));
    await userEvent.click(screen.getByRole('button', { name: `Evet, kapat: ${OBUR_ADI}` }));

    expect((await screen.findByRole('alert')).textContent).toBe('Bu iş için yetkin yok');
  });

  it('404 bulunamadi dönünce Kayıt bulunamadı iletisi görünür', async () => {
    await goster();
    sahteFetch.mockResolvedValueOnce(hataCevabi('bulunamadi', 'Yok', 404));

    await userEvent.click(screen.getByRole('button', { name: `Kapat: ${OBUR_ADI}` }));
    await userEvent.click(screen.getByRole('button', { name: `Evet, kapat: ${OBUR_ADI}` }));

    expect((await screen.findByRole('alert')).textContent).toBe('Kayıt bulunamadı');
  });
});

// Yönlendirme çatının işidir; iş doğrudan çağrılarak sınanır.
describe('oturumKapat', () => {
  function form(alanlar: Record<string, string>): FormData {
    const veri = new FormData();
    for (const [ad, deger] of Object.entries(alanlar)) {
      veri.set(ad, deger);
    }
    return veri;
  }

  // Server Action içindeki iç yönlendirmede rota işleyicisinin Set-Cookie başlıkları tarayıcıya
  // ulaşmaz; çerezler yönlendirmeden önce burada silinmelidir.
  it('kapatılan bu oturumsa POST\'tan sonra üç çerez silinir ve /oturum-bitti yoluna gidilir, liste tazelenmez', async () => {
    sahteFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      oturumKapat(BOS_FORM_DURUMU, form({ id: BU_ID, buOturum: 'evet' })),
    ).rejects.toThrow('yonlendirildi:/oturum-bitti');

    expect(istekler()).toEqual([
      { yol: `/kimlik/oturum/${BU_ID}/kapat`, sorgu: '', yontem: 'POST', govde: null },
    ]);
    expect(depo.delete.mock.calls).toEqual([
      ['dextra_erisim'],
      ['dextra_yenileme'],
      ['dextra_cihaz'],
    ]);
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('bu oturumun kapatılması backend\'de başarısızsa yönlendirilmez, ileti döner', async () => {
    sahteFetch.mockResolvedValueOnce(hataCevabi('cakisma', 'Oturum zaten kapalı', 409));

    const durum = await oturumKapat(BOS_FORM_DURUMU, form({ id: BU_ID, buOturum: 'evet' }));

    expect(durum.genelHata).toBe('Oturum zaten kapalı');
    expect(redirect).not.toHaveBeenCalled();
    expect(depo.delete).not.toHaveBeenCalled();
  });

  it('uuid olmayan kimlikte backend çağrılmadan Kayıt bulunamadı döner', async () => {
    const durum = await oturumKapat(BOS_FORM_DURUMU, form({ id: '../cikis' }));

    expect(durum.genelHata).toBe('Kayıt bulunamadı');
    expect(sahteFetch).not.toHaveBeenCalled();
  });

  it('401 dönünce çerezler silinir ve giriş ekranına dönülür', async () => {
    sahteFetch.mockResolvedValueOnce(hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401));

    await expect(oturumKapat(BOS_FORM_DURUMU, form({ id: OBUR_ID }))).rejects.toThrow(
      'yonlendirildi:/giris',
    );
    expect(depo.delete).toHaveBeenCalledTimes(3);
  });
});

describe('OturumlarSayfasi yetki', () => {
  it('Oturum:kapat kuralı olmayan kişi Kapat düğmesini görmez', async () => {
    await goster({}, [{ action: 'oku', subject: 'Oturum' }]);

    expect(screen.queryByRole('button', { name: /^Kapat/ })).toBeNull();
    expect(satirlar()).toHaveLength(2);
  });

  it('kapat kuralı kayıt düzeyinde sorulur: yalnız koşulu tutan satırda Kapat görünür', async () => {
    await goster(
      {},
      [
        { action: 'oku', subject: 'Oturum' },
        { action: 'kapat', subject: 'Oturum', conditions: { ipAdresi: '10.0.0.2' } },
      ],
    );

    expect(
      screen.getAllByRole('button', { name: /^Kapat: / }).map((d) => d.getAttribute('aria-label')),
    ).toEqual([`Kapat: ${OBUR_ADI}`]);
  });
});

describe('OturumlarSayfasi hatalar', () => {
  it('403 yetki_yok dönünce yetki iletisi gösterilir', async () => {
    await goster({}, BUTUN_KURALLAR, hataCevabi('yetki_yok', 'Yetki yok', 403));

    expect(screen.getByRole('alert').textContent).toBe('Bu sayfayı görme yetkin yok');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('401 dönünce /oturum-bitti yoluna yönlendirir', async () => {
    sahteFetch.mockResolvedValueOnce(hataCevabi('kimlik_gerekli', 'Oturum gerekli', 401));

    await expect(OturumlarSayfasi({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'yonlendirildi:/oturum-bitti',
    );
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/oturum-bitti');
  });
});

// Kolonun çizilip çizilmeyeceğini ekran tür düzeyindeki okuma kuralına sorar (TS-004 "Yönetim
// ekranları").
function hucreSayilari(): number[] {
  return satirlar().map((satir) => within(satir).getAllByRole('cell').length);
}

const KAPAT: YetkiKurali = { action: 'kapat', subject: 'Oturum' };

describe('OturumlarSayfasi kolonların yetkisi', () => {
  it('son etkinliği ve adresi okuma kuralı olmayan kişide kolonların başlığı, sıralama bağlantısı ve hücreleri yoktur', async () => {
    await goster({}, [
      {
        action: 'oku',
        subject: 'Oturum',
        fields: ['baslangicZamani', 'tarayiciBilgisi', 'kapatilmaZamani', 'kapatilmaNedeni'],
      },
      KAPAT,
    ]);

    expect(baslikMetinleri()).toEqual(['Başlangıç ▼', 'Tarayıcı bilgisi', 'Durum', 'İşler']);
    expect(screen.queryByRole('link', { name: 'Son etkinlik' })).toBeNull();
    expect(screen.queryByText(tarihSaat(SON_1))).toBeNull();
    expect(screen.queryByText('10.0.0.1')).toBeNull();
    expect(hucreSayilari()).toEqual([4, 4]);
  });

  it('adresi bir kuralla okuyabilen kişide kolon çizilir; alanı taşımayan kaydın hücresi boş işarettir', async () => {
    const adressiz: Partial<typeof OBUR_OTURUM> = { ...OBUR_OTURUM };
    delete adressiz.ipAdresi;
    await goster(
      {},
      [{ action: 'oku', subject: 'Oturum', fields: ['ipAdresi'] }, KAPAT],
      listeCevabi({ kayitlar: [BU_OTURUM, adressiz] }),
    );

    expect(baslikMetinleri()).toEqual(['Adres', 'İşler']);
    const [ilk, ikinci] = satirlar();
    expect(hucreler(ilk ?? document.body)[0]).toBe('10.0.0.1');
    expect(hucreler(ikinci ?? document.body)[0]).toBe('—');
    expect(hucreSayilari()).toEqual([2, 2]);
  });

  it('şartı ekrana gelmeyen bir kolona bakan kuralla okuyabilen kişide kolonlar yine çizilir', async () => {
    await goster({}, [
      {
        action: 'oku',
        subject: 'Oturum',
        conditions: { kullanici: { is: { sistemAktoru: false } } },
      },
      KAPAT,
    ]);

    expect(baslikMetinleri()).toEqual([
      'Başlangıç ▼',
      'Son etkinlik',
      'Adres',
      'Tarayıcı bilgisi',
      'Durum',
      'İşler',
    ]);
    expect(hucreSayilari()).toEqual([6, 6]);
  });
});
