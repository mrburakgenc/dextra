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
CQRS altyapısı, yetkilendirme, veritabanı ve Unit of Work, güvenlik, mesajlaşma, gözlemlenebilirlik, dış sistem ACL'leri ve hata filtreleri yalnız shared altında yaşar; bir feature bunların kopyasını ya da alternatifini oluşturmaz.

## Neden
Belgede gerekçe yazmıyor (satır 890–902); kullanıcıya sorulacak.

## İhlal örneği
Belgeden (satır 140): bir feature'ın kendi guard'ını yazması; belgeye göre modüle özel guard yoktur, bütün guard'lar `shared/security/` ya da `shared/authorization/` altındadır.

## Uygun örnek
Belgeden (satır 893–900): yetkilendirme `shared/authorization/`, veritabanı ve Unit of Work `shared/database/`, dış sistem ACL'leri `shared/external/<vendor>/` altında durur; feature bunları kullanır.

## Alım notu
- Kaynak: Mimari Değişmez 6 (satır 890–902).
- Belge shared'e neyin giremeyeceğini söylemez; o boşluk için kullanıcının seçimi TS-001 "Yapı" bölümündedir ve ayrı kural adayıdır.
- Kapsam yolu varsayımdır.
