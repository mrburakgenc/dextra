import { z } from 'zod';
import type {
  Islec,
  SabitDeger,
  SartOgesi,
} from '../../kimlik/domain/i-yetki-verisi.contract.js';
import type { AlanTipi } from '../domain/alan-tipi.js';

// Yer tutucuları çözülmüş şart öğesi.
export interface CozulmusSartOgesi {
  readonly alan: string;
  readonly islec: Islec;
  readonly deger: SabitDeger | readonly SabitDeger[];
}

export type PrismaKosulu = Record<string, unknown>;

export type CeviriSonucu =
  { readonly kosul: PrismaKosulu } | { readonly neden: string };

// Tip sınamasının bulgusu: "uyumsuz", değeri alanın tipine uymayan öğedir; çağıranın koşulunda o değer
// istekten gelir ve okuma kapısı onu doğrulama hatasına çevirir. "neden", kodun yazdığı biçimin
// (işleç, alan, yer tutucu) hatasıdır.
export type TipBulgusu = { readonly neden: string } | { readonly uyumsuz: string };

const PRISMA_ISLECI: Record<Islec, string> = {
  esit: 'equals',
  esit_degil: 'not',
  listede: 'in',
  listede_degil: 'notIn',
  kucuk: 'lt',
  kucuk_esit: 'lte',
  buyuk: 'gt',
  buyuk_esit: 'gte',
};

// Her işlecin tümleyeni: öğeyi sağlamayan dolu değer (TS-008 "Derleme"; kapanan AU-5). Boş değer ayrı
// dalla tutulur; veritabanı istemcisinin genel "değil"i (NOT) boş değerli satırı düşürdüğü için
// kullanılmaz.
const TUMLEYEN_ISLEC: Record<Islec, string> = {
  esit: 'not',
  esit_degil: 'equals',
  listede: 'notIn',
  listede_degil: 'in',
  kucuk: 'gte',
  kucuk_esit: 'gt',
  buyuk: 'lte',
  buyuk_esit: 'lt',
};

const LISTE_ISLECLERI: readonly Islec[] = ['listede', 'listede_degil'];

// İşlecin yazılabildiği alan tipleri (TS-002 AK-44). Mantıksal alanda yalnız eşitlik vardır (Prisma'nın
// BoolFilter'ı in, notIn, lt, gt taşımaz); büyüklük yalnız sayı ve zamanda anlamlıdır; "obur" hiçbir
// işlece girmez.
const ESITLIK_TIPLERI: readonly AlanTipi[] = [
  'metin',
  'sayi',
  'mantiksal',
  'kimlik',
  'zaman',
];
const LISTE_TIPLERI: readonly AlanTipi[] = ['metin', 'sayi', 'kimlik', 'zaman'];
const BUYUKLUK_TIPLERI: readonly AlanTipi[] = ['sayi', 'zaman'];
const ISLEC_TIPLERI: Record<Islec, readonly AlanTipi[]> = {
  esit: ESITLIK_TIPLERI,
  esit_degil: ESITLIK_TIPLERI,
  listede: LISTE_TIPLERI,
  listede_degil: LISTE_TIPLERI,
  kucuk: BUYUKLUK_TIPLERI,
  kucuk_esit: BUYUKLUK_TIPLERI,
  buyuk: BUYUKLUK_TIPLERI,
  buyuk_esit: BUYUKLUK_TIPLERI,
};

// Kimlik tireli on altılık yazımdır (PostgreSQL uuid'nin kabul ettiklerinin alt kümesi). Zaman, saat
// dilimi taşıyan ISO 8601 tarih-saattir (RFC 3339'un alt kümesi); takvimde olmayan gün ve saat düşer,
// UTC'ye çevrilince 1-9999 yılları dışına düşen de (PostgreSQL 0 yılını kabul etmez). Sayı, şemadaki
// bütün sayı kolonları Int (PostgreSQL integer) olduğu için o aralıktaki tam sayıdır.
const KIMLIK_YAZIMI = z.guid();
const ZAMAN_YAZIMI = z.iso
  .datetime({ offset: true })
  .refine((yazim) => {
    const yil = new Date(yazim).getUTCFullYear();
    return yil >= 1 && yil <= 9999;
  });
const SAYI = z.int32();

function degerTipeUyar(
  deger: SabitDeger,
  tip: Exclude<AlanTipi, 'obur'>,
): boolean {
  switch (tip) {
    case 'metin':
      return typeof deger === 'string';
    case 'sayi':
      return SAYI.safeParse(deger).success;
    case 'mantiksal':
      return typeof deger === 'boolean';
    case 'kimlik':
      return KIMLIK_YAZIMI.safeParse(deger).success;
    case 'zaman':
      return ZAMAN_YAZIMI.safeParse(deger).success;
  }
}

// Şart öğesinin işlecini ve değerini alanın tipine karşı sınar (TS-002 AK-44); uyan öğe için
// undefined. Listeli işleç liste, tekil işleç tekil değer ister; listeli işleçte her öğe sınanır.
// Çağıranın koşulunda değer istekten gelir, bu yüzden biçim uyumsuzluğu da "uyumsuz"dur. Yer tutucuların üçü de kimliğe çözülür ve yalnız kimlik
// alanında yazılır. Bilinmeyen alan ve işleç burada sınanmaz; onları sartiCevir bildirir.
export function tipiSina(
  oge: SartOgesi,
  tipler: Readonly<Record<string, AlanTipi>>,
): TipBulgusu | undefined {
  const tip = Object.hasOwn(tipler, oge.alan) ? tipler[oge.alan] : undefined;
  if (tip === undefined || !Object.hasOwn(ISLEC_TIPLERI, oge.islec)) {
    return undefined;
  }
  if (tip === 'obur') {
    return { neden: `şartta kullanılamayan alan: ${oge.alan}` };
  }
  if (!ISLEC_TIPLERI[oge.islec].includes(tip)) {
    return { neden: `işleç alanın tipine uymuyor: ${oge.alan}` };
  }
  const deger = oge.deger;
  if (typeof deger === 'object' && 'yerTutucu' in deger) {
    return tip === 'kimlik'
      ? undefined
      : { neden: `yer tutucu alanın tipine uymuyor: ${oge.alan}` };
  }
  if (LISTE_ISLECLERI.includes(oge.islec) !== Array.isArray(deger)) {
    return { uyumsuz: `değerin biçimi işlece uymuyor: ${oge.alan}` };
  }
  const ogeler: readonly SabitDeger[] = Array.isArray(deger) ? deger : [deger];
  return ogeler.every((d) => degerTipeUyar(d, tip))
    ? undefined
    : { uyumsuz: `değer alanın tipine uymuyor: ${oge.alan}` };
}

// Şartı Prisma sorgu koşuluna çevirir; öğeler "ve" ile bağlanır.
// Yalnız kaydın kendi kolonuna bakan şart çevrilir; bilinmeyen alan ya da saklanan şartın dilinde
// olmayan işleç (değersiz işleçler dahil) şartı çevrilmez kılar.
export function sartiCevir(
  sart: readonly CozulmusSartOgesi[],
  alanlar: readonly string[],
): CeviriSonucu {
  const kosullar: PrismaKosulu[] = [];
  for (const oge of sart) {
    if (!alanlar.includes(oge.alan)) {
      return { neden: `bilinmeyen alan: ${oge.alan}` };
    }
    if (!Object.hasOwn(PRISMA_ISLECI, oge.islec)) {
      return { neden: `bilinmeyen işleç: ${oge.islec}` };
    }
    if (LISTE_ISLECLERI.includes(oge.islec) !== Array.isArray(oge.deger)) {
      return { neden: `işleç ile değerin biçimi uymuyor: ${oge.alan}` };
    }
    kosullar.push({ [oge.alan]: { [PRISMA_ISLECI[oge.islec]]: oge.deger } });
  }
  return { kosul: { AND: kosullar } };
}

// Yasağın sartiCevir'den geçmiş şartından "yasak bu kaydı kesin tutmuyor" koşulu (TS-008 "Derleme";
// kapanan AU-5): öğeler "ve" ile bağlı olduğu için her öğenin "sağlanmıyor ya da kolon boş" hâlinin
// "veya"sıdır. Boşluk dalı yalnız katalogda boş olabildiği yazılı kolona yazılır; bilinmeyen kolonda
// dal yazılmaz ve boş değerli kayıt yasaklı sayılır (önce kapatılır). Koşulsuz yasakta (boş şart)
// koşul hiçbir kaydı tutmaz: veritabanı istemcisi öğesiz "veya"yı (OR: []) ve öğesiz "değil"i koşulsuz
// sayıp bütün kayıtları getirir (ölçüldü: test/yetki-yasak-kosul.e2e-spec.ts); boş listede (in: [])
// ise hiçbir kaydı getirmez. Bu yüzden okuma kapısının kuralsız süzgeci gibi boş kimlik listesi yazılır.
export function kesinTutmuyorKosulu(
  sart: readonly CozulmusSartOgesi[],
  bosOlabilirlik: Readonly<Record<string, boolean>>,
): PrismaKosulu {
  if (sart.length === 0) {
    return { id: { in: [] } };
  }
  return {
    OR: sart.flatMap((oge) => {
      const tumleyen = {
        [oge.alan]: { [TUMLEYEN_ISLEC[oge.islec]]: oge.deger },
      };
      return bosOlabilirlik[oge.alan] === true
        ? [tumleyen, { [oge.alan]: { equals: null } }]
        : [tumleyen];
    }),
  };
}
