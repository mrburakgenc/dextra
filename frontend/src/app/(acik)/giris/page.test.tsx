import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GirisSayfasi from './page';

vi.mock('../../../features/kimlik/eylemler', () => ({ girisYap: vi.fn() }));

afterEach(cleanup);

const NOT = 'Parolan değişti; yeniden gir';

async function sayfa(arama: Record<string, string | string[] | undefined>) {
  render(await GirisSayfasi({ searchParams: Promise.resolve(arama) }));
}

describe('GirisSayfasi parola notu', () => {
  it('?parola=degisti ile not görünür ve formun yanında durur', async () => {
    await sayfa({ parola: 'degisti' });

    expect(screen.getByRole('status').textContent).toBe(NOT);
    expect(screen.getByLabelText('Kullanıcı adı')).toBeDefined();
  });

  it.each([
    ['sorgu yok', {}],
    ['başka değer', { parola: 'baska' }],
    ['büyük harfli değer', { parola: 'DEGISTI' }],
    ['boş değer', { parola: '' }],
    ['birden çok değer', { parola: ['degisti', 'degisti'] }],
  ])('%s iken not görünmez', async (_ad, arama) => {
    await sayfa(arama);

    expect(screen.queryByText(NOT)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sorgudaki metin ekrana yazılmaz', async () => {
    await sayfa({ parola: '<b>sahte ileti</b>', not: 'sahte ileti' });

    expect(document.body.textContent).not.toContain('sahte ileti');
  });
});
