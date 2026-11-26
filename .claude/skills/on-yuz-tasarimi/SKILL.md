---
name: on-yuz-tasarimi
description: Ekran ya da arayüz parçası yazarken görünüm kararlarını projenin tasarım sistemine bağlar; kısa tasarım planı, kalite tabanı (dar ekran, klavye odağı, azaltılmış hareket, karşıtlık), boş/yükleniyor/hata durumları ve arayüz metni. Yeni bir ekran eklerken, var olan bir ekranın görünümünü değiştirirken ya da `frontend/` altında arayüz parçası yazarken kullan.
argument-hint: <yazılacak ya da değişecek ekran>
---

Şu ekranı ya da arayüz parçasını bu yöntemle yaz: $ARGUMENTS

İlke tek cümledir: **görsel karar bir kez, tasarım sisteminde alınır; ekran onu uygular.** Her ekranda yeniden seçilen
renk, yazı ve aralık birbirine benzemeyen bir uygulama üretir; o seçimleri işçi değil, kullanıcının görsel yön kararı
verir. Ekranı yazanın işi, o kararları sadakatle uygulamak ve kullanıcının işini kolaylaştıran ayrıntıyı atlamamaktır.

## Ne zaman

- Yeni bir ekran, sayfa ya da görünüm ekliyorsun.
- Var olan bir ekranın görünümü değişiyor: yerleşim, renk, yazı, durum gösterimi, arayüz metni.
- `frontend/` altında bir arayüz parçası (düğme, alan, liste, bildirim) yazıyorsun.

## Ne zaman değil

- Yalnız veri, istek ya da durum mantığı değişiyor ve ekranda görünen hiçbir şey değişmiyor.
- Projenin tasarım sistemini (değişkenler ve bileşen seti) yazmak: o, kullanıcının görsel yön kararıyla yapılan ayrı
  bir iştir; bu skill onu kendiliğinden başlatmaz.

## Adımlar

1. **Tasarım sistemine bak.** Önce `docs/tasarim-sistemi.md` belgesini oku; renk, yazı, aralık, köşe ve gölge
   değerlerini oradan al. Belge yoksa **yeni görsel karar alma**: renk, yazı ailesi, aralık, köşe ya da gölge seçme.
   Var olan ekranların görünümünü sürdür (aynı Tailwind sınıflarını, aynı ortak parçaları kullan) ve bitiş kaydının
   `denenmedi` ya da `ozet` alanına tasarım sisteminin olmadığını yaz. İş, var olan ekranlarda karşılığı olmayan yeni
   bir görsel karar gerektiriyorsa (yeni bir renk, yeni bir yazı boyu, yeni bir yerleşim kalıbı) seçimi kendin yapma:
   bitiş kaydına durumu "soru" yaz, gereken kararı ve seçenekleri söyle, dur.
2. **Koddan önce kısa bir tasarım planı yaz.** Yeni ekranda ya da görünümü değişen işte, bitiş kaydının `kararlar`
   alanına girecek kısa bir plan:
   - Renk: 4 ile 6 adlı değer (ad ve değer; adı rolünü söyler: zemin, metin, vurgu, hata).
   - Yazı: aile ve ölçek (başlık, gövde, küçük metin boyları ve ağırlıkları).
   - Yerleşim: tek cümle ve küçük bir ASCII çizim; içerik sola mı, ortaya mı hizalı.
   - İlkeler: bu ekranı işine uygun kılan iki üç cümle.
   Değerler tasarım sisteminden ya da var olan ekranlardan gelir; birini kendin seçmen gerekiyorsa 1. adıma dön.
   Planı işin tanımına karşı gözden geçir: her parçası bu işin bir ihtiyacına mı bağlanıyor, yoksa her ekrana
   konabilecek alışkanlık mı? Bağlanmayanı çıkar, neyi neden değiştirdiğini kararlara yaz.
3. **Kalite tabanını kur.** Duyurmadan, her ekranda:
   - dar ekranda çalışır: telefon genişliğinde taşma ve yatay kaydırma yoktur;
   - klavye odağı görünür: her etkileşimli öğeye sekmeyle gelinir ve odak halkası görünür (`outline-none` tek başına
     kullanılmaz);
   - azaltılmış hareket tercihine uyar: geçiş ve canlandırma `motion-reduce:` ile kapanır;
   - karşıtlık yeterlidir: metin ile zemini arasındaki karşıtlık okunur düzeydedir (WCAG AA: gövde metninde 4.5:1).
4. **Üç durumu tasarla.** Her ekranda boş, yükleniyor ve hata durumu vardır:
   - boş: kullanıcıya ne yapabileceğini söyler ve ilk eylemi gösterir;
   - yükleniyor: ekranın yerini tutar, yerleşimi zıplatmaz;
   - hata: ne olduğunu ve nasıl düzeleceğini söyler, özür dilemez, belirsiz kalmaz ("Bir şeyler ters gitti" yazılmaz);
     yeniden denenebiliyorsa yolu gösterir.
5. **Arayüz metnini yaz.** Adlar kullanıcının anlayacağı sözcüklerdir, sistemin iç adları değil. Etken çatı kullan:
   düğme ne olacağını söyler ("Gönder" değil "Siparişi ver"). Eylemin adı akış boyunca aynı kalır: düğmede "Kaydet"
   ise bildirimde "Kaydedildi". Her metin tek bir iş görür; dolgu cümle yazılmaz.
6. **Ortak parçayı önce ara.** `frontend/src/shared/ui` altında karşılığı var mı bak, varsa onu kullan. Yoksa ve parça
   en az iki yerde gerekecekse oraya ekle; tek yerde kullanılacak parça ortak yapılmaz, ekranın yanında durur (KU-005).
7. **Kendi işini eleştir.** Ortamın izin veriyorsa ekranı aç, ekran görüntüsü al ve bak: dar ekranda, klavyeyle,
   üç durumda. Göremediysen bitiş kaydının `denenmedi` alanına yaz. İşe hizmet etmeyen süslemeyi (gereksiz çerçeve,
   gölge, gradyan, her karta hover canlandırması, içerik sıra değilken numaralandırma) çıkar.

## Yapma

- Tasarım sistemi yokken "şimdilik" diye renk, yazı ya da aralık seçme; bir kez giren değer her ekrana yayılır.
- Görünümü bir ekranda başka, öbüründe başka yapma: aynı iş aynı biçimde görünür.
- Yalnız mutlu yolu yazma: boş liste, yavaş istek ve başarısız istek her ekranda olur.
- Odak halkasını kaldırma, yalnız renkle anlam taşıma (hata kırmızı yazı ve metinle de söylenir).
- Arayüz metninde iç adları, kısaltmaları ya da teknik hata iletisini kullanıcıya gösterme.
- Tek ekranda kullanılan parçayı `shared/ui` altına taşıma; ortak parçayı bir ekran için değiştirme.

## İlgili skill'ler

- `kod-tasarimi`: ortak parça ya da soyutlama eklerken silme testi için.
- `test-yaz`: ekranın davranışını (durumlar, eylemler) sınayan testi koddan önce yazmak için.
- `tasarla`: tasarım sistemi ya da görsel yön gibi geri alması pahalı bir karar konuşulacaksa; kararı kullanıcı verir.

## Sınırlar

Bu bir yöntemdir; planın yazıldığını, üç durumun ve kalite tabanının kurulduğunu araç denetlemez. İnceleme, işin
yolları `frontend/` altındaysa boş, yükleniyor ve hata durumlarına ve klavye odağına bakar; eksik olanı bulgu yazar.
Karşıtlık ve ekran görüntüsü ortamda araç yoksa doğrulanamaz; o durumda bitiş kaydında `denenmedi` olarak görünür.
Projenin tasarım sistemi henüz yoktur: bu skill o boşluğu doldurmaz, yalnız boşlukta yeni karar alınmasını önler.

Kaynak: anthropics/skills `frontend-design` (commit e4bb5d9), Apache-2.0 lisanslı; metin kopyalanmadı, fikir Türkçeye ve bu deponun kurallarına uyarlandı.
