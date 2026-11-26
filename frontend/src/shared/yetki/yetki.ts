import {
  Ability,
  fieldPatternMatcher,
  type MatchConditions,
  subject,
} from '@casl/ability';
import { prismaQuery } from '@casl/prisma/runtime';

// Yetki kurallarının ekrandaki karşılığı (TS-004 "Yetki kurallarının ekrana taşınması"; KR-010
// Seçim 37 ve 38): koşul backend'in sorguda kullandığı Prisma biçimindedir ve aynı kitaplıkla
// değerlendirilir. Yorumlayıcı paketin veritabanı istemcisi istemeyen girişinden alınır.
// Ekran yalnız neyin gösterileceğine karar verir; son sözü backend söyler.

// "yetkilerim" ucunun döndürdüğü kuralın ekranın okuduğu kısmı.
export interface YetkiKurali {
  readonly action: string;
  readonly subject: string;
  readonly conditions?: Record<string, unknown> | undefined;
  readonly fields?: readonly string[] | undefined;
  // Ters kural yasaktır (TS-008 "Ekran"); yalnız yasağı olan kişinin cevabında gelir.
  readonly inverted?: boolean | undefined;
}

// Güvenli taraf (TS-004 "Yönetim ekranları"): yorumlayıcının çözümleyemediği koşul (tanımadığı
// işleç gibi) ya da kayıtta değerlendirilirken hata veren koşul fırlatmaz, "tutmadı" sayılır.
// Bu eşleyici yalnız izin kurallarınındır: izinde "tutmadı" her zaman "hayır"a çıkar.
function guvenliKosul(kosul: Record<string, unknown>): MatchConditions {
  let eslestir: ReturnType<typeof prismaQuery>;
  try {
    eslestir = prismaQuery(kosul);
  } catch {
    return () => false;
  }
  return (kayit) => {
    try {
      return Boolean(eslestir(kayit));
    } catch {
      return false;
    }
  };
}

// Şartın baktığı kolonlar: "ve" listesinin öğelerine inilir, öbür anahtarlar kolondur. Sunucunun
// yasak şartı kolon öğelerinin "ve"sidir (TS-008 "Derleme"); başka bir biçimin anahtarı kayıtta
// kolon olarak bulunmadığı için o yasak tutuyor sayılır.
function sartKolonlari(kosul: Record<string, unknown>): string[] {
  return Object.entries(kosul).flatMap(([anahtar, deger]) =>
    anahtar === 'AND' && Array.isArray(deger)
      ? (deger as Record<string, unknown>[]).flatMap(sartKolonlari)
      : [anahtar],
  );
}

// Yasakların (ters kuralların) eşleyicisi (TS-008 "Ekran"; kapanan AU-6 ve AU-28): ekran emin
// olamadığını gizler. Yorumlayıcının çözümleyemediği koşul, şartın baktığı bir kolonu kayıtta
// olmayan kayıt ve kayıtta değerlendirilirken hata veren koşul "tutuyor" sayılır. Şartın baktığı
// bir kolonu gelmiş ama boş olan kayıt sunucudaki gibi "tutmuyor" sayılır: sunucuda boş değerli
// öğe yasağı kesin tutmaz; kurulu yorumlayıcı ise not, notIn, lt ve lte işleçlerinde boş değeri
// "tutuyor" sayar.
function yasakKosulu(kosul: Record<string, unknown>): MatchConditions {
  let eslestir: ReturnType<typeof prismaQuery>;
  try {
    eslestir = prismaQuery(kosul);
  } catch {
    return () => true;
  }
  const kolonlar = sartKolonlari(kosul);
  return (kayit) => {
    if (kolonlar.some((kolon) => kayit[kolon] === undefined)) {
      return true;
    }
    if (kolonlar.some((kolon) => kayit[kolon] === null)) {
      return false;
    }
    try {
      return Boolean(eslestir(kayit));
    } catch {
      return true;
    }
  };
}

// createPrismaAbility'nin kurduğu nesnenin aynısıdır (aynı yorumlayıcı ve kolon eşleyici);
// yalnız koşul eşleyicisi güvenli sarmalayıcıdan geçer. createPrismaAbility eşleyicinin
// değiştirilmesine izin vermediği için yetki doğrudan kurulur.
// Kurallar verildiği sırayla kurulur: sıra sunucunun kararıdır, son eşleşen kural kazanır (TS-008
// "Ekran"). Kitaplık eşleyiciye yalnız koşulu verdiği için yasakların koşulu kopyalanıp işaretlenir.
export function yetkiKur(kurallar: readonly YetkiKurali[]) {
  const yasakKosullari = new WeakSet<object>();
  return new Ability(
    kurallar.map((kural) => {
      let conditions = kural.conditions;
      if (kural.inverted === true && conditions !== undefined) {
        conditions = { ...conditions };
        yasakKosullari.add(conditions);
      }
      return {
        action: kural.action,
        subject: kural.subject,
        ...(conditions === undefined ? {} : { conditions }),
        ...(kural.fields === undefined ? {} : { fields: [...kural.fields] }),
        ...(kural.inverted === true ? { inverted: true } : {}),
      };
    }),
    {
      conditionsMatcher: (kosul: Record<string, unknown>) =>
        yasakKosullari.has(kosul) ? yasakKosulu(kosul) : guvenliKosul(kosul),
      fieldMatcher: fieldPatternMatcher,
    },
  );
}

export type Yetki = ReturnType<typeof yetkiKur>;

// Liste tablosunun kolonu çizilir mi (TS-004 "Yönetim ekranları"): kişi kaynağın kolonunu tür
// düzeyinde okuyabiliyor mu; tür düzeyindeki soru şartı değerlendirmez. Birden çok alandan türeyen
// kolon, alanlarından biri okunabiliyorsa çizilir.
export function kolonCizilir(yetki: Yetki, kaynak: string, alanlar: readonly string[]): boolean {
  return alanlar.some((alan) => yetki.can('oku', kaynak, alan));
}

// Kayıt düzeyindeki soru için kaydın bir kopyası türüyle etiketlenir; asıl kayıt değişmez.
// Etiket sunucudan istemciye geçerken korunmaz: kayıt istemci bileşeninde etiketlenir.
export function kaydiEtiketle<T extends object>(tur: string, kayit: T) {
  return subject(tur, { ...kayit });
}
