import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { alanGeldi, KayitSatirlari } from './kayit-satirlari';

afterEach(cleanup);

// Kayıtta gelmeyen alan undefined'dır; gelmiş boş alan null (TS-004 "Yönetim ekranları").
describe('alanGeldi', () => {
  const kayit: { ad?: string; kod?: string | null; sart?: unknown } = { kod: null };

  it('kayıtta olmayan alan için hayır, gelmiş boş alan için evet çıkar', () => {
    expect(alanGeldi(kayit, ['ad'])).toBe(false);
    expect(alanGeldi(kayit, ['kod'])).toBe(true);
  });

  it('birden çok alandan türeyen satır, alanlarından biri gelmişse vardır', () => {
    expect(alanGeldi(kayit, ['ad', 'kod'])).toBe(true);
    expect(alanGeldi(kayit, ['ad', 'sart'])).toBe(false);
  });
});

describe('KayitSatirlari', () => {
  it('gelmeyen alanın satırı çizilmez; gelmiş boş alanın satırı verilen değerle kalır', () => {
    const kayit: { ad?: string; kod?: string | null } = { kod: null };

    render(
      <KayitSatirlari
        kayit={kayit}
        satirlar={[
          { etiket: 'Ad', alanlar: ['ad'], deger: kayit.ad ?? '—' },
          { etiket: 'Kod', alanlar: ['kod'], deger: kayit.kod ?? '—' },
        ]}
      />,
    );

    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Kod']);
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual(['—']);
    expect(screen.queryByText('Ad')).toBeNull();
  });
});
