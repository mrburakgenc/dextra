# Yapıyı kanona çekme ve rapor zorunluluğu — 2026-11-25

## Denetlemek için

- Planın güncel hâli: `python3 harness/h.py plan durum` · görevler: `python3 harness/h.py gorev durum`
- Bir görevin kartı, işçinin bitiş kaydı ve inceleme kaydı: ana çalışma ağacında `.harness/gorev/GV-NNN/` (`kart.md`, `bitis.json`, `inceleme.json`, `rapor.json`, `inceleme-rapor.json`)
- Raporsuz görev ve boş bölüm: `python3 harness/h.py rapor durum` · görev tablosunu yenilemek: `python3 harness/h.py rapor uret <bu dosya>`

## 1. Kısa özet

_(doldurulacak: ne yapıldı, ne değişti ve kullanıcı neye bakmalı; madde madde, her iddianın kaynağıyla)_

## 2. Görevler

<!-- otomatik:basla -->
Bu bölümü araç üretir (`python3 harness/h.py rapor uret <dosya>`); sayılar aracın kayıtlarından (`.harness/gorev/`) okunur, elle yazılmaz. Süre ve maliyet her görevin SON işçi koşusunun ve SON incelemesinin kaydıdır: yeniden koşulan görevin önceki koşuları bu sayılara girmez.

Tabloda 16 görev var, 14 tanesi alındı. Son koşuların ve incelemelerin toplamı: 197.3 dakika, 73.10 dolar.

| Görev | Plan | Başlık | Aşama | İşçi (dk) | İnceleme (dk) | Dolar | Dosya | İncelemenin bulguları | Cevaplanan soru |
|---|---|---|---|---|---|---|---|---|---|
| GV-105 | EP-005 12 | Yerel deneme betiğine kalıcı kip: yerel veritabanlarının üstünde çalıştırma | alındı | 5.9 | 6.5 | 3.44 | 2 | 0 engel, 3 öneri | 0 |
| GV-106 | EP-008 1 | Yapı denetimi ve kalıp: rol alt özelliği kanondaki düzene çekilir | alındı | 5.4 | 9.0 | 4.98 | 40 | 0 engel, 4 öneri | 0 |
| GV-107 | EP-008 2 | Kullanıcı alt özelliği kanondaki düzene çekilir | alındı | 3.0 | 8.1 | 4.61 | 44 | 0 engel, 0 öneri | 0 |
| GV-108 | EP-008 3 | Grup alt özelliği kanondaki düzene çekilir | alındı | 12.4 | 8.7 | 6.95 | 36 | 0 engel, 2 öneri | 0 |
| GV-109 | EP-008 4 | Üyelik alt özelliği kanondaki düzene çekilir | alındı | 2.4 | 10.7 | 3.46 | 26 | 0 engel, 1 öneri | 0 |
| GV-110 | EP-008 5 | Yetenek alt özelliği kanondaki düzene çekilir | alındı | 3.0 | 6.3 | 4.41 | 37 | 0 engel, 1 öneri | 0 |
| GV-111 | EP-008 6 | Parola alt özelliği kanondaki düzene çekilir | alındı | 4.4 | 9.8 | 5.72 | 34 | 0 engel, 4 öneri | 1 |
| GV-112 | EP-008 7 | Oturum alt özelliği kanondaki düzene çekilir | bekliyor | — | — | — | — | — | 0 |
| GV-113 | EP-008 8 | Kurulum komutunun içe aktarma yolu parolanın yeni düzenine çevrilir | alındı | 1.9 | 4.9 | 1.26 | 1 | 0 engel, 0 öneri | 0 |
| GV-114 | EP-008 9 | Oturum alt özelliği kanondaki düzene çekilir | alındı | 18.0 | 6.6 | 10.99 | 48 | 0 engel, 2 öneri | 0 |
| GV-115 | EP-008 10 | Kimliğin ortak klasörü (_shared) kanondaki düzene çekilir | alındı | 3.4 | 8.1 | 5.24 | 81 | 0 engel, 5 öneri | 1 |
| GV-116 | EP-008 11 | Ortak kod düzene çekilir (1/3): yetki, güvenlik ve kimlik sözleşmeleri | alındı | 4.6 | 8.4 | 5.62 | 115 | 0 engel, 2 öneri | 1 |
| GV-117 | EP-008 12 | Ortak kod düzene çekilir (2/3): veritabanı, tohum ve mesajlaşma | alındı | 7.5 | 7.8 | 4.75 | 176 | 0 engel, 1 öneri | 0 |
| GV-118 | EP-008 13 | Ortak kod düzene çekilir (3/3): HTTP, süzgeçler ve gözlemlenebilirlik | alındı | 10.9 | 4.3 | 5.77 | 51 | 0 engel, 1 öneri | 0 |
| GV-119 | EP-008 14 | Yapı denetimi sıkılaşır: bütün alt özellikler ve ortak kod sınanır | bekliyor | — | — | — | — | — | 0 |
| GV-120 | — | Araca rapor komutu ve raporsuz görev denetimi eklenir | alındı | 8.3 | 7.2 | 5.91 | 6 | 0 engel, 3 öneri | 0 |
<!-- otomatik:bitir -->

## 3. Kullanıcının verdiği kararlar

_(doldurulacak: kullanıcının verdiği her karar, kendi sözüyle ve nerede kayıtlı olduğuyla)_

## 4. Ajanın verdiği kararlar

_(doldurulacak: ajanın kendi verdiği kararlar, gerekçeleri ve hangisinin kullanıcının teyidini beklediği)_

## 5. Duruşlar ve nedenleri

_(doldurulacak: duran, yeniden koşulan ya da atılan görevler ve nedenleri)_

## 6. Hatalar

_(doldurulacak: ajanın hataları ve nasıl düzeltildikleri)_

## 7. Araçta değişenler

_(doldurulacak: harness'ta değişen davranış; değişen yoksa "yok" yaz)_

## 8. Kullanıcıdan beklenenler ve açık işler

_(doldurulacak: kullanıcının yapması gerekenler, teyit bekleyen kararlar, yapılmayan işler; yoksa "yok" yaz)_

## 9. PR'lar

_(doldurulacak: açılan PR'lar ve durumları; yoksa nedeni)_

## 10. Günlük

_(doldurulacak: zaman sırasıyla ne oldu)_
