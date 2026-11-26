import type {
  Teshis,
  TeshisKarari,
  TeshisKurali,
} from '../domain/okuma-tipleri.js';
import {
  type DerlemeSonucu,
  type DerlenmisKural,
  uygulananYasaklar,
} from './yetenek-derleyici.js';

const OKUMA_EYLEMI = 'oku';
const KIMLIK_KOLONU = 'id';
// Bileşimleri hesaplanan en çok değerlendirilemeyen kural sayısı (2^8 bileşim).
const BILESIM_SINIRI = 8;

// Bir kişinin bir eylem ve kaynaktaki kuralları (izinler ve yasaklar), derlendikleri sırayla.
export function teshisKurallari(
  yetki: Pick<DerlemeSonucu, 'butunKurallar'>,
  kaynak: string,
  eylem: string,
): readonly DerlenmisKural[] {
  return yetki.butunKurallar.filter(
    (k) => k.subject === kaynak && k.action === eylem,
  );
}

// Teşhisin kararı (TS-008 "Tanım", "Muafiyetler" ve "Okuma"; KU-017, KU-018). tutanlar, kişinin o eylem
// ve kaynaktaki kurallarından kaydı tuttuğunu veritabanının söyledikleridir (yasakta "kesin tutar");
// karar bellekte şart değerlendirmez. İzne uygulanan yasaklar motorunkilerdir (uygulananYasaklar): muaf
// izne hiçbiri, öbürüne ondan düşük öncelikli olmayanlar. Kolon, onu veren ve kaydı tutan bir izin,
// ona uygulanıp kaydı tutan bir yasakla o kolonda (kolon listesi olmayan yasak bütün kolonlarda)
// kapatılmamışsa açıktır. Okumada yasak uygulanan izin, kimlikten başka kolonu kalmadığı kayıtta kaydı
// vermez. Açık kolonun kararını, açan izinlerden önce muaf olan, sonra önceliği en yüksek olan verir;
// kapalı kolonun kararını, onu veren izinlerin önceliği en yüksek olanını kapatan yasaklardan önceliği
// en yüksek olan verir. Eşitlikte derlenme sırasıyla önce gelen (en eski) seçilir. Kimlik kolonunu
// kolon yasağı kapatamaz; onun kararı kaydın kararıdır.
//
// degerlendirilemeyenler, şartı soranın o kayıtta göremediği kolona baktığı için veritabanına
// sorulmayan kurallardır. Karar, onların her tutma bileşiminde ayrı ayrı verilir: bütün bileşimlerde
// aynı olan karar kesindir; değişen karar belirsizdir ve kararVeren, tutup tutmaması o kararı
// değiştirebilen ilk (derlenme sırasıyla) değerlendirilemeyen kuraldır. Böylece cevap gizli kolonun
// değerinden bağımsızdır. Bileşim sayısı değerlendirilemeyen kural sayısının ikinin kuvvetidir:
// sayı BILESIM_SINIRI'nı aşarsa bileşimler hesaplanmaz (kullanıcının kararı, 2026-11-26); bir
// değerlendirilemeyen kuralın etkileyebileceği her karar belirsizdir ve kararVeren, onu etkileyebilen
// ilk değerlendirilemeyen kuraldır. Kolonun kararını, kolonu veren izinler ve onlara uygulanan yasaklar
// etkileyebilir; öbür kararlar yalnız tutanlarla verilir.
export function teshisKarari(
  yetki: Pick<DerlemeSonucu, 'butunKurallar' | 'bozukYasaklar'>,
  kaynak: string,
  eylem: string,
  alanlar: readonly string[],
  tutanlar: readonly DerlenmisKural[],
  degerlendirilemeyenler: readonly DerlenmisKural[],
): Teshis {
  const sira = teshisKurallari(yetki, kaynak, eylem);
  const sinirli = degerlendirilemeyenler.length > BILESIM_SINIRI;
  // Bileşimin i. biti, i. değerlendirilemeyen kuralın tuttuğu bileşimdir; sınır aşılınca yalnız
  // tutanların bileşimi hesaplanır.
  const bilesimler = Array.from(
    { length: sinirli ? 1 : 2 ** degerlendirilemeyenler.length },
    (_, maske) => {
      const tutar = new Set([
        ...tutanlar,
        ...degerlendirilemeyenler.filter((_k, i) => (maske >> i) & 1),
      ]);
      return kesinKararlar(
        yetki,
        kaynak,
        eylem,
        alanlar,
        sira.filter((k) => tutar.has(k)),
      );
    },
  );
  const esit = (a?: TeshisKarari, b?: TeshisKarari): boolean =>
    a?.acik === b?.acik && a?.kararVeren === b?.kararVeren;
  const yasaklari = uygulananYasaklar(yetki, kaynak, eylem);
  const kolonlar = [...alanlar, KIMLIK_KOLONU];
  const karar = (no: number): TeshisKarari => {
    const [ilk] = bilesimler;
    const kesin = ilk?.[no];
    if (sinirli) {
      const kolon = kolonlar[no] ?? KIMLIK_KOLONU;
      const etkileyen = degerlendirilemeyenler.find((k) =>
        sira.some(
          (izin) =>
            !izin.giremez &&
            verir(izin, kolon) &&
            (izin === k || yasaklari(izin).includes(k)),
        ),
      );
      return etkileyen === undefined && kesin !== undefined
        ? kesin
        : { acik: null, kararVeren: etkileyen?.yetenekId ?? null };
    }
    if (kesin !== undefined && bilesimler.every((b) => esit(b[no], kesin))) {
      return kesin;
    }
    const bagli = degerlendirilemeyenler.find((_k, i) =>
      bilesimler.some(
        (b, maske) =>
          !((maske >> i) & 1) &&
          !esit(b[no], bilesimler[maske | (1 << i)]?.[no]),
      ),
    );
    return { acik: null, kararVeren: bagli?.yetenekId ?? null };
  };

  const bozuklar = new Set(yetki.bozukYasaklar.map((b) => b.yetenekId));
  const belirsizler = new Set(degerlendirilemeyenler);
  return {
    tutanKurallar: sira
      .filter((k) => tutanlar.includes(k) || belirsizler.has(k))
      .map((k): TeshisKurali => ({
        yetenekId: k.yetenekId,
        etki: k.giremez ? 'yasak' : 'izin',
        oncelik: k.oncelik,
        butunKolonlar: k.fields === undefined,
        kolonlar: k.fields === undefined ? [] : [k.fields].flat(),
        muaf: k.yasaktanMuaf,
        bozuk: bozuklar.has(k.yetenekId),
        degerlendirilemedi: belirsizler.has(k),
      })),
    kolonKararlari: alanlar.map((kolon, no) => ({ kolon, ...karar(no) })),
    kayitKarari: karar(alanlar.length),
  };
}

// Kaydı tuttuğu bilinen kurallarla karar: alanların her biri için, sonda kimlik kolonu (kaydın kararı).
function kesinKararlar(
  yetki: Pick<DerlemeSonucu, 'butunKurallar'>,
  kaynak: string,
  eylem: string,
  alanlar: readonly string[],
  tutanlar: readonly DerlenmisKural[],
): TeshisKarari[] {
  const yasaklari = uygulananYasaklar(yetki, kaynak, eylem);
  const tutar = new Set(tutanlar);
  const izinler = tutanlar.filter((k) => !k.giremez);
  const kapatanlar = (izin: DerlenmisKural, kolon: string): DerlenmisKural[] =>
    oncelikSirasi(
      yasaklari(izin).filter(
        (y) =>
          tutar.has(y) &&
          (y.fields === undefined || [y.fields].flat().includes(kolon)),
      ),
    );
  const digerKolonlari = (izin: DerlenmisKural): string[] =>
    alanlar.filter((k) => k !== KIMLIK_KOLONU && verir(izin, k));
  const bosKalir = (izin: DerlenmisKural): boolean =>
    eylem === OKUMA_EYLEMI &&
    yasaklari(izin).length > 0 &&
    digerKolonlari(izin).every((k) => kapatanlar(izin, k).length > 0);

  const karar = (kolon: string): TeshisKarari => {
    const verenler = izinler.filter((izin) => verir(izin, kolon));
    const [acan] = verenler
      .filter((izin) => kapatanlar(izin, kolon).length === 0 && !bosKalir(izin))
      .sort(
        (a, b) =>
          Number(b.yasaktanMuaf) - Number(a.yasaktanMuaf) ||
          b.oncelik - a.oncelik,
      );
    if (acan !== undefined) {
      return { acik: true, kararVeren: acan.yetenekId };
    }
    const [ilk] = oncelikSirasi(verenler);
    if (ilk === undefined) {
      return { acik: false, kararVeren: null };
    }
    // Kolonu kapatan yasak yoksa izin, kimlikten başka bütün kolonları kapandığı için kaydı vermez.
    const kolondakiler = kapatanlar(ilk, kolon);
    const [kapatan] =
      kolondakiler.length > 0
        ? kolondakiler
        : oncelikSirasi(
            yasaklari(ilk).filter((y) =>
              digerKolonlari(ilk).some((k) => kapatanlar(ilk, k).includes(y)),
            ),
          );
    return { acik: false, kararVeren: kapatan?.yetenekId ?? null };
  };

  return [...alanlar, KIMLIK_KOLONU].map(karar);
}

// İzin kolonu verir mi: kimlik kolonunu her izin verir.
function verir(izin: DerlenmisKural, kolon: string): boolean {
  return (
    kolon === KIMLIK_KOLONU ||
    izin.fields === undefined ||
    [izin.fields].flat().includes(kolon)
  );
}

// Önceliği büyükten küçüğe; eşitlikte verilen sıra korunur.
function oncelikSirasi(kurallar: readonly DerlenmisKural[]): DerlenmisKural[] {
  return [...kurallar].sort((a, b) => b.oncelik - a.oncelik);
}
