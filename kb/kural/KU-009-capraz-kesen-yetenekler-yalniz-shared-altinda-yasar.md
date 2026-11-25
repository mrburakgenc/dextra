---
kimlik: KU-009
tur: kural
durum: taslak
surum: 1
baslik: Çapraz kesen yetenekler yalnız shared altında yaşar
dayanak: [KR-005@1]
kapsam: [backend/src/features/**, backend/src/shared/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/ARCHITECTURE.md
alinti: Feature icinde bunlarin kopyasi/alternatifi OLUSTURULAMAZ.
---
Yetkilendirme, güvenlik, veritabanı ve Unit of Work, mesajlaşma, gözlemlenebilirlik, HTTP temeli, hata süzgeçleri ve dış sistem ACL'leri yalnız shared altında yaşar; bir feature bunların kopyasını ya da alternatifini oluşturmaz.

## Neden
Kullanıcı (2026-11-21; TS-001): yetki sisteminin ana dekoratörleri shared'de durur ve shared'den sonra kurulacak ilk yapı yetkidir. Kanon belgesi gerekçe yazmaz (`ARCHITECTURE.md` satır 890–902).

## İhlal örneği
Kanondan (`ARCHITECTURE.md` satır 140): bir feature'ın kendi guard'ını yazması. Bu depoda karşılığı: `backend/src/features/` altında guard, hata süzgeci, veritabanı istemcisi kuran kod ya da ikinci bir yetki süzgeci.

## Uygun örnek
Bu depodaki yerler (2026-11-25'te ölçüldü): `backend/src/shared/yetki` (yetki motoru ve guard'ı), `shared/guvenlik` (kimlik guard'ı, uç işaretleri), `shared/database` (istemci ve Unit of Work), `shared/messaging` (outbox, kuyruk, tüketici), `shared/observability` (istek bağlamı, erişim ve iz kaydı), `shared/http` ve `shared/filters`. Feature bunları kullanır; `features/kimlik/_shared` yalnız kimliğin alt özellikleri arasındaki ortak koddur.

## Alım notu
- Kaynak: Mimari Değişmez 6 (`ARCHITECTURE.md` satır 890–902). Kanondaki listede "CQRS altyapısı" da vardır; bu depoda komut ve sorgu için ortak yol ya da taban sınıf yoktur (TS-005), bu yüzden listeye alınmadı.
- Dış sistem ACL'i bu depoda henüz yoktur; ilk dış sistemde `shared` altında kurulur.

## Açık uçlar
- AU-1: Kanon, shared'e neyin GİREMEYECEĞİNİ söylemez; kullanıcının seçimi TS-001 "Yapı" bölümündedir ve ayrı kural olarak yazılmadı.
- AU-2: "Shared hiçbir feature'ı içe aktarmaz" yükümlülüğü (KR-005; kullanıcı teyidi 2026-11-23) lint ile sınanıyor ama ayrı bir kural düğümü yok; bu kurala mı eklenecek, ayrı kural mı olacak?
