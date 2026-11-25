// Oturum varlığının birim testi: özet, oluşturma, döndürme ve dört durum kararı (oturum açma, oturum
// denetimi, yenileme ve pencere, yönetimden kapatma); her kararda sıra da sınanır.
import {
  type DenetimSatiri,
  denetimSonucu,
  dondurme,
  HAREKETSIZLIK_SINIRI_MS,
  HOSGORU_PENCERESI_MS,
  ILK_NESIL,
  MUTLAK_OMUR_MS,
  type OturumSirriSatiri,
  oturumAc,
  oturumAcmaKarari,
  oturumKapatmaKarari,
  oturumSirrininOzeti,
  pencereKarari,
  type YenilemeIstegi,
  type YenilemeSatiri,
  yeniNesil,
  yenilemeKarari,
} from './oturum.entity.js';

const SIMDI = Date.UTC(2026, 10, 25, 12, 0, 0);
const ADRES = { ipAdresi: '10.0.0.1', tarayiciBilgisi: 'tarayici' };

describe('oturum varlığı: sayılar ve özet', () => {
  it('sayılar KR-009 varsayılanlarıdır', () => {
    expect(MUTLAK_OMUR_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(HAREKETSIZLIK_SINIRI_MS).toBe(30 * 60 * 1000);
    expect(HOSGORU_PENCERESI_MS).toBe(10_000);
    expect(ILK_NESIL).toBe(1);
  });

  it('özet SHA-256 onaltılıktır', () => {
    expect(oturumSirrininOzeti('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('oturum varlığı: oturum açma', () => {
  it.each([
    [{ pasif: false, unutulmus: false, sistemAktoru: false }, { tur: 'tamam' }],
    [
      { pasif: true, unutulmus: false, sistemAktoru: false },
      { tur: 'ret', neden: 'kisi_giremez' },
    ],
    [
      { pasif: false, unutulmus: true, sistemAktoru: false },
      { tur: 'ret', neden: 'kisi_giremez' },
    ],
    [
      { pasif: false, unutulmus: false, sistemAktoru: true },
      { tur: 'ret', neden: 'kisi_giremez' },
    ],
  ])('kişi %j için %j', (kisi, beklenen) => {
    expect(oturumAcmaKarari(kisi)).toEqual(beklenen);
  });

  it('yeni oturum mutlak ömürle, başlangıçta döndürülmüş ve ilk nesille, sırlar özetlenerek kurulur', () => {
    const baslangicZamani = new Date(SIMDI);
    expect(
      oturumAc({
        id: 'o1',
        kullaniciId: 'k1',
        girisYontemi: 'parola',
        baslangicZamani,
        ...ADRES,
        yenilemeBelirteci: 'belirtec',
        cihazSirri: 'cihaz',
      }),
    ).toEqual({
      oturum: {
        id: 'o1',
        kullaniciId: 'k1',
        girisYontemi: 'parola',
        baslangicZamani,
        mutlakBitisZamani: new Date(SIMDI + MUTLAK_OMUR_MS),
        sonDondurmeZamani: baslangicZamani,
        ...ADRES,
      },
      sir: {
        nesil: 1,
        gecerliYenilemeOzeti: oturumSirrininOzeti('belirtec'),
        cihazSirriOzeti: oturumSirrininOzeti('cihaz'),
      },
    });
  });
});

describe('oturum varlığı: oturum denetimi', () => {
  const GECERLI: DenetimSatiri = {
    kullaniciId: 'k1',
    mutlakBitisZamani: new Date(SIMDI + 1),
    sonDondurmeZamani: new Date(SIMDI - HAREKETSIZLIK_SINIRI_MS + 1),
    ...ADRES,
    kapali: false,
    kullaniciPasif: false,
    sistemAktoru: false,
    kisiSurumu: 4,
    genelSurum: 9,
  };

  it('satır yoksa yok', () => {
    expect(denetimSonucu(null, { oturumId: 'o1', ...ADRES }, SIMDI)).toEqual({
      gecerli: false,
      neden: 'yok',
    });
  });

  it.each<[string, Partial<DenetimSatiri>, Partial<typeof ADRES>, string]>([
    // Sıra: kapalı, kişi, süre, adres; her satır kendinden sonrakileri de bozar.
    [
      'kapalı',
      { kapali: true, kullaniciPasif: true, mutlakBitisZamani: new Date(0) },
      { ipAdresi: 'x' },
      'kapali',
    ],
    [
      'kişi pasif',
      { kullaniciPasif: true, mutlakBitisZamani: new Date(0) },
      { ipAdresi: 'x' },
      'kullanici_pasif',
    ],
    ['sistem aktörü', { sistemAktoru: true }, {}, 'kullanici_pasif'],
    [
      'mutlak bitiş şimdi',
      { mutlakBitisZamani: new Date(SIMDI) },
      { ipAdresi: 'x' },
      'suresi_doldu',
    ],
    [
      'hareketsizlik sınırı şimdi doldu',
      { sonDondurmeZamani: new Date(SIMDI - HAREKETSIZLIK_SINIRI_MS) },
      {},
      'suresi_doldu',
    ],
    ['IP adresi uymuyor', {}, { ipAdresi: '10.0.0.2' }, 'adres_degisti'],
    ['tarayıcı uymuyor', {}, { tarayiciBilgisi: 'baska' }, 'adres_degisti'],
  ])('%s', (_ad, satir, girdi, neden) => {
    expect(
      denetimSonucu(
        { ...GECERLI, ...satir },
        { oturumId: 'o1', ...ADRES, ...girdi },
        SIMDI,
      ),
    ).toEqual({ gecerli: false, neden });
  });

  it('açık ve adresi uyan oturum geçerlidir ve kişiyi ve sayıları verir', () => {
    expect(denetimSonucu(GECERLI, { oturumId: 'o1', ...ADRES }, SIMDI)).toEqual(
      { gecerli: true, kullaniciId: 'k1', kisiSurumu: 4, genelSurum: 9 },
    );
  });
});

describe('oturum varlığı: yenileme', () => {
  const SIR: OturumSirriSatiri = {
    nesil: 5,
    gecerliYenilemeOzeti: 'gecerli',
    oncekiYenilemeOzeti: 'onceki',
    cihazSirriOzeti: 'cihaz',
  };
  const SON_DONDURME = new Date(SIMDI - 1000);
  const SATIR: YenilemeSatiri = {
    mutlakBitisZamani: new Date(SIMDI + 1),
    sonDondurmeZamani: SON_DONDURME,
    ...ADRES,
    kapali: false,
    sir: SIR,
  };
  const ISTEK: YenilemeIstegi = {
    nesil: 5,
    belirtecOzeti: 'gecerli',
    ...ADRES,
    cihazSirriOzeti: 'cihaz',
  };
  // Pencere içindeki bir önceki neslin isteği.
  const PENCERE: Partial<YenilemeIstegi> = {
    nesil: 4,
    belirtecOzeti: 'onceki',
  };

  it.each<
    [string, YenilemeSatiri | null, Partial<YenilemeIstegi>, unknown]
  >([
    ['satır yok', null, {}, { tur: 'reddet', eskiNesil: false }],
    [
      'kapalı oturuma eski nesil',
      { ...SATIR, kapali: true, mutlakBitisZamani: new Date(0) },
      { nesil: 1 },
      { tur: 'reddet', eskiNesil: true },
    ],
    [
      'kapalı oturuma geçerli nesil',
      { ...SATIR, kapali: true },
      {},
      { tur: 'reddet', eskiNesil: false },
    ],
    [
      'kapalı oturumun sırrı yok',
      { ...SATIR, kapali: true, sir: null },
      { nesil: 1 },
      { tur: 'reddet', eskiNesil: false },
    ],
    [
      'sır yok',
      { ...SATIR, sir: null },
      {},
      { tur: 'reddet', eskiNesil: false },
    ],
    [
      'gelecek nesil',
      { ...SATIR, mutlakBitisZamani: new Date(0) },
      { nesil: 6 },
      { tur: 'kapat', neden: 'tutarsiz_nesil' },
    ],
    [
      'geçerli nesil, özet uymuyor',
      SATIR,
      { belirtecOzeti: 'baska' },
      { tur: 'kapat', neden: 'tutarsiz_nesil' },
    ],
    [
      'iki nesil eski',
      { ...SATIR, mutlakBitisZamani: new Date(0) },
      { nesil: 3, belirtecOzeti: 'onceki' },
      { tur: 'yeniden_kullanim' },
    ],
    [
      'bir önceki nesil, özet uymuyor',
      SATIR,
      { nesil: 4, belirtecOzeti: 'baska' },
      { tur: 'yeniden_kullanim' },
    ],
    [
      'bir önceki nesil, pencere şimdi kapandı',
      { ...SATIR, sonDondurmeZamani: new Date(SIMDI - HOSGORU_PENCERESI_MS) },
      PENCERE,
      { tur: 'yeniden_kullanim' },
    ],
    [
      'mutlak bitiş şimdi (pencere içinde de)',
      { ...SATIR, mutlakBitisZamani: new Date(SIMDI) },
      { ...PENCERE, ipAdresi: 'x' },
      { tur: 'kapat', neden: 'sure' },
    ],
    [
      'hareketsizlik sınırı şimdi doldu',
      {
        ...SATIR,
        sonDondurmeZamani: new Date(SIMDI - HAREKETSIZLIK_SINIRI_MS),
      },
      { ipAdresi: 'x' },
      { tur: 'kapat', neden: 'sure' },
    ],
    [
      'adres uymuyor',
      SATIR,
      { ipAdresi: 'x', cihazSirriOzeti: 'baska' },
      { tur: 'kapat', neden: 'adres_degisti' },
    ],
    [
      'tarayıcı uymuyor',
      SATIR,
      { tarayiciBilgisi: 'x' },
      { tur: 'kapat', neden: 'adres_degisti' },
    ],
    [
      'cihaz sırrı uymuyor (pencere içinde de)',
      SATIR,
      { ...PENCERE, cihazSirriOzeti: 'baska' },
      { tur: 'kapat', neden: 'cihaz_uymadi' },
    ],
    [
      'geçerli nesil',
      SATIR,
      {},
      { tur: 'dondur', sir: SIR, sonDondurmeZamani: SON_DONDURME },
    ],
    [
      'pencere içinde bir önceki nesil',
      SATIR,
      PENCERE,
      { tur: 'pencere', sir: SIR, sonDondurmeZamani: SON_DONDURME },
    ],
  ])('%s', (_ad, satir, istek, beklenen) => {
    expect(yenilemeKarari(satir, { ...ISTEK, ...istek }, SIMDI)).toEqual(
      beklenen,
    );
  });

  it('pencerede yeniden imzalanan belirteç saklanan özete uymalıdır', () => {
    const sir = { ...SIR, gecerliYenilemeOzeti: oturumSirrininOzeti('b') };
    expect(pencereKarari(sir, 'b')).toEqual({ tur: 'tamam' });
    expect(pencereKarari(sir, 'c')).toEqual({
      tur: 'ret',
      neden: 'ozet_uymadi',
    });
  });

  it('döndürme nesli bir artırır, eski geçerli özeti önceki yapar ve zamanı yazar', () => {
    const simdi = new Date(SIMDI);
    expect(yeniNesil(SIR)).toBe(6);
    expect(dondurme(SIR, 'yeni', simdi)).toEqual({
      nesil: 6,
      gecerliYenilemeOzeti: oturumSirrininOzeti('yeni'),
      oncekiYenilemeOzeti: 'gecerli',
      sonDondurmeZamani: simdi,
    });
  });
});

describe('oturum varlığı: yönetimden kapatma', () => {
  it.each([
    [{ kapaliMi: null, sahibiMi: true }, { tur: 'ret', neden: 'gorulemiyor' }],
    [{ kapaliMi: true, sahibiMi: null }, { tur: 'ret', neden: 'gorulemiyor' }],
    [{ kapaliMi: null, sahibiMi: null }, { tur: 'ret', neden: 'gorulemiyor' }],
    [{ kapaliMi: true, sahibiMi: true }, { tur: 'ret', neden: 'zaten_kapali' }],
    [
      { kapaliMi: false, sahibiMi: true },
      { tur: 'tamam', deger: 'sahibi_kapatti' },
    ],
    [
      { kapaliMi: false, sahibiMi: false },
      { tur: 'tamam', deger: 'yonetici' },
    ],
  ])('olgular %j için %j', (olgular, beklenen) => {
    expect(oturumKapatmaKarari(olgular)).toEqual(beklenen);
  });
});
