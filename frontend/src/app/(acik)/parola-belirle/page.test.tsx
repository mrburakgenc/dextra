import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ParolaBelirleSayfasi from './page';

vi.mock('../../../features/kimlik/eylemler', () => ({ parolaBelirle: vi.fn() }));

afterEach(cleanup);

async function sayfa(arama: Record<string, string | string[] | undefined>) {
  render(await ParolaBelirleSayfasi({ searchParams: Promise.resolve(arama) }));
}

describe('ParolaBelirleSayfasi', () => {
  it.each([
    ['kod yok', {}],
    ['kod boş', { kod: '' }],
    ['kod birden çok', { kod: ['a', 'b'] }],
  ])('%s iken form gösterilmez, açıklama gösterilir', async (_ad, arama) => {
    await sayfa(arama);

    expect(document.querySelector('form')).toBeNull();
    expect(screen.queryByLabelText('Yeni parola')).toBeNull();
    expect(screen.getByText(/parola belirleme kodu yok/)).toBeDefined();
  });

  it('kod varken parola ve tekrar alanlarıyla formu gösterir; kod formla gider', async () => {
    await sayfa({ kod: 'kod-1' });

    expect(screen.getByLabelText('Yeni parola').getAttribute('type')).toBe('password');
    expect(screen.getByLabelText('Yeni parola (tekrar)').getAttribute('type')).toBe(
      'password',
    );
    const kod = document.querySelector('input[name="kod"]');
    expect(kod?.getAttribute('value')).toBe('kod-1');
  });
});
