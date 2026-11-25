// Yasağın biçimi kuralının birim testi (TS-008 "Yasağın biçimi"; KU-020): her ret için bir kırmızı durum,
// iki geçerli yasak biçimi için birer yeşil durum.
import { type YasakBicimiGirdisi, yasakBicimi } from './yasak-bicimi.js';

// Kaydın bütününü kapatan yasak: bütün kayıtlar, bütün kolonlar.
const BUTUN_KAYIT: YasakBicimiGirdisi = {
  kaynak: 'Kullanici',
  eylem: 'oku',
  sart: [],
  butunKayitlar: true,
  kolonlar: [],
  butunKolonlar: true,
  giremez: true,
  oncelik: 10,
};

// Kolon listeli yasak: şartlı, yalnız telefon kolonu.
const KOLON_LISTELI: YasakBicimiGirdisi = {
  ...BUTUN_KAYIT,
  sart: [{ alan: 'kullaniciAdi', islec: 'esit', deger: 'ali' }],
  butunKayitlar: false,
  kolonlar: ['telefon'],
  butunKolonlar: false,
};

describe('yasağın biçimi', () => {
  it.each<[string, YasakBicimiGirdisi]>([
    ['kaydın bütününü kapatan yasak', BUTUN_KAYIT],
    ['kolon listeli yasak', KOLON_LISTELI],
  ])('%s geçer', (_ad, satir) => {
    expect(yasakBicimi(satir)).toEqual({ tur: 'tamam' });
  });

  it.each<[string, Partial<YasakBicimiGirdisi>, string]>([
    [
      'ne bütün kolonlar işareti ne kolon listesi',
      { butunKolonlar: false, kolonlar: [] },
      'kolon_siniri_yok',
    ],
    [
      'ne bütün kayıtlar işareti ne şart',
      { butunKayitlar: false, sart: [] },
      'kayit_siniri_yok',
    ],
    [
      'listede kimlik kolonu',
      { butunKolonlar: false, kolonlar: ['telefon', 'id'] },
      'kimlik_kolonu',
    ],
    [
      'oluşturma eylemine kolon listesi',
      { eylem: 'olustur', butunKolonlar: false, kolonlar: ['telefon'] },
      'kayit_duzeyi_eylemde_kolon',
    ],
    [
      'silme eylemine kolon listesi',
      { eylem: 'sil', butunKolonlar: false, kolonlar: ['telefon'] },
      'kayit_duzeyi_eylemde_kolon',
    ],
    [
      'niyet eylemine kolon listesi',
      { eylem: 'kapat', butunKolonlar: false, kolonlar: ['telefon'] },
      'kayit_duzeyi_eylemde_kolon',
    ],
    [
      'korunan kaynağın yazma eylemi',
      { kaynak: 'Grup', eylem: 'sil' },
      'korunan_kaynak',
    ],
    ['sıfırdan küçük öncelik', { oncelik: -1 }, 'oncelik_araligi'],
    ['yüzden büyük öncelik', { oncelik: 101 }, 'oncelik_araligi'],
    ['tam sayı olmayan öncelik', { oncelik: 1.5 }, 'oncelik_araligi'],
  ])('%s reddedilir', (_ad, ek, neden) => {
    expect(yasakBicimi({ ...BUTUN_KAYIT, ...ek })).toEqual({
      tur: 'ret',
      neden,
    });
  });

  it('korunan kaynağın okuma eylemine yasak yazılır', () => {
    expect(yasakBicimi({ ...BUTUN_KAYIT, kaynak: 'Grup' }).tur).toBe('tamam');
  });

  it('izin biçimden yalnız önceliğiyle sınanır', () => {
    const izin = {
      ...BUTUN_KAYIT,
      giremez: false,
      kaynak: 'Grup',
      eylem: 'sil',
      butunKayitlar: false,
      butunKolonlar: false,
    };
    expect(yasakBicimi({ ...izin, oncelik: 0 }).tur).toBe('tamam');
    expect(yasakBicimi({ ...izin, oncelik: 101 })).toEqual({
      tur: 'ret',
      neden: 'oncelik_araligi',
    });
  });
});
