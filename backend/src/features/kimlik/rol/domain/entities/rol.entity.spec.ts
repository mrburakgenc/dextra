// Rol varlığının birim testi: oluşturma işlevi ve iki durum kararı.
import { type RolAdi, rolAdi } from '../value-objects/rol-adi.js';
import {
  rolAdDegistirmeKarari,
  rolOlustur,
  rolSilmeKarari,
} from './rol.entity.js';

function ad(ham: string): RolAdi {
  const sonuc = rolAdi(ham);
  if (sonuc.tur === 'ret') {
    throw new Error(sonuc.neden);
  }
  return sonuc.deger;
}

describe('rol varlığı', () => {
  it('oluşturma yazılacak hâli yalnız kuraldan geçmiş adla, kodsuz üretir', () => {
    expect(rolOlustur(ad('  Muhasebe '))).toEqual({ ad: 'Muhasebe' });
  });

  it.each([
    [{ sistemRoluMu: false, bosMu: true }, { tur: 'tamam' }],
    [
      { sistemRoluMu: true, bosMu: true },
      { tur: 'ret', neden: 'sistem_rolu' },
    ],
    [
      { sistemRoluMu: true, bosMu: false },
      { tur: 'ret', neden: 'sistem_rolu' },
    ],
    [
      { sistemRoluMu: false, bosMu: false },
      { tur: 'ret', neden: 'dolu' },
    ],
  ])('silme kararı %j için %j', (olgular, beklenen) => {
    expect(rolSilmeKarari(olgular)).toEqual(beklenen);
  });

  it.each([
    [{ canliMi: true }, { tur: 'tamam' }],
    [{ canliMi: false }, { tur: 'ret', neden: 'silinmis' }],
  ])('ad değiştirme kararı %j için %j', (olgular, beklenen) => {
    expect(rolAdDegistirmeKarari(olgular)).toEqual(beklenen);
  });
});
