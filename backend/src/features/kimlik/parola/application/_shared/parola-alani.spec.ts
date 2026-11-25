// Parola alanının birim testi: aynı girdilerde, kuralın şemada yazıldığı zamanki hâli (ESKI_SEMA,
// GV-111 öncesi domain/parola-kurali.ts) ile aynı sorunları (yol, kod, ileti) üretir; böylece
// dogrulama_hatasi cevabındaki alan, kod ve neden metni değişmez.
import { z } from 'zod';
import { parolaAlani } from './parola-alani.js';

const ESKI_SEMA = z
  .string()
  .refine((p) => Array.from(p).length >= 15, 'Parola en az 15 karakter olmalı')
  .refine(
    (p) => Array.from(p).length <= 128,
    'Parola en çok 128 karakter olabilir',
  );

const IKI_BIRIMLI = '😀';

const eski = z.strictObject({ parola: ESKI_SEMA });
const yeni = z.strictObject({ parola: parolaAlani });

function sorunlar(sema: z.ZodType, govde: unknown) {
  const sonuc = sema.safeParse(govde);
  return sonuc.success ? null : sonuc.error.issues;
}

describe('parola alanı', () => {
  it.each([
    ['', 'custom', 'Parola en az 15 karakter olmalı'],
    ['a'.repeat(14), 'custom', 'Parola en az 15 karakter olmalı'],
    [IKI_BIRIMLI.repeat(14), 'custom', 'Parola en az 15 karakter olmalı'],
    ['a'.repeat(129), 'custom', 'Parola en çok 128 karakter olabilir'],
    [IKI_BIRIMLI.repeat(129), 'custom', 'Parola en çok 128 karakter olabilir'],
    [5, 'invalid_type', 'Invalid input: expected string, received number'],
    [
      undefined,
      'invalid_type',
      'Invalid input: expected string, received undefined',
    ],
  ])('%j için sorun eski şemanınkiyle aynı (%s)', (deger, code, message) => {
    const govde = { parola: deger };
    expect(sorunlar(yeni, govde)).toEqual(sorunlar(eski, govde));
    expect(
      sorunlar(yeni, govde)?.map((s) => ({
        path: s.path,
        code: s.code,
        message: s.message,
      })),
    ).toEqual([{ path: ['parola'], code, message }]);
  });

  it('fazla alanlı geçersiz gövdede sorunların sırası ve içeriği eski şemanınkiyle aynı', () => {
    const govde = { parola: 'kisa', fazla: 1 };
    expect(sorunlar(yeni, govde)).toEqual(sorunlar(eski, govde));
  });

  it.each([
    'a'.repeat(15),
    'a'.repeat(128),
    IKI_BIRIMLI.repeat(128),
    '  bir iki uc dort bes  ',
  ])('geçerli parolayı değiştirmeden verir', (deger) => {
    expect(yeni.parse({ parola: deger })).toEqual(
      eski.parse({ parola: deger }),
    );
    expect(yeni.parse({ parola: deger })).toEqual({ parola: deger });
  });
});
