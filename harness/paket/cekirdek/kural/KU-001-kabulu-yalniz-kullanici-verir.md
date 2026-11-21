---
kimlik: KU-001
tur: kural
durum: taslak
surum: 1
baslik: Kabulü yalnız kullanıcı verir
dayanak: [KR-001@1]
olay: [oturum]
baglama: kapsam
bicim: kural
kesinlik: kesin
denetim_duzey: gozden-gecirme
bakis: 2027-02-20
---
Ajan bir karar ya da kural düğümünü taslak olarak yazar; düğümü kabul durumuna yalnız kullanıcı getirir.

## Neden
Kuralı yazanın onu kendisinin onaylaması hiçbir şeyi denetlemez; kabul, kullanıcının kuralı okuyup anladığının kaydıdır.

## İhlal örneği
Ajanın bir düğümün başlık bloğunda durumu taslaktan kabule çevirmesi ya da kabul sorusu kullanıcıya gösterilmeden kabul edilmesini sağlayacak bir yol araması (soru göstermeyen izin modu, komutu bir betiğe sarmak).

## Uygun örnek
Ajanın taslağı yazıp kullanıcıya özetlemesi ve kullanıcı isteyince `python3 harness/h.py kabul KU-012` çalıştırması: kapı taslağı kullanıcıya gösterip sorar, kullanıcı onaylarsa düğüm kabul edilir. Çekirdek paket iskeletle birlikte kabul edilmiş sayılır; onu `kur` kabul edilmiş olarak kurar.
