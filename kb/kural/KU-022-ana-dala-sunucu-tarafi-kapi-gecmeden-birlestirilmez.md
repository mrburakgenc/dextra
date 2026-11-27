---
kimlik: KU-022
tur: kural
durum: taslak
surum: 1
baslik: Ana dala sunucu tarafı kapı geçmeden birleştirilmez
dayanak: [KR-017@1]
olay: [push]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-27
---
Ana dala giren her değişiklik PR'dan geçer ve sunucu tarafı kapının dört işi (zincir, arac-testleri, arka-yuz, on-yuz) geçmeden birleştirilmez; kapı kırmızıysa ya da koşmadıysa iş akışı, test ya da denetim gevşetilmez, nedeni düzeltilir.

## Neden
Arka yüz, ön yüz ve araç testleri yalnız bu kapıda koşar; yerel kapı ajanın makinesindedir ve atlatılabilir (KR-017, Bağlam). Kapıda koşan ama birleştirmeyi durdurmayan denetim yalnız bilgi verir.

## İhlal örneği
`kapi` iş akışının `arka-yuz` işi kırmızıyken PR'ı birleştirmek; ana dala PR açmadan doğrudan itmek; kalan bir testi geçirmek için `.github/workflows/kapi.yml` içine `continue-on-error` yazmak ya da o testi atlamak.

## Uygun örnek
PR'da dört iş de geçmiş, özet yorumu (kabule geçen düğümler ve kapı dosyalarındaki değişiklik) okunmuş; birleştirme ondan sonra yapılır. Kapı koşamıyorsa KR-017'nin istisna yolu uygulanır: birleştirme kararını kullanıcı verir ve nedenini PR'a yazar.

## Bu depodaki denetim
Bugün gözden geçirmedir: `main` dalının koruma kuralı yoktur (2026-11-27'de ölçüldü), yani birleştirmeyi durduran bir düzenek yoktur. Koruma kuralı kurulup dört iş zorunlu kontrol yapılınca kuralı GitHub zorlar.

## Açık uçlar
- AU-1: Ana dalın koruma kuralı kurulunca bu kuralın denetimi nasıl gösterilecek: GitHub ayarı bir denetim düğümüyle temsil edilecek mi, kural gözden geçirme düzeyinde mi kalacak?
