---
kimlik: DN-001
tur: denetim
durum: kabul
surum: 1
baslik: Raporsuz görev denetimi: dalda alınan her görev bir raporda geçer
cesit: yerlesik
---
Taban dala göre bu dalda alınmış olup hiçbir raporda geçmeyen görevi ve kısa özeti boş bırakılmış raporu yakalar.

## Nasıl koşar
`python3 harness/h.py denetle --dal` (push kapısı bu komutu koşturur); yalnız bakmak için `python3 harness/h.py rapor durum`. Taban dal ile dalın ucu arasındaki commit başlıklarından görev kimlikleri (`GV-NNN:` ile başlayan başlıklar) toplanır ve `docs/rapor/` altındaki dosyalarda aranır.

## Kırmızı örnek
Dalda `GV-106: ...` başlıklı bir alma commit'i var ve `docs/rapor/` altındaki hiçbir dosyada `GV-106` geçmiyor: denetim "raporsuz görev" bildirir ve push durur.

## Yeşil örnek
Aynı dalda `docs/rapor/2026-11-25-yapi-duzeltmesi.md` görev tablosunda GV-106'yı taşıyor ve "Kısa özet" bölümü dolu: denetim geçer.
