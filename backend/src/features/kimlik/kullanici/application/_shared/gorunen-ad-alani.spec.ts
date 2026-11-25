// Görünen ad alanının birim testi: değer nesnesine taşınan kural, kuralın şemada yazıldığı zamanki
// (z.string().trim().min(1).max(200)) hâliyle aynı girdilerde aynı sorunu ya da aynı değeri üretir;
// dogrulama_hatasi cevabındaki alan yolu, kod ve neden metni böylece değişmez.
import { z } from 'zod';
import { gorunenAdAlani } from './gorunen-ad-alani.js';

const eski = z.strictObject({ gorunenAd: z.string().trim().min(1).max(200) });
const yeni = z.strictObject({ gorunenAd: gorunenAdAlani });

describe('görünen ad alanı', () => {
  it.each([
    [''],
    ['   '],
    ['x'.repeat(201)],
    [` ${'x'.repeat(201)} `],
    [5],
    [null],
    [undefined],
  ])('%j için sorun eski şemanınkiyle aynı', (gorunenAd) => {
    const eskiSonuc = eski.safeParse({ gorunenAd });
    const yeniSonuc = yeni.safeParse({ gorunenAd });
    expect(eskiSonuc.success).toBe(false);
    expect(yeniSonuc.error?.issues).toEqual(eskiSonuc.error?.issues);
  });

  it('kodu ve iletisi bugünkü cevaptakiyle aynı', () => {
    expect(
      yeni.safeParse({ gorunenAd: '' }).error?.issues.map((s) => ({
        path: s.path,
        code: s.code,
        message: s.message,
      })),
    ).toEqual([
      {
        path: ['gorunenAd'],
        code: 'too_small',
        message: 'Too small: expected string to have >=1 characters',
      },
    ]);
  });

  it.each([['Ayşe'], ['  Ayşe Yılmaz  '], ['a'], ['x'.repeat(200)]])(
    '%j için değer eski şemanınkiyle aynı',
    (gorunenAd) => {
      expect(yeni.parse({ gorunenAd })).toEqual(eski.parse({ gorunenAd }));
    },
  );

  it('şemada olmayan alanın sorunu eski şemanınkiyle aynı', () => {
    const govde = { gorunenAd: '', telefon: '1' };
    expect(yeni.safeParse(govde).error?.issues).toEqual(
      eski.safeParse(govde).error?.issues,
    );
  });
});
