---
name: kb-ice-al
description: Var olan bir belgeyi (mimari not, karar yazısı, özellik listesi, toplantı notu) bilgi tabanına taslak düğümler olarak alır; her taslak çıktığı cümleyi kaynak gösterir, kabulü kullanıcı verir. Kullanıcı elindeki bir belgeyi karar ve kurallara dökmek istediğinde kullan.
argument-hint: <belgenin yolu>
---

Şu belgeyi bilgi tabanına al: $ARGUMENTS

Üç katman vardır ve karışmaz: **ham kaynak** (kullanıcı seçer, değişmez), **düğümler** (sen taslak yazarsın, kullanıcı kabul eder), **şema** (`AGENTS.md` ve skill'ler).

## Ne zaman

- Kullanıcının elinde bağlayıcı içerik taşıyan bir belge var ve zincire girmesi isteniyor.
- Yeni bir projeye başlanırken eski notlar taşınıyor.

## Ne zaman değil

- Karar konuşmada alınıyor: `karar`.
- Belge yalnız betimleyici (kullanım kılavuzu, dış doküman): düğüm çıkarma, yolunu ilgili düğümde kaynak olarak göster.

## Adımlar

1. Belgeyi `kb/_gelen/` altına koy; adını ve içeriğini değiştirme. Oradaki dosya hiçbir zaman düzenlenmez.
2. Belgenin tamamını oku. Kullanıcıya ana çıkarımları say: hangi kararlar, hangi yükümlülükler, hangi yapılar, hangi açık sorular. Onayı olmadan düğüm açma.
3. Var olan düğümlerle karşılaştır (`python3 harness/h.py durum`, `sor`): aynı konuyu söyleyen düğüm varsa yenisini açma; çelişiyorsa çelişkiyi kullanıcıya söyle.
4. Her karar için `python3 harness/h.py yeni karar "<başlık>"`, her yükümlülük için `yeni kural "<başlık>"` ile taslak aç. Her taslağın başlık bloğuna iki alan ekle: `kaynak: kb/_gelen/<dosya>` ve `alinti: <dayandığı cümle, aynen>`.
5. Belgede olmayan şeyi tamamlama: seçenekler, gerekçe ya da istisna belgede yoksa bölümü boş bırakma, "belgede yok" yaz ve kullanıcıya sor.
6. `python3 harness/h.py denetle` ile biçimi kontrol et.
7. Kullanıcıya şunu ver: açılan taslakların listesi (kimlik, başlık, dayandığı alıntı), belgede bulup düğüme çevirmediklerin ve nedeni, var olan düğümlerle çelişenler.

## Yapma

- Alıntısı olmayan taslak açma: dayandığı cümleyi gösteremiyorsan belge onu söylemiyordur.
- Belgeyi "düzeltme", özetleyip özeti kaynak gösterme.
- Taslakları kendin kabul durumuna getirme; kullanıcı hangilerini istediğini söyleyince kabul komutunu çalıştır, hook ona sorar.
- Bir belgeden onlarca düğüm çıkarma: bağlayıcı olanı al, gerisini kullanıcıya bırak.

## İlgili skill'ler

- `karar`, `kural`: taslakların biçimi. `kb-tara`: alımdan sonra çelişki ve boşluk taraması.

## Sınırlar

Burada muhakeme modeldedir ve belgeyi yanlış okuyabilir; taslak hâli ve alıntı zorunluluğu bunun içindir. Her taslak açıldığında bilgi tabanı günlüğüne (`kb/GUNLUK.md`) kendiliğinden bir satır düşer; kabul edilmemiş hiçbir şey bağlamaz.
