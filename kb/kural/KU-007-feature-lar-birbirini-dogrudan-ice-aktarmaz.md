---
kimlik: KU-007
tur: kural
durum: taslak
surum: 1
baslik: Feature'lar birbirini doğrudan içe aktarmaz
dayanak: [KR-005@1]
kapsam: [backend/src/features/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/ARCHITECTURE.md
alinti: Feature modulleri birbirini DOGRUDAN import EDEMEZ — `{feature}.module.ts` public exports dahil.
---
Bir feature başka bir feature'ın kodunu doğrudan içe aktarmaz; karşı modülün dış export'u da buna dahildir. Feature'lar arası iletişim shared üzerinden dört yoldan biriyle kurulur: shared arayüz sözleşmesi, ACL, outbox üzerinden domain event ya da saga.

## Neden
Belgede gerekçe yazmıyor (satır 809–844 yalnız kuralı ve dört yolu sayar); kullanıcıya sorulacak.

## İhlal örneği
Belgeden (satır 823): `randevu-sistemi` içinden `import { UserService } from '../identity/users/...'` ile identity'ye doğrudan erişmek.

## Uygun örnek
Belgeden (satır 840): arayüz `shared/<concern>/domain/i-*.contract.ts` altında tanımlanır, sahibi feature gerçekler, tüketen feature `@Inject(TOKEN)` ile alır.

## Alım notu
- Kaynak: Mimari Değişmez 1 (satır 809–844). Aynı kuralı MOD-01 (`IRON_RULES_BACKEND.md`), EVT-00 (`IRON_RULES_EVENTS.md`) ve Pattern 16 (`PATTERNS.md`) da söyler.
- Kapsam yolu varsayımdır; klasör düzeni kararıyla kesinleşir.
- Hedef denetim düzeyi mekaniktir (içe aktarma sınırı lint'i); lint kurulunca denetim düğümü açılıp düzey değiştirilir.
- Uyarlama notu (2026-11-23; kullanıcı teyidi): bu depoda kurala beş ek gelir (KR-005 "Feature'lar arası erişim"): tüketen feature sözleşmeye yalnız kendi `_shared/` klasöründeki ACL üzerinden ulaşır; başka feature'da yazma ya aynı işlemde (işlem nesnesi açıkça verilerek) ya da olayla yapılır; sözleşme düz veri taşır; her tablo tek feature'ındır; yetki şartındaki ilişki adımı aynı feature'da kalır. Kabulden önce uygun örnek buna göre yeniden yazılacak (kanondaki örnekte handler sözleşmeyi doğrudan enjekte eder) ve ekler için ayrı kural taslakları açılacak. "Neden" bölümünün cevabı da geldi (kullanıcı, 2026-11-23): mikroservis faz 2'dir ve yapı adım adım taşınacaktır.
