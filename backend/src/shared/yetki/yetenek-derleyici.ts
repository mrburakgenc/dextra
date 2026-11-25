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
} from '../kimlik/yetki-verisi.contract.js';
import type { KaynakKatalogu } from './kaynak-katalogu.js';
import {
  type CozulmusSartOgesi,
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

export interface DerlenmeyenYetenek {
  readonly yetenekId: string;
  readonly neden: string;
}

export interface DerlemeSonucu {
  readonly yetenek: YetkiYetenegi;
  readonly kurallar: readonly YetenekKurali[];
  readonly derlenmeyenler: readonly DerlenmeyenYetenek[];
  // Yetenek kimliğinden onu kişiye veren üyeliğin kimliğine; erişim kaydı için (KR-010 Seçim 40).
  readonly uyelikler: Readonly<Record<string, string>>;
}

type SatirSonucu =
  { readonly kural: YetenekKurali } | { readonly neden: string } | null;

// Her yetenek satırını kimliğini taşıyan tek bir CASL kuralına derler; satırlar birleştirilmez
// (KR-010 Derleme eşlemesi). Kural üretmeyen satır kapalı düşer.
export function yetenekleriDerle(
  veri: Pick<KisininSatirlari, 'yetenekler' | 'altGruplar'>,
  isteyenId: string,
  katalog: KaynakKatalogu,
): Omit<DerlemeSonucu, 'uyelikler'> {
  const kurallar: YetenekKurali[] = [];
  const derlenmeyenler: DerlenmeyenYetenek[] = [];
  for (const satir of veri.yetenekler) {
    const sonuc = satiriDerle(satir, veri.altGruplar, isteyenId, katalog);
    if (sonuc === null) {
      continue;
    }
    if ('neden' in sonuc) {
      derlenmeyenler.push({ yetenekId: satir.yetenekId, neden: sonuc.neden });
    } else {
      kurallar.push(sonuc.kural);
    }
  }
  return {
    yetenek: createPrismaAbility<[string, string], YetkiKosulu>(kurallar),
    kurallar,
    derlenmeyenler,
  };
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
    return kolonYok ? null : { kural };
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
  return { kural: { ...kural, conditions: ceviri.kosul as YetkiKosulu } };
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
