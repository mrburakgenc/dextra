import type { Prisma } from '../../database/generated/client.js';
import type { AlanTipi } from '../domain/alan-tipi.js';
import type { AlanAdi } from './prisma-kaynak-katalogu.js';

// Prisma 7'nin üretilmiş istemcisi çalışma anında kimlik (@db.Uuid) ile metni, dizi ile tekil alanı
// ayıran model bilgisi vermez; bu bilgi yalnız tiplerde, modelin sorgu koşulundaki süzgeç tipinde
// durur (UuidFilter, StringFilter, StringNullableListFilter...). Bu yüzden tablo elle yazılır ve
// derleyici onu şemadan hesaplanan tipe birebir uydurur: model ya da alan eksikse, fazlaysa ya da
// tipi yanlışsa tip denetimi kırılır.

// İki süzgeç aynı mı: birbirine atanabilir ve anahtarları aynı. Atanabilirlik tek başına yetmez:
// bütün alanları isteğe bağlı olduğu için UuidFilter ile StringFilter karşılıklı atanabilir; StringFilter
// fazladan contains, startsWith ve endsWith taşır.
type Ozdes<A, B> = [A, keyof A] extends [B, keyof B]
  ? [B, keyof B] extends [A, keyof A]
    ? true
    : false
  : false;

type SorguKosulu<M extends Prisma.ModelName> = NonNullable<
  Prisma.TypeMap['model'][M]['operations']['findMany']['args']['where']
>;

// Üretilmiş istemcinin süzgeç tipinden alan tipine ve kolonun boş olabilirliğine. Burada olmayan
// süzgeç (örnek: şemaya ilk Float alanı eklenince FloatFilter) never'a düşer ve iki tablo, eşleme
// genişletilmeden derlenmez. Şartta kullanılamayan ('obur') kolonun boş olabilirliği yoktur (never):
// Json ile Json? kolonun süzgeç tipleri yapıca aynıdır, tipten ayırt edilemez.
type SuzgecTipleri<M> =
  | [Prisma.UuidFilter<M>, 'kimlik', false]
  | [Prisma.UuidNullableFilter<M>, 'kimlik', true]
  | [Prisma.StringFilter<M>, 'metin', false]
  | [Prisma.StringNullableFilter<M>, 'metin', true]
  | [Prisma.IntFilter<M>, 'sayi', false]
  | [Prisma.BoolFilter<M>, 'mantiksal', false]
  | [Prisma.DateTimeFilter<M>, 'zaman', false]
  | [Prisma.DateTimeNullableFilter<M>, 'zaman', true]
  | [Prisma.JsonFilter<M>, 'obur', never]
  | [Prisma.JsonNullableFilter<M>, 'obur', never]
  | [Prisma.StringNullableListFilter<M>, 'obur', never];

type SuzgectenTip<S, M> =
  SuzgecTipleri<M> extends infer E
    ? E extends [infer Suzgec, infer Tip, boolean]
      ? Ozdes<S, Suzgec> extends true
        ? Tip
        : never
      : never
    : never;

type SuzgectenBosOlabilirlik<S, M> =
  SuzgecTipleri<M> extends infer E
    ? E extends [infer Suzgec, AlanTipi, infer Bos]
      ? Ozdes<S, Suzgec> extends true
        ? Bos
        : never
      : never
    : never;

// Sorgu koşulunda alan, süzgeç ile alanın düz değerlerinin birleşimidir; düz değerler atılır.
type AlaninTipi<M extends Prisma.ModelName, A> = SuzgectenTip<
  Exclude<
    SorguKosulu<M>[A & keyof SorguKosulu<M>],
    string | number | boolean | Date | null | undefined
  >,
  M
>;

type AlaninBosOlabilirligi<
  M extends Prisma.ModelName,
  A,
> = SuzgectenBosOlabilirlik<
  Exclude<
    SorguKosulu<M>[A & keyof SorguKosulu<M>],
    string | number | boolean | Date | null | undefined
  >,
  M
>;

type AlanTipleri = {
  readonly [M in Prisma.ModelName]: {
    readonly [A in AlanAdi<M> & string]: AlaninTipi<M, A>;
  };
};

// Yalnız şartta kullanılabilen kolonlar: 'obur' kolon tabloya yazılırsa tip denetimi kırılır.
type BosOlabilirlik = {
  readonly [M in Prisma.ModelName]: {
    readonly [A in AlanAdi<M> & string as AlaninTipi<M, A> extends 'obur'
      ? never
      : A]: AlaninBosOlabilirligi<M, A>;
  };
};

// Üretilmiş istemcideki bütün modeller: katalog her modeli kaynak alabilir.
export const ALAN_TIPLERI = {
  OutboxIz: {
    id: 'kimlik',
    surum: 'sayi',
    govde: 'obur',
    olusturmaZamani: 'zaman',
    aktarimZamani: 'zaman',
    denemeSayisi: 'sayi',
    sonrakiDenemeZamani: 'zaman',
    sonHata: 'metin',
  },
  OutboxOlay: {
    id: 'kimlik',
    ad: 'metin',
    surum: 'sayi',
    govde: 'obur',
    olusturmaZamani: 'zaman',
    aktarimZamani: 'zaman',
    denemeSayisi: 'sayi',
    sonrakiDenemeZamani: 'zaman',
    sonHata: 'metin',
  },
  IslenenOlay: {
    tuketici: 'metin',
    olayId: 'kimlik',
    durum: 'metin',
    sahiplenmeBitisZamani: 'zaman',
    tamamlanmaZamani: 'zaman',
    olusturmaZamani: 'zaman',
    sahipId: 'kimlik',
  },
  TohumGocu: {
    ad: 'metin',
    uygulanmaZamani: 'zaman',
  },
  Kullanici: {
    id: 'kimlik',
    kullaniciAdi: 'metin',
    telefon: 'metin',
    gorunenAd: 'metin',
    sistemAktoru: 'mantiksal',
    yetkiSurumu: 'sayi',
    pasifZamani: 'zaman',
    unutulmaZamani: 'zaman',
    olusturmaZamani: 'zaman',
  },
  KullaniciSirri: {
    kullaniciId: 'kimlik',
    parolaOzeti: 'metin',
    guncellemeZamani: 'zaman',
  },
  Oturum: {
    id: 'kimlik',
    kullaniciId: 'kimlik',
    girisYontemi: 'metin',
    baslangicZamani: 'zaman',
    mutlakBitisZamani: 'zaman',
    sonDondurmeZamani: 'zaman',
    ipAdresi: 'metin',
    tarayiciBilgisi: 'metin',
    kapatilmaZamani: 'zaman',
    kapatilmaNedeni: 'metin',
  },
  OturumSirri: {
    oturumId: 'kimlik',
    nesil: 'sayi',
    gecerliYenilemeOzeti: 'metin',
    oncekiYenilemeOzeti: 'metin',
    cihazSirriOzeti: 'metin',
  },
  ParolaBaglantisi: {
    id: 'kimlik',
    kullaniciId: 'kimlik',
    kodOzeti: 'metin',
    sonGecerlilikZamani: 'zaman',
    kullanilmaZamani: 'zaman',
    olusturanId: 'kimlik',
    olusturmaZamani: 'zaman',
  },
  Grup: {
    id: 'kimlik',
    ustGrupId: 'kimlik',
    ad: 'metin',
    silinmeZamani: 'zaman',
    olusturmaZamani: 'zaman',
  },
  Rol: {
    id: 'kimlik',
    kod: 'metin',
    ad: 'metin',
    silinmeZamani: 'zaman',
  },
  Izin: {
    id: 'kimlik',
    kaynak: 'metin',
    eylem: 'metin',
  },
  Uyelik: {
    id: 'kimlik',
    kullaniciId: 'kimlik',
    grupId: 'kimlik',
    rolId: 'kimlik',
    silinmeZamani: 'zaman',
    olusturmaZamani: 'zaman',
  },
  Yetenek: {
    id: 'kimlik',
    grupId: 'kimlik',
    rolId: 'kimlik',
    izinId: 'kimlik',
    sart: 'obur',
    butunKayitlar: 'mantiksal',
    butunBirimler: 'mantiksal',
    kolonlar: 'obur',
    butunKolonlar: 'mantiksal',
    sistemSatiri: 'mantiksal',
    silinmeZamani: 'zaman',
    tohumAnahtari: 'metin',
    yerineGectigiId: 'kimlik',
    koken: 'metin',
    olusturmaZamani: 'zaman',
    giremez: 'mantiksal',
    oncelik: 'sayi',
  },
  YetkiSurumu: {
    id: 'sayi',
    sayac: 'sayi',
  },
} as const satisfies AlanTipleri;

// Şartta kullanılabilen her kolonun boş değer alıp alamadığı (TS-008 "Veri modeli"; kapanan AU-5):
// alan tipleri gibi elle yazılır ve şemadan hesaplanan tipe birebir uydurulur; yanlış, eksik ya da
// fazla yazılan kolon tip denetimini kırar. 'obur' kolonlar (Json, dizi) şarta giremediği için yoktur.
export const BOS_OLABILIRLIK = {
  OutboxIz: {
    id: false,
    surum: false,
    olusturmaZamani: false,
    aktarimZamani: true,
    denemeSayisi: false,
    sonrakiDenemeZamani: true,
    sonHata: true,
  },
  OutboxOlay: {
    id: false,
    ad: false,
    surum: false,
    olusturmaZamani: false,
    aktarimZamani: true,
    denemeSayisi: false,
    sonrakiDenemeZamani: true,
    sonHata: true,
  },
  IslenenOlay: {
    tuketici: false,
    olayId: false,
    durum: false,
    sahiplenmeBitisZamani: false,
    tamamlanmaZamani: true,
    olusturmaZamani: false,
    sahipId: false,
  },
  TohumGocu: {
    ad: false,
    uygulanmaZamani: false,
  },
  Kullanici: {
    id: false,
    kullaniciAdi: true,
    telefon: true,
    gorunenAd: false,
    sistemAktoru: false,
    yetkiSurumu: false,
    pasifZamani: true,
    unutulmaZamani: true,
    olusturmaZamani: false,
  },
  KullaniciSirri: {
    kullaniciId: false,
    parolaOzeti: false,
    guncellemeZamani: false,
  },
  Oturum: {
    id: false,
    kullaniciId: false,
    girisYontemi: false,
    baslangicZamani: false,
    mutlakBitisZamani: false,
    sonDondurmeZamani: false,
    ipAdresi: false,
    tarayiciBilgisi: false,
    kapatilmaZamani: true,
    kapatilmaNedeni: true,
  },
  OturumSirri: {
    oturumId: false,
    nesil: false,
    gecerliYenilemeOzeti: false,
    oncekiYenilemeOzeti: true,
    cihazSirriOzeti: false,
  },
  ParolaBaglantisi: {
    id: false,
    kullaniciId: false,
    kodOzeti: false,
    sonGecerlilikZamani: false,
    kullanilmaZamani: true,
    olusturanId: true,
    olusturmaZamani: false,
  },
  Grup: {
    id: false,
    ustGrupId: true,
    ad: false,
    silinmeZamani: true,
    olusturmaZamani: false,
  },
  Rol: {
    id: false,
    kod: true,
    ad: false,
    silinmeZamani: true,
  },
  Izin: {
    id: false,
    kaynak: false,
    eylem: false,
  },
  Uyelik: {
    id: false,
    kullaniciId: false,
    grupId: false,
    rolId: false,
    silinmeZamani: true,
    olusturmaZamani: false,
  },
  Yetenek: {
    id: false,
    grupId: false,
    rolId: false,
    izinId: false,
    butunKayitlar: false,
    butunBirimler: false,
    butunKolonlar: false,
    sistemSatiri: false,
    silinmeZamani: true,
    tohumAnahtari: true,
    yerineGectigiId: true,
    koken: false,
    olusturmaZamani: false,
    giremez: false,
    oncelik: false,
  },
  YetkiSurumu: {
    id: false,
    sayac: false,
  },
} as const satisfies BosOlabilirlik;
