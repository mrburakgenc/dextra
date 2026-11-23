---
kimlik: KU-010
tur: kural
durum: taslak
surum: 1
baslik: Guard zincirinin sırası sabittir
dayanak: [KR-007@1]
kapsam: [backend/src/app.module.ts, backend/src/shared/security/**, backend/src/shared/authorization/**, backend/src/features/**/presentation/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: Bu sira **ASLA** degistirilemez. Yeni guard eklenecekse PoliciesGuard'dan ONCE olmali.
---
Global guard zincirinin sırası sabittir: hız sınırı (SmartThrottlerGuard), origin (OriginGuard), kimlik (JwtGuard), yetki (PoliciesGuard). Sıra değiştirilmez; yeni guard yalnız PoliciesGuard'dan önce eklenir.

## Neden
Belgedeki gerekçe (satır 152–157): hız sınırı yetkisiz isteğin de taşkınını keser; origin doğrulaması kimlikten önce yapılır; kimlik "kim" sorusunu, yetki en sonda "ne yapabilir" sorusunu cevaplar.

## İhlal örneği
Belgeden (satır 161): `@UseGuards(JwtGuard, SmartThrottlerGuard, PoliciesGuard)` ile sırayı controller'da yeniden kurmak.

## Uygun örnek
Belgeden (satır 163–165): sıra kök modülde global tanımlıdır; yeni guard JwtGuard ile PoliciesGuard arasına eklenir.

## Alım notu
- Kaynak: Kural 2 / GUARD-01 (satır 142–166); aynı sırayı Mimari Değişmez 5 (`ARCHITECTURE.md`) de söyler.
- Modüle özel guard yazılmaz; o yükümlülük KU-009'dadır.
- Kapsam yolu varsayımdır.
