---
kimlik: KU-020
tur: kural
durum: kabul
surum: 1
baslik: Yeteneğin etkisi değişmez ve yasak yalnız iki biçimde yazılır
dayanak: [KR-016@1]
kapsam: [backend/src/features/kimlik/yetenek/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-26
---
Bir yeteneğin etkisi yazıldıktan sonra değişmez: yenileme yasağı izne, izni yasağa çeviremez. Yasak yalnız iki biçimde yazılır: kaydın bütünü (kolon listesi yok) ya da kolon listesi. Belirsiz biçim, kimlik kolonlu liste, oluşturma, silme ve niyet eylemine kolon listeli yasak ile korunan kaynağın yazma eylemine yasak yazımda reddedilir.

## Neden
Kullanıcı (2026-11-25): etki çevrilemesin (tek alanlık hata yasaklananı açar); belirsiz biçimler yazımda reddedilsin; korunan kaynağa etkisiz yasak saklanmasın. Saklı her yasağın ne yaptığı tek anlamlı olmalıdır.

## İhlal örneği
Yenileme gövdesinde etkinin kabul edilmesi; ne "bütün kolonlar" işareti ne kolon listesi olan yasağın saklanması; listesinde kimlik kolonu olan yasak.

## Uygun örnek
Etkiyi değiştirmek isteyen yönetici yasağı siler ve izni ayrıca yazar (iki ayrı iş, ikisi de "yasakla" iznini ister); yenileme yalnız şartı, kolonları ve önceliği değiştirir, verilmeyen öncelik eski satırdan gelir.

## Alım notu
- Kural uygulanmadan önce yazıldı (TS-008 "Aşamalar"). Yasak ve sıfırdan farklı öncelik yazımı son aşamaya kadar kapalıdır.
