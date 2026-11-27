import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PanelHataSiniri from './error';

vi.mock('next/navigation', () => ({
  usePathname: () => '/kullanicilar',
  useSearchParams: () => new URLSearchParams('sayfa=2'),
}));

afterEach(cleanup);

// Çatının hata sınırına verdiği bilgi; sınır onu kullanmasa da çatı bu biçimde çağırır.
type HataBilgisi = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;
const Sinir: ComponentType<HataBilgisi> = PanelHataSiniri;

describe('panel hata sınırı', () => {
  it('içerik alanında sabit iletiyi ve yeniden deneme yolunu gösterir; ayrıntıyı yazmaz', () => {
    const hata = Object.assign(new Error('GIZLI-IC-AYRINTI'), {
      digest: 'OZET-4815162342',
    });
    render(<Sinir error={hata} reset={vi.fn()} />);

    expect(screen.getByRole('main').id).toBe('ana-icerik');
    expect(screen.getByRole('alert').textContent).toBe(
      'Beklenmeyen bir hata oluştu',
    );
    const yenidenDene = screen.getByRole('link', { name: 'Yeniden dene' });
    expect(yenidenDene.getAttribute('href')).toBe('/kullanicilar?sayfa=2');
    yenidenDene.focus();
    expect(document.activeElement).toBe(yenidenDene);
    const belge = document.documentElement.outerHTML;
    expect(belge).not.toContain('GIZLI-IC-AYRINTI');
    expect(belge).not.toContain('OZET-4815162342');
  });
});
