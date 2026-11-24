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
}

// Güvenli taraf (TS-004 "Yönetim ekranları"): yorumlayıcının çözümleyemediği koşul (tanımadığı
// işleç gibi) ya da kayıtta değerlendirilirken hata veren koşul fırlatmaz, "tutmadı" sayılır.
// Kurallarda ters kural (inverted) olmadığı için "tutmadı" her zaman "hayır"a çıkar.
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

// createPrismaAbility'nin kurduğu nesnenin aynısıdır (aynı yorumlayıcı ve kolon eşleyici);
// yalnız koşul eşleyicisi güvenli sarmalayıcıdan geçer. createPrismaAbility eşleyicinin
// değiştirilmesine izin vermediği için yetki doğrudan kurulur.
export function yetkiKur(kurallar: readonly YetkiKurali[]) {
  return new Ability(
    kurallar.map((kural) => ({
      action: kural.action,
      subject: kural.subject,
      ...(kural.conditions === undefined ? {} : { conditions: kural.conditions }),
      ...(kural.fields === undefined ? {} : { fields: [...kural.fields] }),
    })),
    { conditionsMatcher: guvenliKosul, fieldMatcher: fieldPatternMatcher },
  );
}

export type Yetki = ReturnType<typeof yetkiKur>;

// Kayıt düzeyindeki soru için kaydın bir kopyası türüyle etiketlenir; asıl kayıt değişmez.
// Etiket sunucudan istemciye geçerken korunmaz: kayıt istemci bileşeninde etiketlenir.
export function kaydiEtiketle<T extends object>(tur: string, kayit: T) {
  return subject(tur, { ...kayit });
}
