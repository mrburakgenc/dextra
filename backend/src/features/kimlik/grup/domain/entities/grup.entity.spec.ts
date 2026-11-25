// Grup varlığının birim testi: oluşturma işlevi ve iki durum kararı.
import { type GrupAdi, grupAdi } from '../value-objects/grup-adi.js';
import {
  grupOlustur,
  grupSilmeKarari,
  grupTasimaKarari,
} from './grup.entity.js';

const UST = '00000000-0000-4000-8000-000000000001';

function ad(ham: string): GrupAdi {
  const sonuc = grupAdi(ham);
  if (sonuc.tur === 'ret') {
    throw new Error(sonuc.neden);
  }
  return sonuc.deger;
}

const tasinabilir = {
  canliMi: true,
  kokMu: false,
  hedefCanliMi: true,
  donguYaparMi: false,
};

describe('grup varlığı', () => {
  it.each([
    [
      { ustGrupCanliMi: true },
      { tur: 'tamam', deger: { ad: 'Muhasebe', ustGrupId: UST } },
    ],
    [{ ustGrupCanliMi: false }, { tur: 'ret', neden: 'ust_grup_yok' }],
  ])('oluşturma %j için %j', (olgular, beklenen) => {
    expect(grupOlustur(ad('  Muhasebe '), UST, olgular)).toEqual(beklenen);
  });

  it.each([
    [tasinabilir, { tur: 'tamam' }],
    [
      { ...tasinabilir, canliMi: false },
      { tur: 'ret', neden: 'silinmis' },
    ],
    [
      { canliMi: false, kokMu: true, hedefCanliMi: false, donguYaparMi: true },
      { tur: 'ret', neden: 'silinmis' },
    ],
    [
      { ...tasinabilir, kokMu: true },
      { tur: 'ret', neden: 'kok' },
    ],
    [
      { ...tasinabilir, kokMu: true, hedefCanliMi: false, donguYaparMi: true },
      { tur: 'ret', neden: 'kok' },
    ],
    [
      { ...tasinabilir, hedefCanliMi: false },
      { tur: 'ret', neden: 'ust_grup_yok' },
    ],
    [
      { ...tasinabilir, hedefCanliMi: false, donguYaparMi: true },
      { tur: 'ret', neden: 'ust_grup_yok' },
    ],
    [
      { ...tasinabilir, donguYaparMi: true },
      { tur: 'ret', neden: 'dongu' },
    ],
  ])('taşıma kararı %j için %j', (olgular, beklenen) => {
    expect(grupTasimaKarari(olgular)).toEqual(beklenen);
  });

  it.each([
    [{ kokMu: false, bosMu: true }, { tur: 'tamam' }],
    [
      { kokMu: true, bosMu: true },
      { tur: 'ret', neden: 'kok' },
    ],
    [
      { kokMu: true, bosMu: false },
      { tur: 'ret', neden: 'kok' },
    ],
    [
      { kokMu: false, bosMu: false },
      { tur: 'ret', neden: 'dolu' },
    ],
  ])('silme kararı %j için %j', (olgular, beklenen) => {
    expect(grupSilmeKarari(olgular)).toEqual(beklenen);
  });
});
