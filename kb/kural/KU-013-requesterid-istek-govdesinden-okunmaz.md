---
kimlik: KU-013
tur: kural
durum: taslak
surum: 1
baslik: requesterId istek gövdesinden okunmaz
dayanak: [KR-007@1]
kapsam: [backend/src/features/**/application/**, backend/src/features/**/presentation/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: `requesterId` body'den ASLA okunmaz, `@IsEmpty()` ile reddedilir
---
İsteği yapanın kimliği istek gövdesinden, sorgusundan ya da yolundan okunmaz: kimlik guard'ının doğruladığı oturumdan, istek bağlamından alınır. Komut ve sorgu şemaları isteği yapanı gösteren alan taşımaz.

## Neden
Kanondaki gerekçe (`IRON_RULES_BACKEND.md` satır 1143): alan gövdeden okunursa saldırgan kendi seçtiği kimliği gönderebilir.

## İhlal örneği
Komut şemasında `isteyenId` ya da `requesterId` alanı; işleyicinin "kim adına" bilgisini komuttan okuması.

## Uygun örnek
İşleyici isteği yapanı `istekBaglami().oturum` üzerinden okur (`backend/src/shared/observability/istek-baglami/istek-baglami.ts`); oturumu kimlik guard'ı doğrular ve bağlama yalnız o yazar. Ölçüm (2026-11-25): komut ve sorgu dosyalarında isteği yapanı gösteren alan yok (arama sonucu 0).

## Alım notu
- Kaynak: Kural 5.5 / SEC-10, SEC-11 (`IRON_RULES_BACKEND.md` satır 1127–1165).
- Kanondaki düzenek (taban komut sınıfı, gövdede alanı reddeden doğrulama, değeri yazan global interceptor) bu depoda yoktur: komut ve sorgu için taban sınıf yoktur (TS-005) ve kimlik komuta hiç yazılmaz. İstek bağlamı ajan kararıdır (TS-002 AK-11 ve AK-12); bu kuralın kabulü o seçimi de teyit eder.
- Başlıktaki `requesterId` kanondaki addır; bu depoda karşılığı istek bağlamındaki oturumdur.

## Açık uçlar
- AU-1: Bu kuralın makineyle denetimi yok (şemalarda yasak alan adı araması yapı denetimine eklenebilir); istenecek mi?
- AU-2: Bir kullanıcı adına işlem (vekâlet, devir) gerektiğinde "kim adına" bilgisinin nereden geleceği tanımlı değil (KR-008: devir eylemi ertelendi).
