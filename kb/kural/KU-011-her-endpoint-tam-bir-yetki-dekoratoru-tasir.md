---
kimlik: KU-011
tur: kural
durum: taslak
surum: 1
baslik: Her endpoint tam bir yetki dekoratörü taşır
dayanak: [KR-007@1]
kapsam: [backend/src/features/**/presentation/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: Controller endpoint'inde 3 yetki decorator'undan **TAM 1 tanesi** olmali (CTRL-01).
---
Her controller endpoint'i üç yetki dekoratöründen tam birini taşır: `@RequireAction`, `@CheckPolicies` ya da `@SkipPolicies`. `@SkipPolicies` yalnız `@Public` ile birlikte ve gerekçe yorumuyla kullanılır; kimlik gerektiren endpoint'te yetki denetimi atlanmaz.

## Neden
- İki dekoratör yan yana durursa hangisinin geçerli olduğu belirsizleşir (belge, satır 408).
- `@Public` kimlik katmanını, `@SkipPolicies` yetki katmanını kapatır; biri tek başına yazılırsa istek 401 ya da 403 alır (belge, satır 228–232).

## İhlal örneği
Belgeden: `@Public()` olmadan `@SkipPolicies()` (satır 243–246); `@RequireAction` ile `@CheckPolicies`'in aynı endpoint'te durması (satır 403–407).

## Uygun örnek
Belgeden: tek eylem için `@RequireAction(Action.CREATE, Resource.Yeni)` (satır 380); açık uç için `@Public()` ve `@SkipPolicies()` birlikte, gerekçe yorumuyla (satır 237–241).

## Alım notu
- Kaynak: Kural 3.3 / CASL-03 (satır 223–247) ve Kural 3.8 / CTRL-01 (satır 347–415).
- Dekoratör seçim tablosu (satır 378–398) kurala alınmadı; rehber olarak kaynakta durur.
- `Action` ve `Resource` değerlerinin sabitlerden verilmesi (satır 351–374) lint adayıdır, kurala alınmadı.
- Kapsam yolu varsayımdır; hedef denetim düzeyi mekaniktir.
