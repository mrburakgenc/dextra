---
kimlik: KU-017
tur: kural
durum: kabul
surum: 1
baslik: Uygulanamayan yasak sessizce düşmez; o izni kapatır
dayanak: [KR-016@1]
kapsam: [backend/src/shared/yetki/**, backend/src/features/kimlik/_shared/**, backend/src/features/kimlik/yetenek/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-26
---
Yazıldığı hâliyle eksiksiz kural üretmeyen yasak (şartı çözülemeyen, biçimi bozuk, kolon listesinden ad düşen, yer tutucusu boş çözülen) derlenirken atılmaz ve daraltılmaz: o eylem ve kaynak için kişide izni tümden kapatan yasağa çevrilir ve günlüğe hata yazılır. Bozuk derlenecek yasak yazılırken reddedilir.

## Neden
Kullanıcı (2026-11-25): bozuk yasak "o izni o kişide kapat"sın; üç bozuk durumun üçü de kapatsın. İlkesi (KR-008): tanım yanlış ya da eksikse erişim kapalı kalır. Düşen bir yasak erişimi genişletir.

## İhlal örneği
Derleyicinin, kolon listesinden bilinmeyen adı atıp yasağı kalan kolonlarla yaşatması; ya da şartı çevrilemeyen yasağı uyarı yazıp kural listesinden çıkarması.

## Uygun örnek
İki kolonlu yasağın bir kolonu şemada kalmamışsa kişi o eylemi o kaynakta hiç yapamaz (liste boş döner, yazma "yetki yok" alır), günlüğe derleme başına bir hata düşer ve teşhis ekranı "derlenemeyen yasak"ı gösterir (TS-008 Senaryo 4).

## Alım notu
- Kural uygulanmadan önce yazıldı: yasak henüz kodda yoktur (TS-008 "Aşamalar"). Kapsam yolları var olan klasörlerdir; uygulama görevleri bu kuralı bağlayıcı olarak alır.
- Muafiyet bu kuralda da geçerlidir (KU-018).
