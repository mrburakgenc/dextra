---
name: hata-ayikla
description: Bir test, komut ya da davranış beklenmedik biçimde başarısız olduğunda kök nedeni bulmak için adım adım hata ayıklama. Bir hata ilk denemede çözülmediğinde, hata mesajı anlaşılmadığında ya da aynı yere ikinci kez yama yapmak üzereyken kullan.
argument-hint: <başarısız olan şey ve gördüğün hata>
---

Şu sorunu kök nedenine inerek çöz: $ARGUMENTS

Kural tek cümledir: **nedeni göstermeden düzeltme yazma.** Tahminle yapılan yama, hatayı gizler ya da başka yere taşır.

## Ne zaman

- Bir test ya da komut başarısız oldu ve neden olduğu açık değil.
- İlk düzeltme denemen işe yaramadı.
- "Şunu da değiştireyim, belki geçer" diye düşünmeye başladın.

## Ne zaman değil

- Hata mesajı nedeni açıkça söylüyor ve düzeltme tek satır (yazım hatası, eksik içe aktarma): düzelt, doğrula, geç.

## Adımlar

1. **Yeniden üret.** Hatayı veren en kısa komutu bul ve iki kez çalıştır; her seferinde aynı mı? Üretemiyorsan düzeltme yazma, önce ne zaman olup ne zaman olmadığını bul.
   - Elinde hatayı yakalayan tek komut yokken açıklama üretme. Komut hızlıdır (saniyeler), her koşuda aynı sonucu verir ve belirtinin kendisini sınar ("hata vermedi" değil, gördüğün yanlış çıktı). Bu komut yazılmadan 4. adıma geçilmez; sonraki her adım onu yeniden koşturur.
2. **Mesajın tamamını oku.** İlk hatayı bul (son satır çoğu zaman sonuçtur), dosya ve satırı aç, çağrı zincirini yukarı doğru izle.
3. **Ne değişti?** Çalışan son hâl ile şimdiki arasındaki farka bak (`git diff`, `git log`). Hata senin değişikliğinden mi geliyor, önceden var mıydı?
   - Bir de çalışan bir örnekle karşılaştır: aynı işi doğru yapan yeri bul (komşu işlev, geçen bir test, eski sürüm) ve ikisi arasındaki farkları küçük de olsa tek tek yaz. Açıklama adayları bu farklardan çıkar.
4. **Tek bir açıklama yaz.** "Şu yüzden oluyor, çünkü şunu gördüm" biçiminde, bir cümle. Açıklaman gördüğün her belirtiyi karşılamıyorsa henüz bulmadın.
5. **Açıklamayı sına, düzeltmeyi değil.** Açıklama doğruysa ne görmen gerekir? Onu gösteren en küçük denemeyi yap (bir çıktı satırı, daraltılmış bir test). Yanlış çıktıysa 4'e dön.
   - Ayıklama için eklediğin geçici günlük satırlarını tek bir etiketle işaretle (ör. `[AYIKLA-GV-NNN]`). Bitişte etiketi ara (`grep -rn "AYIKLA-"`) ve bulduğun her satırı temizle; etiketsiz günlük satırı unutulur ve koda kalır.
6. **Tek değişiklik yap.** Kök nedeni gideren en küçük değişikliği yaz; yanında başka şey düzeltme.
   - Değişikliği yazmadan önce o hatayı yakalayan testi yaz ve kırmızıyı gör (`test-yaz`). Hatayı oluştuğu biçimde sınayabilecek uygun bir sınır yoksa (yalnız yüzeysel bir yerden sınanabiliyorsa) testi zorlama: bunu bitiş kaydına bulgu olarak yaz.
   - Belirtide değil kaynağında düzelt: yanlış değeri ilk üretildiği yere kadar geri izle. Değeri kullanıldığı yerde yamamak hatayı gizler ya da başka bir çağıranda yeniden çıkarır.
7. **Doğrula.** 1. adımdaki komut şimdi geçiyor mu? Çevresindeki testler hâlâ geçiyor mu?
8. **Üç denemede çözemediysen dur.** Dördüncü yamayı yazma: ne denediğini, ne gördüğünü ve hangi açıklamaların çürüdüğünü yaz. Görev oturumundaysan bitiş kaydına durumu "soru" yaz; etkileşimli oturumdaysan kullanıcıya sor. Üç başarısız deneme çoğu zaman hatanın değil varsayımın yanlış olduğunu gösterir.
   - Durduğunda bitiş kaydına şu sorunun cevabını da yaz: yaklaşım ya da yapı yanlış olabilir mi? Her düzeltme başka bir yerde yeni bir sorun açıyorsa ya da düzeltme için büyük bir yeniden yazım gerekiyorsa cevap çoğu zaman evettir; o zaman soru düzeltmenin değil tasarımın sorusudur.

## Yapma

- Hatayı susturma: istisnayı yutma, testi atlama, beklenen değeri gördüğün değere çevirme.
- Aynı anda birden çok şeyi değiştirme; hangisinin işe yaradığını bilemezsin.
- "Bende çalıştı" deme: komutu ve çıktısını göster.
- Kök neden kapsamının dışındaysa oraya girme: bildir ve dur.

## İlgili skill'ler

- Etkileşimli oturumda süreç eklentisinin kendi hata ayıklama skill'i varsa o da kullanılabilir; bu skill, eklentileri yüklemeyen görev oturumları için aynı disiplini projenin içinde tutar.
- Kök neden bir kuralın ya da kararın yanlışlığına işaret ediyorsa: `karar` ya da `kural`.
- Hatayı yakalayan testi yazarken: `test-yaz`.

## Sınırlar

Bu bir yöntemdir, kapı değildir: uygulandığını hiçbir araç denetlemez. Denetlenen şey sonuçtur: görevin kabul ölçütü, kapsamı ve bağımsız incelemesi.

Kaynak: mattpocock/skills `diagnosing-bugs` (commit 6f7f783) ve obra/superpowers `systematic-debugging` (7.0.2, commit 22f0b46), ikisi de MIT lisanslı; metin kopyalanmadı, fikir Türkçeye ve bu deponun kurallarına uyarlandı.
