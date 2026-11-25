import { createHook } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import { Dongu } from './dongu.js';

// Döngünün kurduğu ve henüz ateşlenmemiş ya da kaldırılmamış zamanlayıcılar. Sürecin bütün
// zamanlayıcıları sayılmaz: zamanlayıcı kurulurken çağrı yığını Dongu.planla'dan geçiyorsa izlenir;
// ateşlenince ya da kaldırılınca Node'un destroy olayıyla kümeden çıkar.
const donguZamanlayicilari = new Set<number>();
createHook({
  init(kimlik, tur) {
    if (tur === 'Timeout' && new Error().stack?.includes('Dongu.planla')) {
      donguZamanlayicilari.add(kimlik);
    }
  },
  destroy(kimlik) {
    donguZamanlayicilari.delete(kimlik);
  },
}).enable();

// Kaldırılan zamanlayıcının destroy olayı eşzamanlı gelmez; bir setImmediate turu beklenir.
async function acikDonguZamanlayicisi(): Promise<number> {
  await new Promise((coz) => setImmediate(coz));
  return donguZamanlayicilari.size;
}

function uyku(ms: number): Promise<void> {
  return new Promise((coz) => setTimeout(coz, ms));
}

// Koşul sağlanana kadar kısa aralıkla yoklar; süre dolarsa son durumu döner.
async function bekle(kosul: () => boolean, enCokMs: number): Promise<boolean> {
  const son = performance.now() + enCokMs;
  while (performance.now() < son) {
    if (kosul()) return true;
    await uyku(5);
  }
  return kosul();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a) çift zincir', () => {
  it('durdurmanın sözü beklenmeden yeniden başlatılan döngüde aynı anda en çok bir adım koşar, en çok bir zamanlayıcı bekler; durdurulunca açık zamanlayıcı kalmaz', async ({
    annotate,
  }) => {
    // Adım 30 ms sürer ve hep true döner: döngü beklemeden yeniden çağırır. Eşzamanlı çağrı sayısı
    // adımın içinde ölçülür.
    let cagri = 0;
    let eszamanli = 0;
    let enCokEszamanli = 0;
    let enCokZamanlayici = 0;
    const dongu = new Dongu({
      adim: async () => {
        cagri += 1;
        eszamanli += 1;
        enCokEszamanli = Math.max(enCokEszamanli, eszamanli);
        try {
          await uyku(30);
        } finally {
          eszamanli -= 1;
        }
        return true;
      },
      bosBeklemeMs: 60_000,
      hataBeklemeTabanMs: 40,
      hataBeklemeUstMs: 100,
    });

    dongu.baslat();
    expect(await bekle(() => cagri === 1, 1000)).toBe(true);
    // Adım sürerken: durdurmanın sözü beklenmez, hemen yeniden başlatılır; sıra üç kez yinelenir,
    // araya bir de durdurmasız ikinci başlatma girer.
    for (let tur = 0; tur < 3; tur += 1) {
      void dongu.durdur();
      dongu.baslat();
      dongu.baslat();
    }
    // Döngü bir süre koşar; bekleyen döngü zamanlayıcıları sık aralıkla sayılır.
    const son = performance.now() + 300;
    while (performance.now() < son) {
      enCokZamanlayici = Math.max(enCokZamanlayici, donguZamanlayicilari.size);
      await uyku(1);
    }
    await dongu.durdur();
    const durunca = cagri;
    await uyku(100);

    await annotate(
      `adım çağrısı: ${String(durunca)}; en çok eşzamanlı adım: ${String(enCokEszamanli)}; en çok bekleyen zamanlayıcı: ${String(enCokZamanlayici)}`,
    );
    expect(durunca).toBeGreaterThan(3);
    expect(enCokEszamanli).toBe(1);
    expect(enCokZamanlayici).toBeLessThanOrEqual(1);
    expect(cagri).toBe(durunca);
    expect(await acikDonguZamanlayicisi()).toBe(0);
  });

  it('karşı test: adım başlamadan (zamanlayıcı beklerken) durdurulup yeniden başlatılan döngü tek zincirle koşar', async () => {
    let cagri = 0;
    let eszamanli = 0;
    let enCokEszamanli = 0;
    const dongu = new Dongu({
      adim: async () => {
        cagri += 1;
        eszamanli += 1;
        enCokEszamanli = Math.max(enCokEszamanli, eszamanli);
        try {
          await uyku(10);
        } finally {
          eszamanli -= 1;
        }
        return false;
      },
      bosBeklemeMs: 20,
      hataBeklemeTabanMs: 40,
      hataBeklemeUstMs: 100,
    });

    dongu.baslat();
    void dongu.durdur();
    dongu.baslat();
    expect(await bekle(() => cagri >= 4, 1000)).toBe(true);
    await dongu.durdur();
    expect(enCokEszamanli).toBe(1);
    expect(await acikDonguZamanlayicisi()).toBe(0);
  });
});

describe('b) hatanın görünürlüğü', () => {
  it('hata atan adımdan sonra son hatanın sınıfı ve ardışık hata sayısı okunur; başarılı adımda sayaç 0 olur; her hata Logger ile değer taşımadan yazılır', async () => {
    // Hatanın metni gövdeden gelen bir değer taşıyor gibi kurulur; günlüğe geçmemelidir.
    const gizliDeger = 'gizli-govde-degeri-5c1e';
    class OrnekHata extends Error {
      readonly code = 'E_ORNEK';
      constructor() {
        super(`satır yazılamadı: ${gizliDeger}`);
        this.name = 'OrnekHata';
      }
    }
    const gunluk = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const sonuclar: ('hata' | 'kodsuz' | boolean)[] = [
      'hata',
      'kodsuz',
      'hata',
      false,
    ];
    let cagri = 0;
    const dongu = new Dongu({
      ad: 'ornek-aktarim',
      adim: () => {
        cagri += 1;
        const sonuc = sonuclar.shift() ?? false;
        if (sonuc === 'hata') return Promise.reject(new OrnekHata());
        // Kodsuz hata: sınıfı Error'dır, kod yazılmaz; metni ve nedeni günlüğe geçmez.
        if (sonuc === 'kodsuz')
          return Promise.reject(new Error(gizliDeger, { cause: gizliDeger }));
        return Promise.resolve(sonuc);
      },
      bosBeklemeMs: 60_000,
      hataBeklemeTabanMs: 30,
      hataBeklemeUstMs: 30,
    });

    expect(dongu.hataDurumu()).toEqual({
      sonHataSinifi: undefined,
      ardisikHata: 0,
    });
    dongu.baslat();
    try {
      expect(
        await bekle(() => dongu.hataDurumu().ardisikHata === 1, 1000),
      ).toBe(true);
      expect(dongu.hataDurumu()).toEqual({
        sonHataSinifi: 'OrnekHata',
        ardisikHata: 1,
      });
      expect(
        await bekle(() => dongu.hataDurumu().ardisikHata === 3, 1000),
      ).toBe(true);
      expect(dongu.hataDurumu()).toEqual({
        sonHataSinifi: 'OrnekHata',
        ardisikHata: 3,
      });
      // Dördüncü adım başarılıdır: sayaç sıfırlanır, son hatanın sınıfı okunur kalır.
      expect(await bekle(() => cagri === 4, 1000)).toBe(true);
      expect(
        await bekle(() => dongu.hataDurumu().ardisikHata === 0, 1000),
      ).toBe(true);
      expect(dongu.hataDurumu()).toEqual({
        sonHataSinifi: 'OrnekHata',
        ardisikHata: 0,
      });
    } finally {
      await dongu.durdur();
    }

    expect(gunluk).toHaveBeenCalledTimes(3);
    const iletiler = gunluk.mock.calls.map(([ileti]) => String(ileti));
    expect(iletiler[0]).toContain('ornek-aktarim');
    expect(iletiler[0]).toContain('OrnekHata');
    expect(iletiler[0]).toContain('E_ORNEK');
    expect(iletiler[1]).toContain('ornek-aktarim');
    expect(iletiler[1]).toContain('Error');
    expect(iletiler[1]).not.toContain('E_ORNEK');
    // Ne iletide ne öbür bağımsız değişkenlerde hatanın metni ya da değeri vardır; yalnız ileti verilir.
    for (const cagriArgumanlari of gunluk.mock.calls) {
      expect(cagriArgumanlari).toHaveLength(1);
      expect(JSON.stringify(cagriArgumanlari)).not.toContain(gizliDeger);
      expect(JSON.stringify(cagriArgumanlari)).not.toContain(
        'satır yazılamadı',
      );
    }
  });
});
