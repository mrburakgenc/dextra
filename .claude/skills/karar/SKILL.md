---
name: karar
description: Bir mimari ya da süreç kararını taslak karar düğümü olarak yazar; kabulü kullanıcı verir. Kullanıcı bir karar almak, bir seçeneği sabitlemek ya da geri alması pahalı bir tercih yapmak istediğinde kullan.
argument-hint: <karar konusu>
---

Şu konu için bir karar taslağı hazırla: $ARGUMENTS

## Ne zaman

- İki ya da daha çok gerçek seçenek var ve biri seçilecek.
- Seçim başka işleri bağlayacak: veri modeli, dış arayüz, yetki, depolama, yapıların sınırı, bir çalışma kuralı.
- Aynı tartışma ikinci kez açıldı: karar yazılmamış demektir.

## Ne zaman değil

- Tek dosyalık, kolayca geri alınan bir uygulama tercihi: karar düğümü değil, işin kendisi.
- Karar zaten var: yenisini açma, onu oku (`python3 harness/h.py sor <KİMLİK>`); değişecekse onu ezen bir karar yaz.

## Adımlar

1. Önce var olan kararlara bak: `python3 harness/h.py durum` ve ilgili düğümler için `python3 harness/h.py sor <KİMLİK>`.
2. Kararın ağırlığını belirle ve kullanıcıya söyle: geri alması pahalıysa tek yönlü, ucuzsa çift yönlü.
3. Tek yönlü kararda önce `tasarla` skill'ini uygula. Öğretici mod açıksa ilk taslağı kullanıcıdan iste ve onu çürütmeye çalış; kendin yazma.
4. Taslağı aç: `python3 harness/h.py yeni karar "<başlık>"`. Şablondaki her bölümü doldur; ağırlığın gerektirmediği bölümleri sil. Karara bağlanmamış bir nokta kalırsa onu "belgede yok" ya da "kullanıcıya sorulacak" diye düz metne yazma; açık uç olarak ekle: `python3 harness/h.py acik-uc ekle KR-NNN "<soru>"` (iş o noktaya gelince soru kullanıcıya gider). Kullanıcıya sormadan yaptığın her seçimi `### Ajan kararları` başlığı altına `- AK-<n> <seçim>: <gerekçe>` maddesi olarak yaz (n düğüm içinde artar); ajan kararını başka biçimde yazma: kullanıcının kabul sorusunda gördüğü liste bu maddelerden çıkar (`python3 harness/h.py ajan-karari KR-NNN`).
5. Karar cümlesi tek cümledir: şu durum için şu seçildi; şu kazanılıyor, şu bedel kabul ediliyor.
6. En az iki gerçek seçenek yaz. Ölçülmemiş sayıyı gerekçe yapma: ya kanıtını yaz ya da tarihli "varsayım" olarak işaretle.
7. "İstisna yolu" bölümünü boş bırakma: kararın uygulanmadığı durumları ve o zaman ne yapılacağını yaz; yoksa nedeniyle "istisnası yok" de.
8. Sonuçlar bölümündeki her yükümlülük için bir kural taslağı aç (`kural` skill'i).
9. `python3 harness/h.py denetle` ile biçimi kontrol et.
10. Kullanıcıya taslağı özetle (karar cümlesi, reddedilen seçenek, ondan doğan kural taslakları) ve kabul etmek isteyip istemediğini sor. İsterse kararı ve kurallarını tek komutla kabul ettir: `python3 harness/h.py kabul KR-NNN KU-NNN KU-NNN`. Hook taslakları, içlerindeki ajan kararlarıyla birlikte kullanıcıya gösterip sorar; onaylamazsa hiçbir şey değişmez. Kimlikleri kullanıcıya yazdırma, komutu sen çalıştır.

## Yapma

- Düğümü dosyada elle kabul durumuna getirme ve kullanıcı istemeden kabul komutunu çalıştırma. Kabul sorusunu atlatacak yol arama; soru kullanıcının kararıdır.
- Tek seçenekli karar yazma: reddedilen seçenek yoksa karar değil, beyandır.
- "Her", "hiçbir", "asla" ile mutlak karar yazma; istisna yolu olmayan mutlak karar uygulanmaz.
- Kararı konuşmada bırakma: yazılmayan karar bir sonraki oturumda yoktur.

## İlgili skill'ler

- `tasarla`: tek yönlü kararın öncesi.
- `kural`: kararın yükümlülüklerini bağlayıcı hâle getirir.

## Sınırlar

Kararın iyi olduğunu bu skill garanti etmez; biçimini ve zincirdeki yerini garanti eder. Kararın uygulandığını gösteren şey, ondan doğan kuralların denetimidir.
