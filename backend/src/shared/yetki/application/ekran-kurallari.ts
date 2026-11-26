import type {
  DerlemeSonucu,
  DerlenmisKural,
  YetenekKurali,
} from './yetenek-derleyici.js';

// Ekrana ("yetkilerim") verilen kurallar (TS-008 "Ekran", Değişmez 1; KU-018). Yasağı olmayan kişide
// izin kuralları derlendiği sırayla ve hâliyle döner. Yasağı olan kişide bütün kurallar artan
// öncelikle, aynı öncelikte izinler önce yasaklar sonra, muaf izinler en sonda verilir; yasak ters
// kuraldır (inverted) ve koşulu yasağın kendi şartıdır. Ekranın kitaplığında sonra gelen kural
// öncekini ezdiği için bu sıra tanımla aynı kararı verir. Öncelik, etki ve muafiyet cevaba girmez;
// bozuk yasak derlendiği hâliyle (koşulsuz, bütün kolonlu) gider.
export function ekranKurallari(
  yetki: Pick<DerlemeSonucu, 'kurallar' | 'butunKurallar'>,
): readonly YetenekKurali[] {
  if (!yetki.butunKurallar.some((kural) => kural.giremez)) {
    return yetki.kurallar;
  }
  const muaf = (kural: DerlenmisKural) => !kural.giremez && kural.yasaktanMuaf;
  return [...yetki.butunKurallar]
    .sort(
      (a, b) =>
        Number(muaf(a)) - Number(muaf(b)) ||
        a.oncelik - b.oncelik ||
        Number(a.giremez) - Number(b.giremez),
    )
    .map((kural) => ({
      yetenekId: kural.yetenekId,
      action: kural.action,
      subject: kural.subject,
      ...(kural.fields === undefined ? {} : { fields: kural.fields }),
      ...(kural.conditions === undefined
        ? {}
        : { conditions: kural.conditions }),
      ...(kural.giremez ? { inverted: true } : {}),
    }));
}
