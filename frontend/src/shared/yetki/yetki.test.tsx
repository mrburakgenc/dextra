import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { kaydiEtiketle, type YetkiKurali, yetkiKur } from './yetki';
import { Can, useYetki, YetkiSaglayici } from './yetki-saglayici';

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
