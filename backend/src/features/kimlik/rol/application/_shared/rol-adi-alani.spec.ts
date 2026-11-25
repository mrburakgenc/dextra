// Rol adı alanının birim testi: değer nesnesinin reddi, dogrulama_hatasi cevabına giden sorunun
// yolunu ve iletisini kuralın şemada yazıldığı zamanki (z.string().trim().min(1).max(100)) hâliyle verir.
import { z } from 'zod';
import { rolAdiAlani } from './rol-adi-alani.js';

const govde = z.strictObject({ ad: rolAdiAlani });

describe('rol adı alanı', () => {
  it.each([
    ['', 'too_small', 'Too small: expected string to have >=1 characters'],
    ['   ', 'too_small', 'Too small: expected string to have >=1 characters'],
    [
      'x'.repeat(101),
      'too_big',
      'Too big: expected string to have <=100 characters',
    ],
    [5, 'invalid_type', 'Invalid input: expected string, received number'],
  ])('%j için sorun %s ve iletisi bugünküyle aynı', (ad, code, message) => {
    const sonuc = govde.safeParse({ ad });
    expect(sonuc.success).toBe(false);
    expect(
      sonuc.error?.issues.map((s) => ({
        path: s.path,
        code: s.code,
        message: s.message,
      })),
    ).toEqual([{ path: ['ad'], code, message }]);
  });

  it('geçerli adı kırpılmış hâliyle verir', () => {
    expect(govde.parse({ ad: '  Muhasebe  ' })).toEqual({ ad: 'Muhasebe' });
  });
});
