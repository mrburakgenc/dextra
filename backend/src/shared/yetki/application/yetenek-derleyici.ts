import type { Ability, RawRuleFrom } from '@casl/ability';
import {
  createPrismaAbility,
  type PrismaQueryFactory,
  type PrismaTypeMap,
} from '@casl/prisma/runtime';
import type {
  KisininSatirlari,
  SabitDeger,
  SartDegeri,
  YetenekSatiri,
} from '../../kimlik/domain/i-yetki-verisi.contract.js';
import type { KaynakKatalogu } from '../domain/kaynak-katalogu.js';
import { yasakBicimi } from '../domain/yasak-bicimi.js';
import {
  type CozulmusSartOgesi,
  kesinTutmuyorKosulu,
  type PrismaKosulu,
  sartiCevir,
  tipiSina,
} from './sart-cevirici.js';

// Üretilmiş Prisma istemcisi olmadan: her tür adı, koşulu düz nesne olan bir modeldir.
export type YetkiKosulu = PrismaQueryFactory<PrismaTypeMap<string>>;

export type YetkiYetenegi = Ability<[string, string], YetkiKosulu>;

// Her kural kaynağı olan yetenek satırının kimliğini taşır; kendi koşulu `conditions`tadır.
export type YetenekKurali = RawRuleFrom<[string, string], YetkiKosulu> & {
  readonly yetenekId: string;
};

// Kuralın etkisi, önceliği ve muafiyeti yetenek satırından gelir (TS-008 "Derleme").
export type DerlenmisKural = YetenekKurali & {
  readonly giremez: boolean;
  readonly oncelik: number;
  readonly yasaktanMuaf: boolean;
  // Yalnız yasakta: okumanın kullanacağı "yasak bu kaydı kesin tutmuyor" koşulu, derlenirken
  // çözülmüş şarttan üretilir; bozuk yasakta hiçbir kaydı tutmaz (TS-008 "Derleme").
  readonly kesinTutmuyor?: PrismaKosulu;
};

export interface DerlenmeyenYetenek {
  readonly yetenekId: string;
  readonly neden: string;
}

// Bozuk yasağın türü: derleme (satır derlenemedi: kaynak, işaret çakışması, şartın biçimi, değer tipi,
// çözülemeyen ya da boş listeye çözülen yer tutucu, bilinmeyen alan ya da işleç), kolon (kolon
// listesinden ad düştü), bicim (yasağın biçimine uymuyor).
export interface BozukYasak extends DerlenmeyenYetenek {
  readonly tur: 'derleme' | 'kolon' | 'bicim';
}

// Bozuk yasağın yerine konan kuralın önceliği (TS-008 AK-2).
const BOZUK_YASAK_ONCELIGI = 100;

// Yetenek nesnesi ve kurallar yalnız izin kurallarıdır: guard ve iki kapı onları okur, yasak izin
// sayılmaz (KU-019). Bütün kurallar izinleri ve yasakları etkisi, önceliği ve muafiyetiyle taşır.
export interface DerlemeSonucu {
  readonly yetenek: YetkiYetenegi;
  readonly kurallar: readonly YetenekKurali[];
  readonly butunKurallar: readonly DerlenmisKural[];
  readonly derlenmeyenler: readonly DerlenmeyenYetenek[];
  // Bozuk yasaklar; her biri bütün kurallarda koşulsuz, bütün kolonlu, öncelik 100 yasak olarak durur.
  readonly bozukYasaklar: readonly BozukYasak[];
  // Yetenek kimliğinden onu kişiye veren üyeliğin kimliğine; erişim kaydı için (KR-010 Seçim 40).
  readonly uyelikler: Readonly<Record<string, string>>;
}

// Kural, yer tutucuları çözülmüş şartıyla birlikte döner.
interface SatirKurali {
  readonly kural: YetenekKurali;
  readonly sart: readonly CozulmusSartOgesi[];
}

type SatirSonucu = SatirKurali | { readonly neden: string } | null;

type YasakSonucu = SatirKurali | Omit<BozukYasak, 'yetenekId'>;

// Her yetenek satırını kimliğini taşıyan tek bir CASL kuralına derler; satırlar birleştirilmez
// (KR-010 Derleme eşlemesi). Kural üretmeyen izin satırı kapalı düşer; bozuk yasak atılmaz, yerine
// koşulsuz yasak konur.
export function yetenekleriDerle(
  veri: Pick<KisininSatirlari, 'yetenekler' | 'altGruplar'>,
  isteyenId: string,
  katalog: KaynakKatalogu,
): Omit<DerlemeSonucu, 'uyelikler'> {
  const kurallar: YetenekKurali[] = [];
  const butunKurallar: DerlenmisKural[] = [];
  const derlenmeyenler: DerlenmeyenYetenek[] = [];
  const bozukYasaklar: BozukYasak[] = [];
  for (const satir of veri.yetenekler) {
    const { yetenekId, oncelik, yasaktanMuaf } = satir;
    if (satir.giremez) {
      const yasak = yasagiDerle(satir, veri.altGruplar, isteyenId, katalog);
      if ('kural' in yasak) {
        butunKurallar.push({
          ...yasak.kural,
          giremez: true,
          oncelik,
          yasaktanMuaf,
          kesinTutmuyor: kesinTutmuyorKosulu(
            yasak.sart,
            katalog.bosOlabilirlik(satir.kaynak) ?? {},
          ),
        });
      } else {
        bozukYasaklar.push({ yetenekId, ...yasak });
        butunKurallar.push({
          yetenekId,
          action: satir.eylem,
          subject: satir.kaynak,
          giremez: true,
          oncelik: BOZUK_YASAK_ONCELIGI,
          yasaktanMuaf,
          kesinTutmuyor: kesinTutmuyorKosulu([], {}),
        });
      }
      continue;
    }
    const sonuc = satiriDerle(satir, veri.altGruplar, isteyenId, katalog);
    if (sonuc === null) {
      continue;
    }
    if ('neden' in sonuc) {
      derlenmeyenler.push({ yetenekId, neden: sonuc.neden });
    } else {
      butunKurallar.push({
        ...sonuc.kural,
        giremez: false,
        oncelik,
        yasaktanMuaf,
      });
      kurallar.push(sonuc.kural);
    }
  }
  return {
    yetenek: createPrismaAbility<[string, string], YetkiKosulu>(kurallar),
    kurallar,
    butunKurallar,
    derlenmeyenler,
    bozukYasaklar,
  };
}

// Bozuk yasağın tek tanımı (TS-008 "Derleme"; KU-017): yazıldığı hâliyle eksiksiz kural üretmeyen her
// yasak bozuktur. Sıra: şartının biçimi bozuk gelen ya da derlenemeyen (bilinmeyen kaynak, işaret
// çakışması, şartın değer tipi, çözülemeyen ya da boş listeye çözülen yer tutucu, bilinmeyen alan ya
// da işleç), kolon listesinden bir ad bile düşen (liste boşalmasa da: yasak daralarak yaşamaz),
// yasağın biçimine uymayan (ne işareti ne şartı ya da listesi olan dahil; yasak-bicimi.ts) ve bunlara
// rağmen kural üretmeyen. Derleyici bozuk yasağın yerine koşulsuz, bütün kolonlu, öncelik 100 yasak
// koyar; yazım denetimi (yetenek yazımı) bozuk derlenecek yasağı reddeder.
function yasagiDerle(
  satir: YetenekSatiri,
  altGruplar: KisininSatirlari['altGruplar'],
  isteyenId: string,
  katalog: KaynakKatalogu,
): YasakSonucu {
  if (satir.sartBicimiBozuk === true) {
    return { tur: 'derleme', neden: 'şartın biçimi bozuk' };
  }
  const sonuc = satiriDerle(satir, altGruplar, isteyenId, katalog);
  if (sonuc !== null && 'neden' in sonuc) {
    return { tur: 'derleme', neden: sonuc.neden };
  }
  const alanlar = katalog.alanlar(satir.kaynak) ?? [];
  const dusen = satir.kolonlar.find((kolon) => !alanlar.includes(kolon));
  if (dusen !== undefined) {
    return { tur: 'kolon', neden: `şemada olmayan kolon: ${dusen}` };
  }
  const bicim = yasakBicimi(satir);
  if (bicim.tur === 'ret') {
    return { tur: 'bicim', neden: `yasağın biçimi: ${bicim.neden}` };
  }
  return sonuc ?? { tur: 'derleme', neden: 'kural üretmiyor' };
}

function satiriDerle(
  satir: YetenekSatiri,
  altGruplar: KisininSatirlari['altGruplar'],
  isteyenId: string,
  katalog: KaynakKatalogu,
): SatirSonucu {
  const alanlar = katalog.alanlar(satir.kaynak);
  const tipler = katalog.alanTipleri(satir.kaynak);
  if (alanlar === undefined || tipler === undefined) {
    return { neden: `bilinmeyen kaynak: ${satir.kaynak}` };
  }
  if (satir.butunKayitlar && satir.sart.length > 0) {
    return { neden: 'bütün kayıtlar işareti şartla birlikte' };
  }
  if (satir.butunKolonlar && satir.kolonlar.length > 0) {
    return { neden: 'bütün kolonlar işareti kolon listesiyle birlikte' };
  }
  if (!satir.butunKayitlar && satir.sart.length === 0) {
    return null;
  }
  const kolonlar = satir.kolonlar.filter((kolon) => alanlar.includes(kolon));
  // Kolon dizisi boşalan satır kural üretmez; şartı yine de önce çevrilir ki şarttaki
  // bilinmeyen ad her durumda bildirilsin (KR-010 Derleme eşlemesi).
  const kolonYok = !satir.butunKolonlar && kolonlar.length === 0;

  const kural: YetenekKurali = {
    yetenekId: satir.yetenekId,
    action: satir.eylem,
    subject: satir.kaynak,
    ...(satir.butunKolonlar ? {} : { fields: kolonlar }),
  };
  if (satir.butunKayitlar) {
    return kolonYok ? null : { kural, sart: [] };
  }

  // Tip, yer tutucu çözülmeden sınanır: yer tutucu anlamıyla (kimlik) sınanır, çözüldüğü değerle değil
  // (TS-002 AK-44). Boş liste şart değeri olamaz (KR-008 Seçim 11).
  const cozulmus: CozulmusSartOgesi[] = [];
  for (const oge of satir.sart) {
    const bulgu = tipiSina(oge, tipler);
    if (bulgu !== undefined) {
      return { neden: 'neden' in bulgu ? bulgu.neden : bulgu.uyumsuz };
    }
    if (Array.isArray(oge.deger) && oge.deger.length === 0) {
      return { neden: `boş liste: ${oge.alan}` };
    }
    const deger = yerTutucuyuCoz(
      oge.deger,
      satir.grupId,
      altGruplar,
      isteyenId,
    );
    if (deger === undefined) {
      return { neden: `yer tutucu çözülemedi: ${oge.alan}` };
    }
    cozulmus.push({ alan: oge.alan, islec: oge.islec, deger });
  }
  const ceviri = sartiCevir(cozulmus, alanlar);
  if ('neden' in ceviri) {
    return ceviri;
  }
  if (kolonYok) {
    return null;
  }
  return {
    kural: { ...kural, conditions: ceviri.kosul as YetkiKosulu },
    sart: cozulmus,
  };
}

// Çözülemeyen ya da boş listeye çözülen yer tutucu için undefined.
function yerTutucuyuCoz(
  deger: SartDegeri,
  grupId: string,
  altGruplar: KisininSatirlari['altGruplar'],
  isteyenId: string,
): SabitDeger | readonly SabitDeger[] | undefined {
  if (typeof deger !== 'object' || !('yerTutucu' in deger)) {
    return deger;
  }
  switch (deger.yerTutucu) {
    case 'isteyen':
      return isteyenId;
    case 'yetenek_grubu':
      return grupId;
    case 'yetenek_grubu_ve_alti': {
      const gruplar = altGruplar[grupId];
      return gruplar === undefined || gruplar.length === 0
        ? undefined
        : gruplar;
    }
  }
}
