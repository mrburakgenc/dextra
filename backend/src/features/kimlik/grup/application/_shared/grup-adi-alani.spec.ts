// Grup adı alanının birim testi: değer nesnesine taşınan kural, aynı girdide kuralın şemada yazıldığı
// zamanki (z.string().trim().min(1).max(100)) hâliyle aynı sonucu ve aynı sorunu (yol, kod, ileti) verir.
import { z } from 'zod';
import { grupAdiAlani } from './grup-adi-alani.js';

const eskiGovde = z.strictObject({ ad: z.string().trim().min(1).max(100) });
const yeniGovde = z.strictObject({ ad: grupAdiAlani });

function ozet<T>(sonuc: z.ZodSafeParseResult<T>) {
  return sonuc.success
    ? { deger: sonuc.data }
    : {
        sorunlar: sonuc.error.issues.map((s) => ({
          path: s.path,
          code: s.code,
          message: s.message,
        })),
      };
}

describe('grup adı alanı', () => {
  it.each([
    '',
    '   ',
    'x'.repeat(101),
    ` ${'x'.repeat(101)} `,
    5,
    null,
    'Muhasebe',
    '  Muhasebe  ',
    'a',
    ` ${'x'.repeat(100)} `,
  ])('%j için sonuç eski şemanınkiyle aynı', (ad) => {
    expect(ozet(yeniGovde.safeParse({ ad }))).toEqual(
      ozet(eskiGovde.safeParse({ ad })),
    );
  });

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
    expect(ozet(yeniGovde.safeParse({ ad }))).toEqual({
      sorunlar: [{ path: ['ad'], code, message }],
    });
  });

  it('geçerli adı kırpılmış hâliyle verir', () => {
    expect(yeniGovde.parse({ ad: '  Muhasebe  ' })).toEqual({ ad: 'Muhasebe' });
  });
});
