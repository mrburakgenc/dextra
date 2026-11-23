---
kimlik: KU-014
tur: kural
durum: taslak
surum: 1
baslik: Rol kalıtımı yoktur; her rol iznini açıkça taşır
dayanak: [KR-007@1]
kapsam: [backend/src/shared/authorization/**, backend/prisma/seeds/permissions/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: Role inheritance YASAK. ADMIN → MUDUR → PERSONEL tipi **implicit inheritance YOK**. Her role kendi permission seti **acikca tanimlar**.
---
Rol kalıtımı yoktur: bir rol başka bir rolün iznini devralmaz, her rol kendi izin kümesini izin verisinde açıkça taşır. Tekrarı azaltmak gerekiyorsa bu, izin verisini üreten kodda yapılır; çalışma anındaki yetki hesabına kalıtım eklenmez.

## Neden
Belgedeki gerekçe (satır 1844): bir rolün hangi izne sahip olduğu izin verisinden doğrudan okunur; kalıtımın getirdiği hata ayıklama zorluğu olmaz.

## İhlal örneği
Belgeden (satır 1829): bir rolü başka bir rolden devralacak biçimde tanımlamak (`inherits`).

## Uygun örnek
Belgeden (satır 1831–1846): her rol için eylem ve kaynak satırı ayrı yazılır; tekrar, izin verisini üreten kodda dizi birleştirmeyle giderilir.

## Alım notu
- Kaynak: Kural 18.3 / CASL-09 (satır 1823–1846).
- Belgedeki rol ve kaynak adları projeye özgüdür; alınmadı.
- Açık (kural cümlesi): bu depoda izin kümesini rol tek başına değil, grup + rol çifti taşır (TS-001 "Veri modeli", kullanıcı seçimi 2026-11-22); cümle kabulden önce buna göre düzeltilecek, kalıtım yasağı değişmez.
- Açık (dayanak ve kapsam; çürütme turu, 2026-11-22): grup ağacında da kalıtım olmaması KR-008 taslağından gelir ve dayanakta yoktur; kapsam yalnız tohum klasörünü sayar, oysa yetenek çalışma anında da yazılır. Kabulden önce ikisi gözden geçirilecek.
- Kapsam yolu varsayımdır; izin verisinin klasörü belgedeki yoldur (satır 1852) ve bu depoda kesinleşmedi.
- Uyarlama notu (2026-11-23; ikinci çürütme turu 54. bulgu): kabulden önce cümle şöyle düzeltilecek — izin kümesini rol değil grup + rol kümesi taşır ve kalıtım ne roller arasında ne grup ağacında vardır (KR-008 Seçim 2 ve 6). "Tekrar üreten kodda giderilir" cümlesi çalışma anında yazılan yetenek için geçersizdir; orada tekrar kabul edilen bedeldir (KR-008 Seçim 29 ve 39).
