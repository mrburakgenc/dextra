---
name: tasarla
description: Tasarım protokolünü uygular; çıktı tasarım kaydı ve karar taslaklarıdır. Mimari, veri modeli, yeni bir özellik ya da geri alması pahalı bir karar konuşulurken, plan yazmadan önce kullan.
argument-hint: <tasarlanacak iş>
---

Şu iş için tasarım yap: $ARGUMENTS

## Ne zaman

- Yeni bir özellik, alt sistem ya da veri modeli tasarlanıyor.
- Geri alması pahalı (tek yönlü) bir karar söz konusu.
- Oturum plan modunda.

## Ne zaman değil

- Var olan bir akışta küçük, sınırı belli bir değişiklik: doğrudan `plan` ya da `gorev`.
- Tasarım zaten yazılmış ve kabul edilmiş: onu uygula, yeniden tasarlama.

## Adımlar

1. `harness/protokol/tasarim.md` dosyasını oku ve oradaki sırayı uygula.
2. Tasarımcı paketini al: `python3 harness/h.py paket --rol tasarimci`. Paketteki kesin kurallar tasarımın kısıtıdır.
3. İşin ağırlığını söyle: tek yönlü karar içeriyorsa on iki adımın hepsi, içermiyorsa 1, 3, 7 ve 11.
4. Bilinmeyen sayıyı kullanıcıya sor, her seferinde tek soru; cevap yoksa "varsayım" diye işaretle.
5. Tasarım kaydını aç: `python3 harness/h.py yeni tasarim "<başlık>"` ve adımların çıktısını ilgili bölümlere yaz. Karara bağlanmamış nokta "belgede yok" ya da "kullanıcıya sorulacak" diye düz metne yazılmaz; açık uç olarak eklenir: `python3 harness/h.py acik-uc ekle TS-NNN "<soru>"` (iş o noktaya gelince soru kullanıcıya gider).
6. Tek yönlü işte çürütme turu yap: bağımsız bir alt ajana tasarımı çürütmesini söyle, bulgularını ve cevaplarını "Çürütme" bölümüne yaz. Ona dört soru sor: bu tasarım nerede çöker; hangi hata kipi düşünülmemiş; en güçlü karşı görüş nedir ve bastırıldı mı; bunu kendi adınla imzalar mıydın, imzalamazsan neden. Çürütme turu koşmadıysa bölüme "bağımsız inceleme yapılmadı" ve nedeni yazılır.
7. Tasarımdan çıkan her karar için `karar`, her yükümlülük için `kural` taslağı aç.
8. Sonunda kullanıcıya şunu ver: açılan taslakların listesi, her birindeki açık soru ve varsayımlar.

## Yapma

- Sayı uydurma.
- Kesin kuralla çelişen seçenek sunma; çelişki gerekiyorsa önce o kuralın kararını değiştirme taslağı aç.
- Çıktıyı konuşmada bırakma; hiçbir düğümü kabul durumuna getirme.
- Tasarım bitmeden kod yazma.

## İlgili skill'ler

- Süreç eklentisinin beyin fırtınası skill'i varsa soru-cevap kısmı onunla yürütülebilir; çıktı onun belge yoluna değil tasarım kaydına (`kb/tasarim/`) yazılır.
- `karar`, `kural`: tasarımın bağlayıcı çıktıları.
- `plan`: tasarım kabul edildikten sonra.

## Sınırlar

Protokol en iyi tasarımı garanti etmez; sayısız hedef, tek seçenekle karar ve düşünülmemiş bozulma gibi hata sınıflarını azaltır. Çürütme turu da bir modelin yargısıdır; kanıt, "Doğrulama" bölümündeki ölçümün koşmasıdır.
