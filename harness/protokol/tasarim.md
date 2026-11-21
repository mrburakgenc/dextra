# Tasarım protokolü

Plan ve mimari konuşulurken uygulanan sabit sıra. Amaç, tasarımın akla ilk gelen çözümle değil;
ölçüyle, karşılaştırmayla ve bozulma senaryolarıyla çıkmasıdır.

## Ne zaman

- Oturum plan modundayken.
- `/tasarla` komutu verildiğinde.
- Geri alması pahalı (tek yönlü) bir karar söz konusu olduğunda.

## Başlamadan

1. Tasarımcı paketini al: `python3 harness/h.py paket --rol tasarimci`.
2. Paketteki kesin kurallar tasarımın kısıtıdır; orada reddedilmiş görünen seçenek yeniden önerilmez.
3. Tasarım kaydını aç: `python3 harness/h.py yeni tasarim "<başlık>"`.

## Adımlar

| # | Adım | Ne yapılır | Tasarım kaydındaki bölüm |
|---|---|---|---|
| 1 | Sorunu sabitle | Amaç, kapsam dışı, başarının ölçüsü | Sorun |
| 2 | Kalite senaryoları | "Şu olunca, şu ortamda, sistem şunu şu ölçüyle yapar"; her senaryoda sayı | Senaryolar |
| 3 | Kısıtlar ve değişmezler | Kesin kurallar, platform sınırları, alanın her zaman doğru kalması gerekenler | Kısıtlar, Değişmezler |
| 4 | Yük ve kapasite hesabı | Açık aritmetik: veri hacmi, istek sayısı, büyüme, süre bütçesinin dağılımı | Kapasite |
| 5 | Önce veri | Varlıklar, ilişkiler, anahtarlar, durum geçişleri, işlem sınırları, erişim desenleri | Veri modeli |
| 6 | Sınırlar ve sözleşmeler | Yapılar, sorumlulukları, bağımlılık yönü, arayüzler: girdi, çıktı, hata | Yapı |
| 7 | Seçenekler ve takas | En az iki gerçekten farklı seçenek; senaryolara göre karşılaştırma | Seçenekler |
| 8 | Hata modları | Parça parça: ne bozulur, nasıl fark edilir, ne kadar yayılır, ne yapılır | Hata modları |
| 9 | Sıcak yol analizi | En sık çalışan yolların işlem ve sorgu sayısı; veri büyüdükçe davranışı | Performans mantığı |
| 10 | Geri dönüş ve dilimleme | Kararları tek ve çift yönlü ayır; en ince uçtan uca dilimi tanımla | Aşamalar |
| 11 | Doğrulama planı | Her kritik karar için çalışan ölçüm: test, denetim, yük testi | Doğrulama |
| 12 | Çürütme turu | Bağımsız bir ajan tasarımı çürütmeye çalışır; bulguları kayda girer | Çürütme |

Tek yönlü karar içeren işte on iki adımın hepsi, diğerlerinde 1, 3, 7 ve 11 uygulanır.

## Konuşma kuralları

1. Sayı uydurulmaz; bilinmeyen sayı sorulur ya da "varsayım" diye işaretlenir.
2. Her seferinde tek soru sorulur.
3. Kullanıcının önermesi bir ölçümle ya da kesin bir kuralla çelişiyorsa bu açıkça söylenir.
4. Kesin kuralla çelişen seçenek sunulmaz; çelişki gerekiyorsa önce o kuralın kararını değiştirme taslağı açılır.
5. Ajanın kapasite hesabı aritmetiktir, ölçüm değildir; kayda öyle geçer.
6. Çıktı konuşmada kalmaz; tasarım kaydına yazılır.

## Çıktı

- Bir tasarım kaydı (`kb/tasarim/TS-NNN-...md`), taslak.
- Ondan doğan karar taslakları: `python3 harness/h.py yeni karar "<başlık>"`; her karar `baglam` alanında tasarım kaydını gösterir.
- Kararların yükümlülüklerinden kural taslakları: `python3 harness/h.py yeni kural "<başlık>"`.
- Hiçbiri kabul edilmiş değildir. Kabulü kullanıcı verir: istediğinde kabul komutu çalıştırılır ve hook taslağı gösterip ona sorar.

## Öğretici mod açıkken

- Tek yönlü kararın ilk taslağını kullanıcı yazar; ajan eksik bölümü ve zayıf gerekçeyi göstererek çürütmeye çalışır.
- Ajan her seçimde tekniğin adını, neyi kazandırıp neyi kaybettirdiğini ve alternatifini söyler.

## Bu protokolün yapamadığı

- En iyi tasarımı garanti etmez; sayısız hedef, tek seçenekle karar, düşünülmemiş bozulma ve ölçülmeyen varsayım gibi hata sınıflarını azaltır.
- Çürütme turu da bir modelin yargısıdır; kanıt, Doğrulama bölümündeki ölçümün koşmasıdır.
