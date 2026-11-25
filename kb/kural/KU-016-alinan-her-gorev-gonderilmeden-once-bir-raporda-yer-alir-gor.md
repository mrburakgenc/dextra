---
kimlik: KU-016
tur: kural
durum: taslak
surum: 1
baslik: Alınan her görev gönderilmeden önce bir raporda yer alır; görev tablosunu araç üretir
dayanak: [KR-015@1]
olay: [oturum]
baglama: kapsam
bicim: kural
kesinlik: kesin
denetim_duzey: mekanik
denetim_ref: [DN-001]
bakis: 2027-02-25
---
Bu dalda alınan her görev, dal gönderilmeden önce `docs/rapor/` altındaki bir raporda yer alır; raporun görev tablosunu araç üretir, kısa özet ile kullanıcıdan beklenenler elle yazılır ve boş bırakılmaz.

## Neden
Görev kayıtları depoya girmez; rapor, kullanıcının işi sonradan denetleyebildiği tek belgedir ve sayıları elle yazılırsa kanıt olmaktan çıkar.

## İhlal örneği
Bir epic'in görevlerini alıp dalı rapor yazmadan göndermek; ya da raporun görev tablosundaki süre ve maliyeti elle yazmak; ya da "Kısa özet" bölümünü şablondaki yer tutucuyla bırakmak.

## Uygun örnek
Görevler alındıktan sonra `python3 harness/h.py rapor yeni "<konu>"` ile raporu açmak, kısa özeti ve kullanıcıdan beklenenleri yazmak, `python3 harness/h.py rapor durum` çıktısında raporsuz görev kalmadığını görmek ve dalı ondan sonra göndermek.
