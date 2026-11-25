// Kullanıcı varlığının birim testi: oluşturma işlevi ve dört durum kararı; birden çok ret olgusu
// birlikte doğruyken bugünkü denetim sırasındaki ilk ret döner.
import { type GorunenAd, gorunenAd } from '../value-objects/gorunen-ad.js';
import {
  type KullaniciAdi,
  kullaniciAdi,
} from '../value-objects/kullanici-adi.js';
import {
  kullaniciGuncellemeKarari,
  kullaniciOlustur,
  kullaniciPasifeAlmaKarari,
  kullaniciYenidenAcmaKarari,
  parolaBaglantisiUretmeKarari,
} from './kullanici.entity.js';

function kAdi(ham: string): KullaniciAdi {
  const sonuc = kullaniciAdi(ham);
  if (sonuc.tur === 'ret') {
    throw new Error(sonuc.neden);
  }
  return sonuc.deger;
}

function gAd(ham: string): GorunenAd {
  const sonuc = gorunenAd(ham);
  if (sonuc.tur === 'ret') {
    throw new Error(sonuc.neden);
  }
  return sonuc.deger;
}

const ENGELSIZ = {
  hedefKokSuperAdminMi: false,
  isteyenKokSuperAdminMi: false,
  sistemAktoruMu: false,
  pasifMi: false,
  unutulmusMu: false,
};

describe('kullanıcı varlığı', () => {
  it('oluşturma yazılacak hâli yalnız kuraldan geçmiş alanlarla üretir', () => {
    expect(kullaniciOlustur(kAdi('Ayse'), gAd('  Ayşe Yılmaz '))).toEqual({
      kullaniciAdi: 'ayse',
      gorunenAd: 'Ayşe Yılmaz',
    });
  });

  it.each([
    [{ sistemAktoruMu: false, unutulmusMu: false }, { tur: 'tamam' }],
    [
      { sistemAktoruMu: true, unutulmusMu: false },
      { tur: 'ret', neden: 'sistem_aktoru' },
    ],
    [
      { sistemAktoruMu: true, unutulmusMu: true },
      { tur: 'ret', neden: 'sistem_aktoru' },
    ],
    [
      { sistemAktoruMu: false, unutulmusMu: true },
      { tur: 'ret', neden: 'unutulmus' },
    ],
  ])('güncelleme kararı %j için %j', (olgular, beklenen) => {
    expect(kullaniciGuncellemeKarari(olgular)).toEqual(beklenen);
  });

  const pasifeAlma = { ...ENGELSIZ, sonGirebilenKokSuperAdminMi: false };
  it.each([
    [{}, { tur: 'tamam' }],
    [
      { hedefKokSuperAdminMi: true, isteyenKokSuperAdminMi: true },
      { tur: 'tamam' },
    ],
    [{ isteyenKokSuperAdminMi: true }, { tur: 'tamam' }],
    [
      {
        hedefKokSuperAdminMi: true,
        sistemAktoruMu: true,
        pasifMi: true,
        sonGirebilenKokSuperAdminMi: true,
      },
      { tur: 'ret', neden: 'superadmin_korumasi' },
    ],
    [
      {
        sistemAktoruMu: true,
        pasifMi: true,
        sonGirebilenKokSuperAdminMi: true,
      },
      { tur: 'ret', neden: 'sistem_aktoru' },
    ],
    [
      { pasifMi: true, sonGirebilenKokSuperAdminMi: true },
      { tur: 'ret', neden: 'pasif' },
    ],
    [
      {
        hedefKokSuperAdminMi: true,
        isteyenKokSuperAdminMi: true,
        sonGirebilenKokSuperAdminMi: true,
      },
      { tur: 'ret', neden: 'son_girebilen_superadmin' },
    ],
  ])('pasife alma kararı %j için %j', (degisen, beklenen) => {
    expect(kullaniciPasifeAlmaKarari({ ...pasifeAlma, ...degisen })).toEqual(
      beklenen,
    );
  });

  it.each([
    [
      { unutulmusMu: false, sistemAktoruMu: false, pasifMi: true },
      { tur: 'tamam' },
    ],
    [
      { unutulmusMu: true, sistemAktoruMu: true, pasifMi: false },
      { tur: 'ret', neden: 'unutulmus' },
    ],
    [
      { unutulmusMu: false, sistemAktoruMu: true, pasifMi: false },
      { tur: 'ret', neden: 'sistem_aktoru' },
    ],
    [
      { unutulmusMu: false, sistemAktoruMu: false, pasifMi: false },
      { tur: 'ret', neden: 'pasif_degil' },
    ],
  ])('yeniden açma kararı %j için %j', (olgular, beklenen) => {
    expect(kullaniciYenidenAcmaKarari(olgular)).toEqual(beklenen);
  });

  const baglanti = { ...ENGELSIZ, kullaniciAdiDoluMu: true };
  it.each([
    [{}, { tur: 'tamam' }],
    [
      { hedefKokSuperAdminMi: true, isteyenKokSuperAdminMi: true },
      { tur: 'tamam' },
    ],
    [
      {
        hedefKokSuperAdminMi: true,
        sistemAktoruMu: true,
        pasifMi: true,
        unutulmusMu: true,
        kullaniciAdiDoluMu: false,
      },
      { tur: 'ret', neden: 'superadmin_korumasi' },
    ],
    [
      {
        sistemAktoruMu: true,
        pasifMi: true,
        unutulmusMu: true,
        kullaniciAdiDoluMu: false,
      },
      { tur: 'ret', neden: 'sistem_aktoru' },
    ],
    [
      { pasifMi: true, unutulmusMu: true, kullaniciAdiDoluMu: false },
      { tur: 'ret', neden: 'pasif' },
    ],
    [
      { unutulmusMu: true, kullaniciAdiDoluMu: false },
      { tur: 'ret', neden: 'unutulmus' },
    ],
    [{ kullaniciAdiDoluMu: false }, { tur: 'ret', neden: 'kullanici_adi_yok' }],
  ])('parola bağlantısı üretme kararı %j için %j', (degisen, beklenen) => {
    expect(parolaBaglantisiUretmeKarari({ ...baglanti, ...degisen })).toEqual(
      beklenen,
    );
  });
});
