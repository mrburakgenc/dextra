import { yeniKimlik } from './kimlik.js';

describe('kimlik üretici', () => {
  it('sürümü 7 olan UUID üretir', () => {
    const kimlik = yeniKimlik();

    expect(kimlik).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('1000 kimliğin hepsi birbirinden farklıdır', () => {
    const kimlikler = Array.from({ length: 1000 }, () => yeniKimlik());

    expect(new Set(kimlikler).size).toBe(1000);
  });
});
