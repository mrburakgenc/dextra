import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import KarsilamaSayfasi from './page';

afterEach(cleanup);

describe('KarsilamaSayfasi', () => {
  it('başlığı gösterir', () => {
    render(<KarsilamaSayfasi />);

    const baslik = screen.getByRole('heading', { level: 1 });

    expect(baslik.textContent).toBe('Dextra');
  });

  it('karşılama metnini gösterir', () => {
    render(<KarsilamaSayfasi />);

    expect(screen.getByText(/Hoş geldiniz/)).toBeDefined();
  });
});
