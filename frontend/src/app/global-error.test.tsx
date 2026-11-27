import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import GenelHataEkrani from './global-error';

// Çatının hata ekranına verdiği bilgi; ekran onu kullanmasa da çatı bu biçimde çağırır.
type HataBilgisi = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;
const Ekran: ComponentType<HataBilgisi> = GenelHataEkrani;

describe('genel hata ekranı', () => {
  it('kendi html ve body öğelerini çizer, sabit iletiyi gösterir; ayrıntıyı yazmaz', () => {
    const hata = Object.assign(new Error('GIZLI-IC-AYRINTI'), {
      digest: 'OZET-4815162342',
    });
    const isaretleme = renderToStaticMarkup(
      <Ekran error={hata} reset={vi.fn()} />,
    );
    const belge = new DOMParser().parseFromString(isaretleme, 'text/html');

    // React, html öğesinin içine boş bir head öğesi ekler.
    expect(isaretleme).toMatch(/^<html lang="tr">(<head><\/head>)?<body>/);
    expect(isaretleme).toMatch(/<\/body><\/html>$/);
    expect(belge.body.querySelector('[role="alert"]')?.textContent).toBe(
      'Beklenmeyen bir hata oluştu',
    );
    expect(belge.body.querySelector('button')?.textContent).toBe(
      'Yeniden dene',
    );
    expect(isaretleme).not.toContain('GIZLI-IC-AYRINTI');
    expect(isaretleme).not.toContain('OZET-4815162342');
  });
});
