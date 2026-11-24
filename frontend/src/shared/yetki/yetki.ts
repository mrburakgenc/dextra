import { subject } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma/runtime';

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

export function yetkiKur(kurallar: readonly YetkiKurali[]) {
  return createPrismaAbility(
    kurallar.map((kural) => ({
      action: kural.action,
      subject: kural.subject,
      ...(kural.conditions === undefined ? {} : { conditions: kural.conditions }),
      ...(kural.fields === undefined ? {} : { fields: [...kural.fields] }),
    })),
  );
}

export type Yetki = ReturnType<typeof yetkiKur>;

// Kayıt düzeyindeki soru için kaydın bir kopyası türüyle etiketlenir; asıl kayıt değişmez.
// Etiket sunucudan istemciye geçerken korunmaz: kayıt istemci bileşeninde etiketlenir.
export function kaydiEtiketle<T extends object>(tur: string, kayit: T) {
  return subject(tur, { ...kayit });
}
