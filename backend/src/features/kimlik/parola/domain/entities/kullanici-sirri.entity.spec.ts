// Kullanıcı sırrı varlığının birim testi: beş durum kararı ve ret sıraları.
import {
  eskiParolaKarari,
  girisKarari,
  girisKesinlestirmeKarari,
  parolaBelirlemeKarari,
  parolaDegistirmeKarari,
} from './kullanici-sirri.entity.js';

const SIMDI = new Date('2026-11-25T10:00:00.000Z');
const ONCE = new Date('2026-11-25T09:00:00.000Z');
const SONRA = new Date('2026-11-25T11:00:00.000Z');
const SIR = { parolaOzeti: 'ozet', guncellemeZamani: ONCE };

describe('kullanıcı sırrı varlığı', () => {
  it('bağlantıyla belirleme kararı geçerli bağlantıyı değeriyle verir', () => {
    const baglanti = {
      id: 'b',
      kullanilmaZamani: null,
      sonGecerlilikZamani: SONRA,
    };
    expect(parolaBelirlemeKarari({ baglanti, simdi: SIMDI })).toEqual({
      tur: 'tamam',
      deger: baglanti,
    });
  });

  it.each([
    [null, { tur: 'ret', neden: 'baglanti_gecersiz' }],
    [
      { kullanilmaZamani: ONCE, sonGecerlilikZamani: SONRA },
      { tur: 'ret', neden: 'baglanti_gecersiz' },
    ],
    [
      { kullanilmaZamani: null, sonGecerlilikZamani: ONCE },
      { tur: 'ret', neden: 'baglanti_gecersiz' },
    ],
    // Son geçerlilik anı geçersiz sayılır.
    [
      { kullanilmaZamani: null, sonGecerlilikZamani: SIMDI },
      { tur: 'ret', neden: 'baglanti_gecersiz' },
    ],
  ])('bağlantıyla belirleme kararı %j için %j', (baglanti, beklenen) => {
    expect(parolaBelirlemeKarari({ baglanti, simdi: SIMDI })).toEqual(beklenen);
  });

  it.each([
    [
      { sir: SIR, parolaDogruMu: true },
      { tur: 'tamam', deger: SIR },
    ],
    [
      { sir: null, parolaDogruMu: false },
      { tur: 'ret', neden: 'parola_yok' },
    ],
    // Parolası olmayan kişide parola_yok, eski parolanın sonucundan önce gelir.
    [
      { sir: null, parolaDogruMu: true },
      { tur: 'ret', neden: 'parola_yok' },
    ],
    [
      { sir: SIR, parolaDogruMu: false },
      { tur: 'ret', neden: 'eski_parola_yanlis' },
    ],
  ])('eski parola kararı %j için %j', (olgular, beklenen) => {
    expect(eskiParolaKarari(olgular)).toEqual(beklenen);
  });

  it.each([
    [
      {
        okunanZaman: ONCE,
        kilitAltindakiZaman: new Date(ONCE),
        oturumAcikMi: true,
      },
      { tur: 'tamam' },
    ],
    [
      { okunanZaman: ONCE, kilitAltindakiZaman: SIMDI, oturumAcikMi: true },
      { tur: 'ret', neden: 'sir_degisti' },
    ],
    [
      { okunanZaman: ONCE, kilitAltindakiZaman: null, oturumAcikMi: true },
      { tur: 'ret', neden: 'sir_degisti' },
    ],
    // Sır değiştiyse oturumun kapalı olması sonucu değiştirmez.
    [
      { okunanZaman: ONCE, kilitAltindakiZaman: SIMDI, oturumAcikMi: false },
      { tur: 'ret', neden: 'sir_degisti' },
    ],
    [
      { okunanZaman: ONCE, kilitAltindakiZaman: ONCE, oturumAcikMi: false },
      { tur: 'ret', neden: 'oturum_kapali' },
    ],
  ])('parola değiştirme kararı %j için %j', (olgular, beklenen) => {
    expect(parolaDegistirmeKarari(olgular)).toEqual(beklenen);
  });

  it.each([
    [
      { sir: SIR, parolaDogruMu: true },
      { tur: 'tamam', deger: SIR },
    ],
    [
      { sir: SIR, parolaDogruMu: false },
      { tur: 'ret', neden: 'yanlis' },
    ],
    [
      { sir: null, parolaDogruMu: false },
      { tur: 'ret', neden: 'yanlis' },
    ],
    [
      { sir: null, parolaDogruMu: true },
      { tur: 'ret', neden: 'yanlis' },
    ],
  ])('giriş kararı %j için %j', (olgular, beklenen) => {
    expect(girisKarari(olgular)).toEqual(beklenen);
  });

  it.each([
    [
      { kanit: ONCE.toISOString(), kilitAltindakiZaman: new Date(ONCE) },
      { tur: 'tamam' },
    ],
    [
      { kanit: ONCE.toISOString(), kilitAltindakiZaman: SIMDI },
      { tur: 'ret', neden: 'sir_degisti' },
    ],
    [
      { kanit: ONCE.toISOString(), kilitAltindakiZaman: null },
      { tur: 'ret', neden: 'sir_degisti' },
    ],
  ])('giriş kesinleştirme kararı %j için %j', (olgular, beklenen) => {
    expect(girisKesinlestirmeKarari(olgular)).toEqual(beklenen);
  });
});
