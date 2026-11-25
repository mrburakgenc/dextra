---
kimlik: KU-019
tur: kural
durum: kabul
surum: 1
baslik: Uç guard'ı yalnız izin kurallarını sayar
dayanak: [KR-016@1]
kapsam: [backend/src/shared/yetki/**, backend/src/shared/guvenlik/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-26
---
Uç guard'ı yalnız izin kurallarını sayar: yasak kuralları guard'ın baktığı kümeye girmez. Bir eylem ve kaynak için yalnız yasağı olan (hiç izin kuralı olmayan) kişi o uca giremez.

## Neden
Guard kaba kararı "o izin için herhangi bir kuralı var mı" diye verir (KR-007). Yasak aynı kümeye girerse, yalnız yasağı olan kişi kural sahibi sayılıp uca girer (ikinci çürütme turunda ölçüldü: yalnız yasağı olan kişide kural sayısı 1 çıkıyor).

## İhlal örneği
Derlenmiş kurallar izin ve yasak ayrılmadan tek listede guard'a verilir; yalnız "kullanıcı okuma, giremez" kuralı olan kişi kullanıcı listesi ucuna girer.

## Uygun örnek
Guard yalnız izin kurallarını sayar; aynı kişi 403 alır. İzni ve yasağı birlikte olan kişi uca girer, kayıtlar ve kolonlar repository'de süzülür.

## Alım notu
- Kural uygulanmadan önce yazıldı (TS-008 "Aşamalar").
