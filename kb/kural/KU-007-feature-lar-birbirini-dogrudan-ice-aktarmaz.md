---
kimlik: KU-007
tur: kural
durum: kabul
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
Kullanıcı (2026-11-21; KR-005 "Seçim"): özellikler birbirini bozmadan ayrı ayrı geliştirilsin. Kanon belgesi gerekçe yazmaz (`ARCHITECTURE.md` satır 809–844 yalnız kuralı ve dört yolu sayar).

## İhlal örneği
Kanondan (satır 823): `randevu-sistemi` içinden `import { UserService } from '../identity/users/...'` ile başka feature'a doğrudan erişmek. Bu depoda karşılığı: `backend/src/features/<a>/` altındaki bir dosyanın `backend/src/features/<b>/` altından içe aktarması.

## Uygun örnek
Sözleşme ortak kodda durur, sahibi feature gerçekler: `backend/src/shared/kimlik/domain/i-oturum-denetimi.contract.ts` ve `i-yetki-verisi.contract.ts` arayüzlerini `kimlik` feature'ı gerçekler; kök modül belirteçle bağlar (`backend/src/app.module.ts`).

## Bu depodaki denetim
Lint sınırı kuruludur (`backend/eslint.config.mjs`, eslint-plugin-boundaries): feature yalnız ortak kodu ve kendi içini içe aktarabilir; ortak kod yalnız ortak kodu içe aktarır. `pnpm -C backend lint` ihlalde kırmızıdır (2026-11-25'te ölçüldü: 0 ihlal). Bu denetim henüz bir denetim düğümüne bağlanmadı; kuralın denetim düzeyi o zamana kadar gözden geçirmedir.

## Alım notu
- Kaynak: Mimari Değişmez 1 (`ARCHITECTURE.md` satır 809–844). Aynı kuralı MOD-01 (`IRON_RULES_BACKEND.md`), EVT-00 (`IRON_RULES_EVENTS.md`) ve Pattern 16 (`PATTERNS.md`) da söyler.
- Bu depodaki ekler KR-005 "Feature'lar arası erişim" bloğundadır (Kural 3–7; kullanıcı teyidi 2026-11-23): tüketen feature sözleşmeye kendi `_shared/` klasöründeki ACL üzerinden ulaşır; başka feature'da yazma aynı işlemde ya da olayla yapılır; sözleşme düz veri taşır; her tablo tek feature'ındır.

## Açık uçlar
- AU-1: Bu depoda bugün tek feature vardır (`kimlik`); feature ACL'i kalıbı (KR-005 Kural 7) hiç uygulanmadı. İkinci feature geldiğinde kalıbın ilk örneği ve bu kuralın uygun örneği yeniden yazılır.
- AU-2: Lint sınırının bir denetim düğümüne bağlanıp kuralın mekanik düzeye çekilmesi (push kapısında lint koşsun mu; süresi ölçülmedi).
