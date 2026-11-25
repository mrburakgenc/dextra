import { describe, expect, it } from 'vitest';
import { para, tarih, tarihSaat } from './bicim';

// 2026-01-15T21:30:00Z İstanbul saatiyle (UTC+3) 16 Ocak 00:30'dur.
const AN = '2026-01-15T21:30:00Z';

describe('biçim', () => {
  it('tarihi İstanbul saatine göre Türkçe yazar', () => {
    expect(tarih(AN)).toBe('16 Ocak 2026');
    expect(tarih(new Date(AN))).toBe('16 Ocak 2026');
  });

  it('tarih ve saati İstanbul saatine göre Türkçe yazar', () => {
    expect(tarihSaat(AN)).toBe('16 Ocak 2026 00:30');
  });

  it('kuruşu Türk lirası olarak yazar: bin ayırıcısı nokta, ondalık ayırıcısı virgül', () => {
    expect(para(123456)).toBe('₺1.234,56');
  });
});
