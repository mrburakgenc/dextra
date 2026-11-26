---
name: test-yaz
description: Davranışı sınayan testi koddan önce yazar ve kırmızıdan yeşile tek tek ilerler. Yeni bir davranış eklerken, bir hatayı düzeltmeden önce onu yakalayan testi yazarken ya da bir görevin kabul ölçütünü teste dökerken kullan.
argument-hint: <sınanacak davranış>
---

Şu davranış için testi önce yaz, sonra kodu: $ARGUMENTS

Kural tek cümledir: **başarısız olduğunu görmediğin test hiçbir şey kanıtlamaz.** Kodla birlikte ya da koddan sonra yazılan test, kodun yaptığını onaylar; istenen davranışı değil.

## Ne zaman

- Yeni bir davranış ekliyorsun ya da var olanı değiştiriyorsun.
- Bir hatayı düzelteceksin: önce o hatayı yakalayan testi yaz (`hata-ayikla` da bunu ister).
- Görevin kabul ölçütü "testler şu dosyadadır" diyor.

## Ne zaman değil

- Yalnız belge, yorum ya da ayar değişiyor ve sınanacak davranış yok: zincir denetimini koştur, test yazma.
- Atılacak bir deneme yazıyorsun: işin sonunda sil; kalıcı koda geçen her davranış test ister.

## Adımlar

1. **Sınırı seç.** Testin duracağı açık arayüzü belirle: dışarıdan çağrılan işlev, komut satırı, dosyaya yazılan kayıt. İç ayrıntıyı, özel (alt çizgiyle başlayan) işlevi, ara veri yapısını sınama; kod yeniden düzenlenince davranış aynıysa test de geçmelidir. Hangi sınırı neden seçtiğini bitiş kaydında söyleyebilmelisin.
2. **Tek bir davranış seç.** Bu turda sınayacağın tek davranışı bir cümleyle yaz: "neden kodu olmadan iptal isteği reddedilir". Test adı bu cümledir; nasıl yapıldığını değil, ne olduğunu söyler.
3. **Beklenen değeri bağımsız bir kaynaktan al.** Elle hesapladığın değer, şartname, kabul ölçütündeki örnek, bilinen bir girdi-çıktı çifti. Beklenen değeri kodun yaptığı hesabı testte yineleyerek üretme: öyle bir test kodla hiç ayrışamaz, hep geçer.
4. **Testi yaz ve kırmızıyı gör.** Testi koştur; doğru nedenle başarısız olduğunu gör (beklenen değer tutmadı; içe aktarma ya da yazım hatası değil). Kırmızı çıktının satırını sakla: bitiş kaydının `testler` alanında `kirmizi` olarak yazılır.
5. **Geçiren en az kodu yaz.** Yalnız bu testi geçirecek kadar; sonraki testi, gelecekte lazım olabilecek seçeneği öngörme.
6. **Yeşili gör.** Testi ve çevresindeki testleri koştur. Komutu ve sonucunu `yesil` olarak sakla.
7. **Yinele.** Sıradaki davranış için 2. adıma dön. Bir test, bir uygulama; her tur bir öncekinden öğrendiğine göre yön alır.
8. **Bitiş kaydına yaz.** Eklediğin ya da koşturduğun her test dosyası için `{"dosya": ..., "kirmizi": ..., "yesil": ...}`. Kırmızıyı göremediysen (örneğin var olan testi yalnız koşturduysan) `kirmizi` alanına nedenini yaz.

## Yapma

- Testlerin hepsini önce, kodun hepsini sonra yazma: toplu yazılan test hayal edilen davranışı sınar, gerçek değişikliğe duyarsız kalır.
- Tabloda ya da listede "tam olarak şunlar var" sınaması yazma (`assertEqual(set(...), {...})` ile bütün kayıtları saymak): sonradan eklenen her kayıt o testi kırar; bu depoda üç kartta yaşandı. Sınadığın kaydın var olduğunu ya da olmaması gerekenin olmadığını sına.
- Kendi parçalarını sahteleme. Sahte nesne yalnız sistemin sınırında kullanılır: ağ, saat, rastgelelik, dış servis, başka bir süreç (bu depoda `claude -p` yerine koşan sahte işçi gibi). Kendi işlevini sahteleyen test, gerçek kodun kırıldığını göremez.
- Testi arayüzü atlayarak doğrulama: veriyi kaydeden işlevi sınarken dosyayı elle açıp iç biçimine bakmak yerine onu okuyan açık işlevi kullan.
- Çağrı sayısını ya da sırasını sınama; sonuç doğruysa kaç kez çağrıldığı davranış değildir.
- Kırmızıyı görmeden yeşil sayma; beklenen değeri gördüğün çıktıya çevirerek testi geçirme.

## İlgili skill'ler

- `hata-ayikla`: test beklenmedik biçimde başarısız olursa ya da bir hatayı düzeltmeden önce onu yakalayan testi arıyorsan.

## Sınırlar

Bu bir yöntemdir; kırmızının gerçekten görüldüğünü araç denetlemez. Araç yalnız bitiş kaydında `testler` alanının bulunduğunu ve her nesnenin bir dosya taşıdığını ölçer. Testin davranışı sınayıp sınamadığına bağımsız inceleme bakar: kendini doğrulayan test ve tam liste sınaması orada engel sayılır.

Kaynak: mattpocock/skills `tdd` (commit 6f7f783) ve obra/superpowers `test-driven-development` (7.0.2, commit 22f0b46), ikisi de MIT lisanslı; metin kopyalanmadı, fikir Türkçeye ve bu deponun kurallarına uyarlandı.
