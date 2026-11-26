import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { kaydiEtiketle, kolonCizilir, type YetkiKurali, yetkiKur } from './yetki';
import { Can, Kolon, useYetki, YetkiSaglayici } from './yetki-saglayici';

afterEach(cleanup);

const GRUP_KOSULU = { grupId: { in: ['g1', 'g2'] } };

function OlusturDugmesi() {
  return (
    <Can I="olustur" a="Kullanici">
      <button type="button">Kullanıcı aç</button>
    </Can>
  );
}

describe('<Can> tür düzeyi', () => {
  it('kural varken içerik görünür', () => {
    render(
      <YetkiSaglayici kurallar={[{ action: 'olustur', subject: 'Kullanici' }]}>
        <OlusturDugmesi />
      </YetkiSaglayici>,
    );

    expect(screen.getByRole('button', { name: 'Kullanıcı aç' })).toBeDefined();
  });

  it('kural yokken içerik görünmez', () => {
    render(
      <YetkiSaglayici kurallar={[]}>
        <OlusturDugmesi />
      </YetkiSaglayici>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('kayıt düzeyi', () => {
  const yetki = yetkiKur([
    { action: 'guncelle', subject: 'Kullanici', conditions: GRUP_KOSULU },
  ]);

  it('koşulu tutan kayıt için evet, tutmayan için hayır çıkar', () => {
    expect(
      yetki.can('guncelle', kaydiEtiketle('Kullanici', { grupId: 'g1' })),
    ).toBe(true);
    expect(
      yetki.can('guncelle', kaydiEtiketle('Kullanici', { grupId: 'g9' })),
    ).toBe(false);
  });

  it('koşulun baktığı kolon kayıtta yoksa hayır çıkar', () => {
    expect(
      yetki.can('guncelle', kaydiEtiketle('Kullanici', { id: 'k1' })),
    ).toBe(false);
  });

  it('<Can> kaydı this ile sorar', () => {
    render(
      <YetkiSaglayici
        kurallar={[
          { action: 'guncelle', subject: 'Kullanici', conditions: GRUP_KOSULU },
        ]}
      >
        <Can I="guncelle" this={kaydiEtiketle('Kullanici', { grupId: 'g1' })}>
          <p>g1 düzenlenir</p>
        </Can>
        <Can I="guncelle" this={kaydiEtiketle('Kullanici', { grupId: 'g9' })}>
          <p>g9 düzenlenir</p>
        </Can>
      </YetkiSaglayici>,
    );

    expect(screen.getByText('g1 düzenlenir')).toBeDefined();
    expect(screen.queryByText('g9 düzenlenir')).toBeNull();
  });

  it('iki kural farklı koşullarla verilince koşullardan birini tutan kayıt için evet çıkar', () => {
    const ikiKural = yetkiKur([
      { action: 'guncelle', subject: 'Kullanici', conditions: { grupId: 'g1' } },
      { action: 'guncelle', subject: 'Kullanici', conditions: { grupId: 'g2' } },
    ]);

    expect(
      ikiKural.can('guncelle', kaydiEtiketle('Kullanici', { grupId: 'g1' })),
    ).toBe(true);
    expect(
      ikiKural.can('guncelle', kaydiEtiketle('Kullanici', { grupId: 'g2' })),
    ).toBe(true);
    expect(
      ikiKural.can('guncelle', kaydiEtiketle('Kullanici', { grupId: 'g9' })),
    ).toBe(false);
  });
});

describe('değerlendirilemeyen koşul', () => {
  const TANINMAYAN_ISLEC = { grupId: { benzer: 'g1' } };

  it('yorumlayıcının tanımadığı işleçle kayıt düzeyindeki soru hata fırlatmaz, hayır çıkar', () => {
    const yetki = yetkiKur([
      { action: 'guncelle', subject: 'Kullanici', conditions: TANINMAYAN_ISLEC },
    ]);

    expect(
      yetki.can('guncelle', kaydiEtiketle('Kullanici', { grupId: 'g1' })),
    ).toBe(false);
  });

  it('<Can> bu koşulla hata fırlatmaz ve içerik görünmez', () => {
    render(
      <YetkiSaglayici
        kurallar={[
          {
            action: 'guncelle',
            subject: 'Kullanici',
            conditions: TANINMAYAN_ISLEC,
          },
        ]}
      >
        <p>sayfa</p>
        <Can I="guncelle" this={kaydiEtiketle('Kullanici', { grupId: 'g1' })}>
          <p>g1 düzenlenir</p>
        </Can>
      </YetkiSaglayici>,
    );

    expect(screen.getByText('sayfa')).toBeDefined();
    expect(screen.queryByText('g1 düzenlenir')).toBeNull();
  });

  it('kayıtta değerlendirilirken hata veren koşul hayır çıkar', () => {
    // startsWith kolon değeri metin değilken yorumlayıcıda hata verir.
    const yetki = yetkiKur([
      {
        action: 'guncelle',
        subject: 'Kullanici',
        conditions: { kullaniciAdi: { startsWith: 'a' } },
      },
    ]);

    expect(
      yetki.can('guncelle', kaydiEtiketle('Kullanici', { kullaniciAdi: 5 })),
    ).toBe(false);
    expect(
      yetki.can('guncelle', kaydiEtiketle('Kullanici', { kullaniciAdi: 'ada' })),
    ).toBe(true);
  });

  it('değerlendirilemeyen koşullu kural öbür kuralın evetini engellemez', () => {
    const yetki = yetkiKur([
      { action: 'guncelle', subject: 'Kullanici', conditions: { grupId: 'g1' } },
      { action: 'guncelle', subject: 'Kullanici', conditions: TANINMAYAN_ISLEC },
    ]);

    expect(
      yetki.can('guncelle', kaydiEtiketle('Kullanici', { grupId: 'g1' })),
    ).toBe(true);
  });
});

describe('kolon düzeyi', () => {
  it('kuraldaki kolon için evet, öbür kolon için hayır çıkar', () => {
    const yetki = yetkiKur([
      {
        action: 'guncelle',
        subject: 'Kullanici',
        conditions: GRUP_KOSULU,
        fields: ['gorunenAd'],
      },
    ]);
    const kayit = kaydiEtiketle('Kullanici', {
      grupId: 'g1',
      gorunenAd: 'Ada',
      kullaniciAdi: 'ada',
    });

    expect(yetki.can('guncelle', kayit, 'gorunenAd')).toBe(true);
    expect(yetki.can('guncelle', kayit, 'kullaniciAdi')).toBe(false);
  });
});

describe('kaydiEtiketle', () => {
  it('asıl kaydı değiştirmez', () => {
    const kayit = { grupId: 'g1' };

    kaydiEtiketle('Kullanici', kayit);

    expect(Object.getOwnPropertyNames(kayit)).toEqual(['grupId']);
  });
});

describe('useYetki', () => {
  function Soru({ kurallar }: Readonly<{ kurallar: readonly YetkiKurali[] }>) {
    return (
      <YetkiSaglayici kurallar={kurallar}>
        <Cevap />
      </YetkiSaglayici>
    );
  }
  function Cevap() {
    return <p>{useYetki().can('sil', 'Kullanici') ? 'evet' : 'hayır'}</p>;
  }

  it('sağlayıcının kurduğu yetkiyi verir', () => {
    render(<Soru kurallar={[{ action: 'sil', subject: 'Kullanici' }]} />);

    expect(screen.getByText('evet')).toBeDefined();
  });
});

describe('kolonCizilir', () => {
  it('kuralı olmayan kolon için hayır, kolonları sayan kuralın verdiği kolon için evet çıkar', () => {
    const yetki = yetkiKur([{ action: 'oku', subject: 'Grup', fields: ['ad'] }]);

    expect(kolonCizilir(yetki, 'Grup', ['ad'])).toBe(true);
    expect(kolonCizilir(yetki, 'Grup', ['olusturmaZamani'])).toBe(false);
    expect(kolonCizilir(yetki, 'Rol', ['ad'])).toBe(false);
  });

  it('kolon saymayan kural bütün kolonları verir; başka eylemin kuralı okuma vermez', () => {
    expect(kolonCizilir(yetkiKur([{ action: 'oku', subject: 'Grup' }]), 'Grup', ['ad'])).toBe(
      true,
    );
    expect(kolonCizilir(yetkiKur([{ action: 'sil', subject: 'Grup' }]), 'Grup', ['ad'])).toBe(
      false,
    );
  });

  it('birden çok alandan türeyen kolon, alanlarından biri okunabiliyorsa çizilir', () => {
    const yetki = yetkiKur([{ action: 'oku', subject: 'Yetenek', fields: ['tohumAnahtari'] }]);

    expect(kolonCizilir(yetki, 'Yetenek', ['sistemSatiri', 'tohumAnahtari'])).toBe(true);
    expect(kolonCizilir(yetki, 'Yetenek', ['butunKolonlar', 'kolonlar'])).toBe(false);
  });

  it('şartlı kural tür düzeyinde şartı değerlendirmez; değerlendirilemeyen şart da evet verir', () => {
    expect(
      kolonCizilir(
        yetkiKur([{ action: 'oku', subject: 'Grup', conditions: { silinmeZamani: null } }]),
        'Grup',
        ['ad'],
      ),
    ).toBe(true);
    expect(
      kolonCizilir(
        yetkiKur([{ action: 'oku', subject: 'Grup', conditions: { ad: { tanimsiz: 1 } } }]),
        'Grup',
        ['ad'],
      ),
    ).toBe(true);
  });
});

describe('<Kolon>', () => {
  function Tablo({ kurallar }: Readonly<{ kurallar: readonly YetkiKurali[] }>) {
    return (
      <YetkiSaglayici kurallar={kurallar}>
        <table>
          <thead>
            <tr>
              <Kolon a="Grup" alanlar={['ad']}>
                <th scope="col">Ad</th>
              </Kolon>
              <Kolon a="Grup" alanlar={['olusturmaZamani']}>
                <th scope="col">Oluşturma zamanı</th>
              </Kolon>
            </tr>
          </thead>
        </table>
      </YetkiSaglayici>
    );
  }

  it('kolon okunabiliyorsa içeriği çizer, okunamıyorsa hiçbir şey çizmez', () => {
    render(<Tablo kurallar={[{ action: 'oku', subject: 'Grup', fields: ['ad'] }]} />);

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Ad']);
  });
});

// Yasaklar (ters kurallar; TS-008 "Ekran", kapanan AU-6 ve AU-28). Yasak tutuyorsa kayıt düzeyindeki
// soru hayır, tutmuyorsa öndeki izin kuralının cevabı (evet) çıkar.
const IZIN: YetkiKurali = { action: 'guncelle', subject: 'Kullanici' };

function yasakla(conditions: Record<string, unknown>) {
  return yetkiKur([IZIN, { ...IZIN, conditions, inverted: true }]);
}

function yalnizIzin(conditions: Record<string, unknown>) {
  return yetkiKur([{ ...IZIN, conditions }]);
}

function sor(
  yetki: ReturnType<typeof yetkiKur>,
  kayit: Record<string, unknown>,
) {
  return yetki.can('guncelle', kaydiEtiketle('Kullanici', kayit));
}

function telefonSarti(islec: string, deger: unknown) {
  return { AND: [{ telefon: { [islec]: deger } }] };
}

// Boş kolonda sekiz işleç; "izin" kurulu yorumlayıcının bugünkü sonucudur (güvenli eşleyiciden geçer).
const SEKIZ_ISLEC = [
  { islec: 'equals', deger: '5551001', izin: false },
  { islec: 'not', deger: '5551001', izin: true },
  { islec: 'in', deger: ['5551001'], izin: false },
  { islec: 'notIn', deger: ['5551001'], izin: true },
  { islec: 'lt', deger: 5, izin: true },
  { islec: 'lte', deger: 5, izin: true },
  { islec: 'gt', deger: 5, izin: false },
  { islec: 'gte', deger: 5, izin: false },
];

describe('yasakların eşleyicisi', () => {
  const GRUP_G1 = { AND: [{ grupId: { equals: 'g1' } }] };
  const TANINMAYAN = { AND: [{ grupId: { benzer: 'g1' } }] };

  it('ters kural yasaktır: koşulu tutan kayıtta hayır, tutmayan kayıtta evet çıkar', () => {
    const yetki = yasakla(GRUP_G1);

    expect(sor(yetki, { grupId: 'g1' })).toBe(false);
    expect(sor(yetki, { grupId: 'g9' })).toBe(true);
  });

  it('şartın baktığı kolon kayıtta yoksa yasak tutuyor sayılır', () => {
    expect(sor(yasakla(GRUP_G1), { id: 'k1' })).toBe(false);
  });

  it('tanınmayan işleçli yasak tutuyor sayılır', () => {
    expect(sor(yasakla(TANINMAYAN), { grupId: 'g9' })).toBe(false);
  });

  it('kayıtta değerlendirilirken hata veren yasak tutuyor sayılır', () => {
    const yetki = yasakla({ AND: [{ kullaniciAdi: { startsWith: 'a' } }] });

    expect(sor(yetki, { kullaniciAdi: 5 })).toBe(false);
  });

  it.each(SEKIZ_ISLEC)(
    'kolonu boş olan kayıtta $islec yasağı tutmuyor',
    ({ islec, deger }) => {
      const yetki = yasakla(telefonSarti(islec, deger));

      expect(sor(yetki, { telefon: null })).toBe(true);
    },
  );

  it('iki öğeli şartta bir öğenin kolonu boşsa yasak tutmuyor, kolonu yoksa tutuyor', () => {
    const yetki = yasakla({
      AND: [{ grupId: { equals: 'g1' } }, { telefon: { not: 'x' } }],
    });

    expect(sor(yetki, { grupId: 'g1', telefon: 'y' })).toBe(false);
    expect(sor(yetki, { grupId: 'g1', telefon: null })).toBe(true);
    expect(sor(yetki, { grupId: 'g1' })).toBe(false);
  });

  it('yasaktan sonra verilen izin kazanır: kurallar verildiği sırayla kurulur', () => {
    const yetki = yetkiKur([
      { ...IZIN, conditions: GRUP_G1, inverted: true },
      IZIN,
    ]);

    expect(sor(yetki, { grupId: 'g1' })).toBe(true);
  });

  describe('aynı durumlarda izin kuralının sonucu değişmez', () => {
    it('kolonu kayıtta olmayan ve tanınmayan işleçli izin tutmuyor', () => {
      expect(sor(yalnizIzin(GRUP_G1), { id: 'k1' })).toBe(false);
      expect(sor(yalnizIzin(TANINMAYAN), { grupId: 'g1' })).toBe(false);
    });

    it.each(SEKIZ_ISLEC)(
      'kolonu boş olan kayıtta $islec izni bugünkü gibi $izin verir',
      ({ islec, deger, izin }) => {
        const yetki = yalnizIzin(telefonSarti(islec, deger));

        expect(sor(yetki, { telefon: null })).toBe(izin);
      },
    );
  });
});

describe('yasaklarda tür düzeyi', () => {
  const OKU: YetkiKurali = { action: 'oku', subject: 'Kullanici' };
  const SART = { AND: [{ gorunenAd: { equals: 'Ada' } }] };

  it('şartlı yasak varken menü sorusu ve kolon başlığı evet verir', () => {
    const kayitYasagi = yetkiKur([
      OKU,
      { ...OKU, conditions: SART, inverted: true },
    ]);
    const kolonYasagi = yetkiKur([
      OKU,
      { ...OKU, conditions: SART, fields: ['telefon'], inverted: true },
    ]);

    expect(kayitYasagi.can('oku', 'Kullanici')).toBe(true);
    expect(kolonCizilir(kayitYasagi, 'Kullanici', ['telefon'])).toBe(true);
    expect(kolonYasagi.can('oku', 'Kullanici')).toBe(true);
    expect(kolonCizilir(kolonYasagi, 'Kullanici', ['telefon'])).toBe(true);
  });

  it('şartsız yasak tür düzeyinde de hayır verir: kayıt yasağı menüyü, kolon yasağı o kolonu kapatır', () => {
    const kayitYasagi = yetkiKur([OKU, { ...OKU, inverted: true }]);
    const kolonYasagi = yetkiKur([
      OKU,
      { ...OKU, fields: ['telefon'], inverted: true },
    ]);

    expect(kayitYasagi.can('oku', 'Kullanici')).toBe(false);
    expect(kolonCizilir(kayitYasagi, 'Kullanici', ['gorunenAd'])).toBe(false);
    expect(kolonYasagi.can('oku', 'Kullanici')).toBe(true);
    expect(kolonCizilir(kolonYasagi, 'Kullanici', ['telefon'])).toBe(false);
    expect(kolonCizilir(kolonYasagi, 'Kullanici', ['gorunenAd'])).toBe(true);
  });
});
