// Açık oturum sınırının birim testi: girişte kapanacak oturumların seçimi (sınır 3).
import {
  EN_COK_ACIK_OTURUM,
  sinirdaKapanacaklar,
} from './acik-oturum-siniri.js';

describe('açık oturum sınırı', () => {
  it('sınır 3 oturumdur', () => {
    expect(EN_COK_ACIK_OTURUM).toBe(3);
  });

  it.each([
    [[], []],
    [['a'], []],
    [['a', 'b'], []],
    [['a', 'b', 'c'], ['a']],
    [
      ['a', 'b', 'c', 'd'],
      ['a', 'b'],
    ],
  ])(
    'açık oturumlar %j iken en eskilerden %j kapanır',
    (acik: string[], beklenen: string[]) => {
      expect(sinirdaKapanacaklar(acik)).toEqual(beklenen);
    },
  );
});
