// Üyelik varlığının birim testi: verme işlevi, kimlik sıfırlamasının bağlantısı ve iki kaldırma kararı;
// her ret ve denetimlerin sırası.
import {
  sifirlamaBaglantisi,
  type UyelikKaldirmaOlgulari,
  uyelikKaldirmaKarari,
  uyelikKaldirmaOncesiKarari,
  type UyelikVermeOlgulari,
  uyelikVer,
} from './uyelik.entity.js';

const UYELIK = { kullaniciId: 'k', grupId: 'g', rolId: 'r' };

// Her denetimden geçen sıradan (SuperAdmin olmayan) üyeliğin olguları.
const VERILEBILIR: UyelikVermeOlgulari = {
  superAdminUyeligiMi: false,
  isteyenSuperAdminMi: false,
  kisiSuperAdminMi: false,
  grupCanliMi: true,
  rolCanliMi: true,
  kisiPasifMi: false,
  kisiUnutulmusMu: false,
  kisiSistemAktoruMu: false,
};

const KALDIRILABILIR: UyelikKaldirmaOlgulari = {
  superAdminUyeligiMi: false,
  grupKokMu: false,
  rolSistemRoluMu: false,
  isteyenSuperAdminMi: false,
  sonGirebilenSuperAdminMi: false,
};

describe('üyelik varlığı: verme', () => {
  it('sıradan üyelik kimlik sıfırlamadan verilir; isteyenin ve kişinin SuperAdmin olup olmadığı bakılmaz', () => {
    expect(
      uyelikVer(UYELIK, {
        ...VERILEBILIR,
        isteyenSuperAdminMi: false,
        kisiSuperAdminMi: true,
      }),
    ).toEqual({
      tur: 'tamam',
      deger: { uyelik: UYELIK, kimlikSifirlanirMi: false },
    });
  });

  it('SuperAdmin üyeliği, SuperAdmin olan isteyenden, SuperAdmin olmayan kişiye kimliği sıfırlanarak verilir', () => {
    expect(
      uyelikVer(UYELIK, {
        ...VERILEBILIR,
        superAdminUyeligiMi: true,
        isteyenSuperAdminMi: true,
      }),
    ).toEqual({
      tur: 'tamam',
      deger: { uyelik: UYELIK, kimlikSifirlanirMi: true },
    });
  });

  it.each<[string, Partial<UyelikVermeOlgulari>, string]>([
    [
      'SuperAdmin olmayan isteyen',
      { superAdminUyeligiMi: true },
      'superadmin_degil',
    ],
    [
      'zaten SuperAdmin olan kişi',
      {
        superAdminUyeligiMi: true,
        isteyenSuperAdminMi: true,
        kisiSuperAdminMi: true,
      },
      'zaten_superadmin',
    ],
    ['silinmiş grup', { grupCanliMi: false }, 'grup_ya_da_rol_yok'],
    ['silinmiş rol', { rolCanliMi: false }, 'grup_ya_da_rol_yok'],
    ['pasif kişi', { kisiPasifMi: true }, 'kisi_uygun_degil'],
    ['unutulmuş kişi', { kisiUnutulmusMu: true }, 'kisi_uygun_degil'],
    ['sistem aktörü', { kisiSistemAktoruMu: true }, 'kisi_uygun_degil'],
  ])('%s reddedilir', (_ad, fark, neden) => {
    expect(uyelikVer(UYELIK, { ...VERILEBILIR, ...fark })).toEqual({
      tur: 'ret',
      neden,
    });
  });

  it.each<[string, Partial<UyelikVermeOlgulari>, string]>([
    [
      'isteyenin yetkisi kişinin SuperAdmin oluşundan önce',
      { superAdminUyeligiMi: true, kisiSuperAdminMi: true },
      'superadmin_degil',
    ],
    [
      'SuperAdmin denetimi grup ve rolden önce',
      { superAdminUyeligiMi: true, grupCanliMi: false },
      'superadmin_degil',
    ],
    [
      'zaten SuperAdmin denetimi grup ve rolden önce',
      {
        superAdminUyeligiMi: true,
        isteyenSuperAdminMi: true,
        kisiSuperAdminMi: true,
        rolCanliMi: false,
      },
      'zaten_superadmin',
    ],
    [
      'grup ve rol kişiden önce',
      { grupCanliMi: false, kisiPasifMi: true },
      'grup_ya_da_rol_yok',
    ],
  ])('sıra: %s', (_ad, fark, neden) => {
    expect(uyelikVer(UYELIK, { ...VERILEBILIR, ...fark })).toEqual({
      tur: 'ret',
      neden,
    });
  });
});

describe('üyelik varlığı: kimlik sıfırlamasının bağlantısı', () => {
  it.each([
    [true, 'uret'],
    [false, 'sil'],
  ])('kullanıcı adı dolu mu %j: %s', (kullaniciAdiDoluMu, beklenen) => {
    expect(sifirlamaBaglantisi({ kullaniciAdiDoluMu })).toBe(beklenen);
  });
});

describe('üyelik varlığı: kaldırma', () => {
  it.each([
    [{ canliMi: true }, { tur: 'tamam' }],
    [{ canliMi: false }, { tur: 'ret', neden: 'silinmis' }],
  ])('kaldırma öncesi kararı %j için %j', (olgular, beklenen) => {
    expect(uyelikKaldirmaOncesiKarari(olgular)).toEqual(beklenen);
  });

  it.each<[string, Partial<UyelikKaldirmaOlgulari>]>([
    ['sıradan üyelik', {}],
    ['kök grupta sistem rolü olmayan rol', { grupKokMu: true }],
    ['kök olmayan grupta sistem rolü', { rolSistemRoluMu: true }],
    [
      'SuperAdmin üyeliği, SuperAdmin olan isteyen, son olmayan kişi',
      { superAdminUyeligiMi: true, isteyenSuperAdminMi: true },
    ],
    [
      'SuperAdmin olmayan üyelikte son girebilen SuperAdmin olgusu bakılmaz',
      { sonGirebilenSuperAdminMi: true },
    ],
  ])('%s kaldırılır', (_ad, fark) => {
    expect(uyelikKaldirmaKarari({ ...KALDIRILABILIR, ...fark })).toEqual({
      tur: 'tamam',
    });
  });

  it.each<[string, Partial<UyelikKaldirmaOlgulari>, string]>([
    [
      '(Kök, Temel) üyeliği',
      { grupKokMu: true, rolSistemRoluMu: true },
      'temel_uyelik',
    ],
    [
      'SuperAdmin olmayan isteyenin SuperAdmin üyeliği kaldırması',
      { superAdminUyeligiMi: true },
      'superadmin_degil',
    ],
    [
      'girebilen son SuperAdmin üyeliği',
      {
        superAdminUyeligiMi: true,
        isteyenSuperAdminMi: true,
        sonGirebilenSuperAdminMi: true,
      },
      'son_superadmin',
    ],
    [
      'sıra: isteyenin yetkisi son SuperAdmin denetiminden önce',
      { superAdminUyeligiMi: true, sonGirebilenSuperAdminMi: true },
      'superadmin_degil',
    ],
  ])('%s reddedilir', (_ad, fark, neden) => {
    expect(uyelikKaldirmaKarari({ ...KALDIRILABILIR, ...fark })).toEqual({
      tur: 'ret',
      neden,
    });
  });

  it('kök grup ile sistem rolü SuperAdmin kümesiyse temel üyelik sayılmaz', () => {
    expect(
      uyelikKaldirmaKarari({
        ...KALDIRILABILIR,
        superAdminUyeligiMi: true,
        grupKokMu: true,
        rolSistemRoluMu: true,
        isteyenSuperAdminMi: true,
      }),
    ).toEqual({ tur: 'tamam' });
  });
});
