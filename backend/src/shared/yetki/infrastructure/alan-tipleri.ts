import type { Prisma } from '../../database/generated/client.js';
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

// Üretilmiş istemcinin süzgeç tipinden alan tipine. Burada olmayan süzgeç (örnek: şemaya ilk Float
// alanı eklenince FloatFilter) never'a düşer ve tablo, eşleme genişletilmeden derlenmez.
type SuzgecTipleri<M> =
  | [Prisma.UuidFilter<M>, 'kimlik']
  | [Prisma.UuidNullableFilter<M>, 'kimlik']
  | [Prisma.StringFilter<M>, 'metin']
  | [Prisma.StringNullableFilter<M>, 'metin']
  | [Prisma.IntFilter<M>, 'sayi']
  | [Prisma.BoolFilter<M>, 'mantiksal']
  | [Prisma.DateTimeFilter<M>, 'zaman']
  | [Prisma.DateTimeNullableFilter<M>, 'zaman']
  | [Prisma.JsonFilter<M>, 'obur']
  | [Prisma.JsonNullableFilter<M>, 'obur']
  | [Prisma.StringNullableListFilter<M>, 'obur'];

type SuzgectenTip<S, M> =
  SuzgecTipleri<M> extends infer E
    ? E extends [infer Suzgec, infer Tip]
      ? Ozdes<S, Suzgec> extends true
        ? Tip
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

type AlanTipleri = {
  readonly [M in Prisma.ModelName]: {
    readonly [A in AlanAdi<M> & string]: AlaninTipi<M, A>;
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
  },
  YetkiSurumu: {
    id: 'sayi',
    sayac: 'sayi',
  },
} as const satisfies AlanTipleri;
