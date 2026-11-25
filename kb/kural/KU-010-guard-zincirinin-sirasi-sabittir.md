---
kimlik: KU-010
tur: kural
durum: kabul
surum: 1
baslik: Guard zincirinin sırası sabittir
dayanak: [KR-007@1]
kapsam: [backend/src/app.module.ts, backend/src/shared/guvenlik/**, backend/src/shared/yetki/**, backend/src/features/**/presentation/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: Bu sira **ASLA** degistirilemez. Yeni guard eklenecekse PoliciesGuard'dan ONCE olmali.
---
Global guard zincirinin sırası sabittir: önce kimlik (KimlikGuard), sonra yetki (YetkiGuard). Sıra değiştirilmez; yeni guard yalnız yetki guard'ından önce eklenir ve kök modülde global bağlanır; denetleyicide guard sırası yeniden kurulmaz.

## Neden
Kanondaki gerekçe (`IRON_RULES_BACKEND.md` satır 152–157): kimlik "kim" sorusunu, yetki en sonda "ne yapabilir" sorusunu cevaplar; yetki guard'ı kimliği doğrulanmış oturuma ihtiyaç duyar.

## İhlal örneği
Kanondan (satır 161): `@UseGuards(...)` ile sırayı denetleyicide yeniden kurmak. Bu depoda karşılığı: bir denetleyicide ya da feature modülünde guard bağlamak, ya da `backend/src/app.module.ts` içinde yetki guard'ını kimlik guard'ından önce yazmak.

## Uygun örnek
`backend/src/app.module.ts`: iki guard kök modülde global bağlıdır ve sırası kimlik, sonra yetkidir (2026-11-25'te ölçüldü). Guard'lar ortak kodda durur: `shared/guvenlik` (kimlik) ve `shared/yetki` (yetki).

## Alım notu
- Kaynak: Kural 2 / GUARD-01 (`IRON_RULES_BACKEND.md` satır 142–166); aynı sırayı Mimari Değişmez 5 (`ARCHITECTURE.md`) de söyler.
- Kanondaki zincir dört guard'dır: hız sınırı, origin, kimlik, yetki. Bu depoda ilk ikisi yoktur (aşağıdaki açık uç).
- Modüle özel guard yazılmaz; o yükümlülük KU-009'dadır.

## Açık uçlar
- AU-1: Hız sınırı (deneme sınırı) ve origin guard'ı bu depoda yok. Eklenecek mi, ne zaman; eklendiğinde kanondaki sırayla (kimlikten önce) mı girer?
- AU-2: Sıranın makineyle denetimi yok (açılışta ya da testte sınanmıyor); istenirse açılış denetimine eklenir.
