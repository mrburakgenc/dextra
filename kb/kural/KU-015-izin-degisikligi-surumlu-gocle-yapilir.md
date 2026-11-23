---
kimlik: KU-015
tur: kural
durum: taslak
surum: 1
baslik: İzin değişikliği sürümlü göçle yapılır
dayanak: [KR-007@1]
kapsam: [backend/prisma/seeds/permissions/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: Permission seed degisikligi = **schema migration gibi versionlanir**. Bir kerelik script YASAK; uygulanan migration'lar `PermissionMigrationLog` tablosunda tutulur.
---
Kodla gelen izin verisindeki (katalog tabloları ve başlangıç tohumu) her değişiklik şema göçü gibi sürümlenir: tek seferlik betik yazılmaz, her göç geri alma adımı taşır ve uygulanan göçler kayıt tablosunda tutulur. Kurum verisi (grup, rol, üyelik, yetenek) çalışma anında da yazılabilir.

## Neden
Belgede açık gerekçe yazmıyor; yalnız işleyişi anlatır (satır 1887–1890): göçler sırayla koşar, kayıt tablosu aynı göçün yeniden uygulanmasını önler, ardından ability önbelleği geçersiz kılınır. Kullanıcıya sorulacak.

## İhlal örneği
Belgeden (satır 1850): izin verisini bir kerelik betikle değiştirmek.

## Uygun örnek
Belgeden (satır 1854–1884): tarihle adlandırılmış göç dosyası; içinde `up` ve `down` adımları.

## Alım notu
- Kaynak: Kural 18.4 / CASL-10 (satır 1848–1890).
- Uyarlama notu (2026-11-23; ikinci çürütme turu 55. bulgu): kabulden önce dört nokta yazılacak. (1) "Her göç geri alma adımı taşır" cümlesi değişmez yetenek satırında yeniden tanımlanmalı: geri alma da eskiyi pasife çekip yenisini yazmaktır ve yöneticinin satırına çarparsa durur (KR-008 Seçim 7 ve 16). (2) Göç yetki sürümünü artırır (KR-010); kanondaki "ardından önbellek boşaltılır" adımının karşılığı budur. (3) Base tohumu ile proje tohumu aynı tabloya yazar; tohum anahtarları için ad alanı gerekir (KR-008 Seçim 16 ve 28). (4) Başlık hâlâ eski geniş hâldedir ("izin değişikliği"); cümle daraltılmıştı.
- Açık (kural cümlesi): cümledeki "her değişiklik" alıntıdan geniştir; belge yalnız "seed değişikliği" der. Kullanıcı 2026-11-22'de kurum verisinin çalışma anında da yazılmasını seçti (TS-001 "Veri modeli"); cümle buna göre "kodla gelen izin verisi" diye daraltıldı. Başlık eski geniş hâliyle duruyor; kabulden önce gözden geçirilecek.
- Kapsam yolu belgedeki klasördür (`backend/prisma/seeds/permissions/migrations/`, satır 1852); bu depoda kesinleşmedi, varsayımdır.
