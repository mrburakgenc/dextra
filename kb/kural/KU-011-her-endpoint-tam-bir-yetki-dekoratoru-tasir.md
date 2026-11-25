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
Her uç üç yetki işaretinden tam birini taşır: `@Izin(kaynak, eylem)`, `@YalnizKendisi()` ya da `@HerkeseAcik()`. `@HerkeseAcik()` yalnız oturum istemeyen uçta kullanılır; oturum gerektiren uçta yetki denetimi atlanmaz.

## Neden
- İki işaret yan yana durursa hangisinin geçerli olduğu belirsizleşir; işaretsiz uç ise korumasız kalır (kanon, `IRON_RULES_BACKEND.md` satır 408 ve 228–232).
- Bu depodaki üç işaret kullanıcı seçimidir (KR-008 Seçim 46): herkese açık (oturum istenmez), yalnız kendisi (oturum gerekir, yetenek aranmaz), izin (oturum ve yetenek gerekir).

## İhlal örneği
Bir denetleyici metodunun işaretsiz olması ya da iki işaret taşıması (örnek: `@Izin('Rol', 'oku')` ile `@YalnizKendisi()` birlikte).

## Uygun örnek
`backend/src/features/kimlik/rol/presentation/rol.controller.ts`: altı ucun her biri tek bir `@Izin(...)` taşır. İşaretler `backend/src/shared/guvenlik/application/isaretler.ts` içindedir. Ölçüm (2026-11-25): denetleyicilerde 31 `@Izin`, 3 `@YalnizKendisi`, 4 `@HerkeseAcik` (giriş, oturum yenileme, parola belirleme, sağlık ucu).

## Bu depodaki denetim
Açılış denetimi (`backend/src/shared/guvenlik/infrastructure/isaret-denetimi.ts`) uygulama açılırken her ucu sınar; işareti olmayan ya da birden çok işaret taşıyan uç varsa uygulama açılmaz. Bu denetim henüz bir denetim düğümüne bağlanmadı.

## Alım notu
- Kaynak: Kural 3.3 / CASL-03 ve Kural 3.8 / CTRL-01 (`IRON_RULES_BACKEND.md` satır 223–247, 347–415). Kanondaki adlar `@RequireAction`, `@CheckPolicies`, `@SkipPolicies` ve `@Public`'tir; bu depodaki karşılıkları yukarıdaki üç işarettir. Kanondaki özel politika işareti (`@CheckPolicies`) bu depoda yoktur.
- Kanon, herkese açık uçta gerekçe yorumu ister; bu depoda dört açık ucun yorumu ayrıca ölçülmedi.

## Açık uçlar
- AU-1: Kaynak ve eylem adları işaretlere düz metin olarak yazılıyor (`@Izin('Rol', 'oku')`); kanon bunların sabitlerden verilmesini ister (satır 351–374). Sabit listesi ve lint istenecek mi?
- AU-2: Açılış denetiminin bir denetim düğümüne bağlanıp kuralın mekanik düzeye çekilmesi.
