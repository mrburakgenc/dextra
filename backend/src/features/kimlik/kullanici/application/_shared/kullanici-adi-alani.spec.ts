// Kullanıcı adı alanının birim testi: değer nesnesine taşınan kural, kuralın şemada yazıldığı zamanki
// (z.string().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/)) hâliyle aynı girdilerde aynı sorunu ya da
// aynı değeri üretir; dogrulama_hatasi cevabındaki alan yolu, kod ve neden metni böylece değişmez.
import { z } from 'zod';
import { kullaniciAdiAlani } from './kullanici-adi-alani.js';

const eski = z.strictObject({
  kullaniciAdi: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,64}$/),
});
const yeni = z.strictObject({ kullaniciAdi: kullaniciAdiAlani });

describe('kullanıcı adı alanı', () => {
  it.each([
    [''],
    ['ab'],
    ['x'.repeat(65)],
    ['ayşe'],
    ['ayse yilmaz'],
    [' ayse'],
    [5],
    [null],
    [undefined],
  ])('%j için sorun eski şemanınkiyle aynı', (kullaniciAdi) => {
    const eskiSonuc = eski.safeParse({ kullaniciAdi });
    const yeniSonuc = yeni.safeParse({ kullaniciAdi });
    expect(eskiSonuc.success).toBe(false);
    expect(yeniSonuc.error?.issues).toEqual(eskiSonuc.error?.issues);
  });

  it('kodu ve iletisi bugünkü cevaptakiyle aynı', () => {
    expect(
      yeni.safeParse({ kullaniciAdi: 'ab' }).error?.issues.map((s) => ({
        path: s.path,
        code: s.code,
        message: s.message,
      })),
    ).toEqual([
      {
        path: ['kullaniciAdi'],
        code: 'invalid_format',
        message: 'Invalid string: must match pattern /^[a-z0-9._-]{3,64}$/',
      },
    ]);
  });

  it.each([['ayse'], ['Ayse.Yilmaz'], ['A_B-C.9'], ['x'.repeat(64)]])(
    '%j için değer eski şemanınkiyle aynı',
    (kullaniciAdi) => {
      expect(yeni.parse({ kullaniciAdi })).toEqual(
        eski.parse({ kullaniciAdi }),
      );
    },
  );
});
