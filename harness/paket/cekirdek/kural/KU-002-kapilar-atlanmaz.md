---
kimlik: KU-002
tur: kural
durum: taslak
surum: 1
baslik: Kapılar atlanmaz
dayanak: [KR-001@1]
olay: [commit, push]
baglama: kapsam
bicim: kural
kesinlik: kesin
denetim_duzey: gozden-gecirme
bakis: 2027-02-20
---
Commit ve push kapıları atlanmaz: kapıyı devre dışı bırakan bayrak kullanılmaz, hook yolu değiştirilmez; kapı kırmızıysa nedeni düzeltilir.

## Neden
Atlanan kapı bir sonraki sefer de atlanır; kırmızının nedeni düzeltilmezse zincir sessizce kopar.

## İhlal örneği
Kırmızı bir kapıyı geçmek için commit ya da push komutuna doğrulamayı atlatan bayrağı eklemek.

## Uygun örnek
Kapının söylediği halkayı düzeltip aynı komutu bayraksız yeniden çalıştırmak; düzeltilemiyorsa kullanıcıya nedenini söylemek.
