---
kimlik: KU-006
tur: kural
durum: kabul
surum: 1
baslik: Cerrahi değişiklik
dayanak: [KR-003@1]
olay: [duzenleme]
rol: [uygulayici, inceleyici]
baglama: kapsam
bicim: kural
kesinlik: kesin
denetim_duzey: gozden-gecirme
bakis: 2027-02-21
---
Yalnız işin gerektirdiği satırlar değiştirilir: komşu kod, yorum ve biçim "iyileştirilmez", çalışan kod yeniden düzenlenmez; değişen her satır hedefe bağlanabilmelidir.

## Neden
İlgisiz değişiklik farkı büyütür, asıl değişikliği gizler ve istenmeyen bir davranış değişikliğini fark edilmeden içeri sokar.

## İhlal örneği
Bir hatayı düzeltirken aynı dosyadaki başka fonksiyonların adını, biçimini ya da yorumlarını değiştirmek.

## Uygun örnek
Yalnız hatalı satırları değiştirmek; fark edilen ilgisiz ölü kodu silmeyip bitiş kaydında bildirmek.
