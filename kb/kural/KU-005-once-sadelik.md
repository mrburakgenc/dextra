---
kimlik: KU-005
tur: kural
durum: kabul
surum: 1
baslik: Önce sadelik
dayanak: [KR-003@1]
olay: [duzenleme]
rol: [uygulayici, inceleyici]
baglama: kapsam
bicim: kural
kesinlik: kesin
denetim_duzey: gozden-gecirme
bakis: 2027-02-21
---
İstenen işi karşılayan en az kod yazılır: istenmemiş özellik, tek yerde kullanılan soyutlama, istenmemiş ayar ya da esneklik ve olamayacak durum için hata yönetimi eklenmez.

## Neden
Fazladan yazılan her satır okunacak, sınanacak ve bakımı yapılacak bir satırdır; istenmemiş esneklik çoğu zaman hiç kullanılmaz.

## İhlal örneği
Tek bir biçimlendirme fonksiyonu istenmişken strateji sınıfları, bir ayar dosyası ve bir önbellek eklemek.

## Uygun örnek
İstenen fonksiyonu yazmak; ileride gerekebilecek esnekliği kodlamadan, bitiş kaydında öneri olarak bildirmek.
