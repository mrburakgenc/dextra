---
kimlik: KR-003
tur: karar
durum: kabul
surum: 1
baslik: Kod yazan ajan yalnız isteneni, en sade hâliyle yapar
agirlik: cift-yonlu
tip: surec
tarih: 2026-11-21
---
Ajanın yazdığı kod için "yalnız istenen, en sade hâliyle" seçildi; fark küçük, okunur ve incelenebilir kalıyor, ajanın kendiliğinden yaptığı iyileştirmelerden vazgeçiliyor.

## Bağlam
Kod yazan modeller istenmeyeni de yapma eğilimindedir: sorulmamış özellik, tek yerde kullanılan soyutlama, komşu kodu "düzeltme". Her biri farkı büyütür, incelemeyi zorlaştırır ve bir kararın uygulanıp uygulanmadığını görünmez kılar.

## Seçenekler
### A — Yalnız istenen, en sade hâliyle
Değişen her satır bir isteğe bağlanır; ajan gerekli gördüğü ama istenmemiş şeyi yapmaz, önerir.
### B — Ajan uygun gördüğü iyileştirmeyi de yapar
Kısa vadede daha "temiz" kod çıkabilir; fark büyür, kapsam bulanır ve inceleme neyin istendiğini ayırt edemez.

## Sonuçlar
- Olumlu: fark küçük kalır; inceleme kısa sürer; kapsam dışı değişiklik göze batar.
- Olumsuz: ajanın fark ettiği gerçek bir iyileştirme o işte yapılmaz; ayrı iş olarak önerilir.
- Yükümlülük: istenmeyen eklenmez (KU-005); ilgisiz kod değiştirilmez (KU-006).
- Ortak parça: görev kartındaki hedef ve kabul ölçütü; inceleyiciye sorulan iki soru.

## İstisna yolu
Küçük ve bariz işlerde (yazım hatası, tek satır) ölçülü uygulanır: amaç önemsiz işi yavaşlatmak değildir. Hedef bir soyutlamayı ya da yeniden düzenlemeyi açıkça istiyorsa o artık istenendir. Kendi değişikliğinin artığı olan kullanılmayan kod temizlenir; önceden var olan ölü kod silinmez, bildirilir.
