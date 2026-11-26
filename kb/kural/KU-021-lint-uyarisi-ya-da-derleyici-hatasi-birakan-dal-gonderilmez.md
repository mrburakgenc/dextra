---
kimlik: KU-021
tur: kural
durum: taslak
surum: 1
baslik: Lint uyarısı ya da derleyici hatası bırakan dal gönderilmez
dayanak: [KR-001@1]
kapsam: [backend/**, frontend/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: mekanik
denetim_ref: [DN-003, DN-004]
bakis: 2027-02-26
---
Arka yüzde ve ön yüzde lint sıfır uyarıyla, tip denetimi sıfır hatayla geçmeden dal gönderilmez; kapı kırmızıysa lint ayarı ya da derleyici ayarı gevşetilmez, uyarının ve hatanın nedeni düzeltilir.

## Neden
Lint ve tip denetimi bugüne kadar yalnız işçinin ve inceleyicinin elle koşturmasına bağlıydı; hiçbir kapıda koşmuyordu ve depoda sürekli tümleştirme yoktur (TS-009, ölçülenler). Kapıda koşmayan denetim, unutulduğu gün koşmamış olur.

## İhlal örneği
Lint uyarısı veren bir dosyayla dalı göndermek; ya da uyarıyı gidermek yerine `backend/eslint.config.mjs` içinde o kuralı kapatmak.

## Uygun örnek
Göndermeden önce `python3 harness/h.py denetim kos DN-003` ve `python3 harness/h.py denetim kos DN-004` komutlarının geçtiğini görmek; kalıyorsa bildirilen dosyayı düzeltmek.

## Ajan kararları
- AK-1 Lint denetimi de bu kurala bağlandı: TS-009 Yapı 3 lint denetiminin KU-007'ye bağlanmasını söylüyordu; KU-007 kabul edilmiş bir kuraldır ve denetim düzeyini değiştirmek sürüm artışı ile yeniden kabul ister. Kabul edilmiş kurala dokunmamak için iki denetim tek yeni kurala bağlandı; KU-007/AU-2 açık kalır ve kullanıcı isterse lint denetimi KU-007'ye de bağlanır.
- AK-2 Dayanak KR-001'dir (kurallar ve kapılar zinciri): bu kural yeni bir mimari seçim değil, var olan kapıya iki denetim ekler.
