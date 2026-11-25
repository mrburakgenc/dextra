// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { imzaBasliklari } from './imza';

vi.mock('server-only', () => ({}));

// Girdiler backend'in testindeki sabitlerdir (backend/src/shared/guvenlik/istemci-adresi-imzasi.spec.ts:
// adres '203.0.113.7', tarayıcı 'Mozilla/5.0 (deneme)'); backend testi sırrı ve zamanı her
// koşuda üretir, bu yüzden burada sabitlendi. Beklenen imza bu girdilerle backend'in
// istemciImzasiUret işlevinden alındı ve openssl ile ayrıca doğrulandı; testte sabittir.
const SIR = 'deneme-sirri-xxxxxxxxxxxxxxxxxxxxxxxxxxx';
const BILGI = {
  adres: '203.0.113.7',
  tarayici: 'Mozilla/5.0 (deneme)',
  zaman: 1768512600000,
};
const BEKLENEN_IMZA =
  '3fbc81cc8d7774a75d959d208f1aa37e7582b5a81320558bfb1ed6c9368b9862';

describe('istemci adresi imzası', () => {
  it('backend ile aynı imzayı ve dört başlığı üretir', () => {
    expect(imzaBasliklari(SIR, BILGI)).toEqual({
      'x-istemci-adresi': '203.0.113.7',
      'x-istemci-tarayici': 'Mozilla/5.0 (deneme)',
      'x-istemci-zaman': '1768512600000',
      'x-istemci-imza': BEKLENEN_IMZA,
    });
  });

  it('başka sır başka imza verir', () => {
    expect(
      imzaBasliklari(`${SIR}y`, BILGI)['x-istemci-imza'],
    ).not.toBe(BEKLENEN_IMZA);
  });
});
