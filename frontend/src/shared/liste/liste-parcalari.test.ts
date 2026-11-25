import { describe, expect, it, vi } from 'vitest';
import { BOS, kimliginAdi } from './liste-parcalari';

vi.mock('server-only', () => ({}));

// Baş tarafı (zaman) aynı, sonu farklı iki kimlik: aynı dakikada oluşan iki kayıt.
const ILK = '019a6b2c-7d10-7e2f-8a3b-4c5d91b2c3d4';
const IKINCI = '019a6b2c-7d10-7e2f-8a3b-4c5de5f6a7b8';

describe('kimliginAdi', () => {
  it('adı bilinmeyen 36 karakterlik kimlik … ve son sekiz karakter olarak döner', () => {
    expect(ILK).toHaveLength(36);
    expect(kimliginAdi(null, ILK)).toBe('…91b2c3d4');
    expect(kimliginAdi(new Map(), ILK)).toBe('…91b2c3d4');
  });

  it('baş tarafı aynı, sonu farklı iki kimliğin kısaltması farklıdır', () => {
    expect(ILK.slice(0, 8)).toBe(IKINCI.slice(0, 8));
    expect(kimliginAdi(null, ILK)).not.toBe(kimliginAdi(null, IKINCI));
  });

  it('sekiz karakterden kısa kimlik olduğu gibi döner', () => {
    expect(kimliginAdi(null, 'a1b2c3d')).toBe('a1b2c3d');
  });

  it('adı bilinen kimlik adıyla, gelmeyen kimlik boş işaretle gösterilir', () => {
    expect(kimliginAdi(new Map([[ILK, 'Merkez']]), ILK)).toBe('Merkez');
    expect(kimliginAdi(null, null)).toBe(BOS);
    expect(kimliginAdi(null, undefined)).toBe(BOS);
  });
});
