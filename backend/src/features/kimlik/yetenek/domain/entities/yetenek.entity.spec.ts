// Yetenek varlığının birim testi: oluşturma işlevi (yazma kararıyla) ve silme ile yenileme kararları.
import type { SartOgesi } from '../../../../../shared/kimlik/yetki-verisi.contract.js';
import {
  type IcerikListesi,
  icerikListesi,
} from '../value-objects/icerik-listesi.js';
import {
  type YetenekIcerigi,
  type YetenekIcerigiAlanlari,
  yetenekIcerigi,
} from '../value-objects/yetenek-icerigi.js';
import {
  type IzinOlgulari,
  type YetenekYazmaOlgulari,
  yetenekOlustur,
  yetenekSilmeKarari,
  yetenekYenilemeKarari,
} from './yetenek.entity.js';

function liste<T>(ham: readonly T[]): IcerikListesi<T> {
  const sonuc = icerikListesi(ham);
  if (sonuc.tur === 'ret') {
    throw new Error(sonuc.neden);
  }
  return sonuc.deger;
}

function icerik(ek: Partial<YetenekIcerigiAlanlari> = {}): YetenekIcerigi {
  const sonuc = yetenekIcerigi({
    sart: null,
    butunKayitlar: true,
    butunBirimler: false,
    kolonlar: null,
    butunKolonlar: true,
    ...ek,
  });
  if (sonuc.tur === 'ret') {
    throw new Error(sonuc.neden.join());
  }
  return sonuc.deger;
}

const BAGLANTI = { grupId: 'g', rolId: 'r', izinId: 'i' };

const IZIN: IzinOlgulari = {
  kaynak: 'Kullanici',
  eylem: 'guncelle',
  kaynakAlanlari: ['ad', 'gorunenAd'],
  derlemeHatasi: undefined,
};

// Her denetimden geçen olgular; durumlar bunun bir alanını bozar.
const GECEN: YetenekYazmaOlgulari = {
  grupCanliMi: true,
  rolCanliMi: true,
  izin: IZIN,
  kokSuperAdminKumesiMi: false,
};

function izinli(ek: Partial<IzinOlgulari>): YetenekYazmaOlgulari {
  return { ...GECEN, izin: { ...IZIN, ...ek } };
}

describe('yetenek varlığı: oluşturma', () => {
  it('yazılacak hâli bağlantı ve içerikten, başka alan katmadan üretir', () => {
    const sart = liste<SartOgesi>([{ alan: 'ad', islec: 'esit', deger: 'x' }]);
    const kolonlar = liste(['ad']);
    expect(
      yetenekOlustur(
        BAGLANTI,
        icerik({ sart, butunKayitlar: false, kolonlar, butunKolonlar: false }),
        GECEN,
      ),
    ).toEqual({
      tur: 'tamam',
      deger: {
        grupId: 'g',
        rolId: 'r',
        izinId: 'i',
        sart,
        butunKayitlar: false,
        butunBirimler: false,
        kolonlar,
        butunKolonlar: false,
      },
    });
  });

  it.each<
    [string, YetenekYazmaOlgulari, Partial<YetenekIcerigiAlanlari>, unknown]
  >([
    [
      'grup canlı değil',
      { ...GECEN, grupCanliMi: false },
      {},
      { kod: 'grup_ya_da_rol_yok' },
    ],
    [
      'rol canlı değil',
      { ...GECEN, rolCanliMi: false },
      {},
      { kod: 'grup_ya_da_rol_yok' },
    ],
    [
      'izin görülemiyor',
      { ...GECEN, izin: undefined },
      {},
      { kod: 'izin_yok' },
    ],
    [
      'kolon kaynağın alanı değil (ilk bilinmeyen döner)',
      GECEN,
      { butunKolonlar: false, kolonlar: liste(['ad', 'x', 'y']) },
      { kod: 'bilinmeyen_kolon', kolon: 'x' },
    ],
    [
      'satır derlenemiyor',
      izinli({ derlemeHatasi: 'bilinmeyen alan' }),
      {},
      { kod: 'derlenemedi', derlemeHatasi: 'bilinmeyen alan' },
    ],
    [
      'korunan kaynağın yazma izni başka kümeye',
      izinli({ kaynak: 'Yetenek', eylem: 'olustur' }),
      {},
      { kod: 'korunan_kaynak' },
    ],
    // Sıra: önceki ret sonrakini örter.
    [
      'grup canlı değil ve izin görülemiyor',
      { ...GECEN, grupCanliMi: false, izin: undefined },
      {},
      { kod: 'grup_ya_da_rol_yok' },
    ],
    [
      'bilinmeyen kolon ve derleme hatası',
      izinli({ derlemeHatasi: 'x' }),
      { butunKolonlar: false, kolonlar: liste(['x']) },
      { kod: 'bilinmeyen_kolon', kolon: 'x' },
    ],
    [
      'derleme hatası ve korunan kaynak',
      izinli({ kaynak: 'Rol', eylem: 'sil', derlemeHatasi: 'x' }),
      {},
      { kod: 'derlenemedi', derlemeHatasi: 'x' },
    ],
  ])('%s reddedilir', (_ad, olgular, ek, neden) => {
    expect(yetenekOlustur(BAGLANTI, icerik(ek), olgular)).toEqual({
      tur: 'ret',
      neden,
    });
  });

  it.each<[string, YetenekYazmaOlgulari]>([
    ['korunan kaynağın okuma izni', izinli({ kaynak: 'Grup', eylem: 'oku' })],
    [
      'korunan kaynağın yazma izni (Kök, SuperAdmin) kümesine',
      {
        ...izinli({ kaynak: 'Uyelik', eylem: 'olustur' }),
        kokSuperAdminKumesiMi: true,
      },
    ],
    [
      'korunmayan kaynağın yazma izni',
      izinli({ kaynak: 'Kullanici', eylem: 'sil' }),
    ],
  ])('%s yazılır', (_ad, olgular) => {
    expect(yetenekOlustur(BAGLANTI, icerik(), olgular).tur).toBe('tamam');
  });
});

describe('yetenek varlığı: silme kararı', () => {
  it.each([
    [{ sistemSatiri: false }, { tur: 'tamam' }],
    [{ sistemSatiri: true }, { tur: 'ret', neden: 'sistem_satiri' }],
    [{ sistemSatiri: undefined }, { tur: 'ret', neden: 'sistem_satiri' }],
  ])('%j için %j', (olgular, beklenen) => {
    expect(yetenekSilmeKarari(olgular)).toEqual(beklenen);
  });
});

describe('yetenek varlığı: yenileme kararı', () => {
  const YENILENIR = {
    kararKolonlariGorunurMu: true,
    silinmisMi: false,
    sistemSatiriMi: false,
    tohumSatiriMi: false,
  };

  it.each([
    [{}, { tur: 'tamam' }],
    [{ kararKolonlariGorunurMu: false }, { tur: 'ret', neden: 'gorulemiyor' }],
    [
      {
        kararKolonlariGorunurMu: false,
        silinmisMi: true,
        sistemSatiriMi: true,
      },
      { tur: 'ret', neden: 'gorulemiyor' },
    ],
    [{ silinmisMi: true }, { tur: 'ret', neden: 'silinmis' }],
    [
      { silinmisMi: true, tohumSatiriMi: true },
      { tur: 'ret', neden: 'silinmis' },
    ],
    [{ sistemSatiriMi: true }, { tur: 'ret', neden: 'korunan_satir' }],
    [{ tohumSatiriMi: true }, { tur: 'ret', neden: 'korunan_satir' }],
  ])('%j için %j', (ek, beklenen) => {
    expect(yetenekYenilemeKarari({ ...YENILENIR, ...ek })).toEqual(beklenen);
  });
});
