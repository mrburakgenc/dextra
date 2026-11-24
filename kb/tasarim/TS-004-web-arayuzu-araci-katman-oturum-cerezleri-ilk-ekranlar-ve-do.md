---
kimlik: TS-004
tur: tasarim
durum: taslak
surum: 1
baslik: Web arayüzü: aracı katman, oturum çerezleri, ilk ekranlar ve dosya düzeni
agirlik: cift-yonlu
tarih: 2026-11-24
---
Next.js uygulamasının ilk dilimini tanımlar: tarayıcı backend'e yalnız Next.js sunucusundan ulaşır, belirteçler betiğin okuyamadığı çerezlerde durur, backend'e giden her istek imzalı istemci adresiyle gider ve ekran yetkiyi `<Can>` ile sorar. Buradaki seçimlerin hepsi ajan kararıdır (kullanıcı devretti, 2026-11-24 gecesi); kabul edilmiş karar değildir.

## Sorun
- Amaç: kullanıcı tarayıcıdan giriş yapar, korumalı ekranları görür ve yönetim işlerini yapar; tarayıcıya belirteç, backend adresi ya da aracı katman sırrı sızmaz.
- Kapsam dışı (bu dilimde): yenileme (backend'de "yenile" ucu yok; oturum erişim belirtecinin süresi kadar, 15 dakika yaşar ve sonra giriş ekranına dönülür), tek kullanımlık kodla giriş, mobil, hata izleme aracı, tarayıcıyla koşan uçtan uca test takımı (tarayıcı indirmesi ister).
- Başarının ölçüsü: "Doğrulama" bölümündeki maddeler.

## Kısıtlar
- KR-009: tarayıcı backend'e yalnız aracı katmandan ulaşır; çerez yalnız aracı katmanda yaşar; istemci adresi imzalanır (TS-002 AK-8'deki biçim).
- KR-014: doğrulama iki tarafta ayrı dosyalarda Zod ile yazılır; ortak paket yoktur; form taslağı tarayıcıda saklanmaz; tarih ve para tek yardımcıdan gösterilir.
- KR-010 Seçim 37 ve 38: ekran yetki kurallarını CASL ile değerlendirir ve `<Can>` ile sorar; son sözü sunucu söyler.
- KR-006: frontend, backend ile aynı çalışma alanındadır; iki yüzey arasında ortak çalışan kod yoktur.
- KU-005: gerekmeyen kitaplık kurulmaz.
- İşçi oturumlarının ağı kapalıdır: paketleri ana oturum kurar; derleme ve test ağa çıkmadan çalışır (yazı tipi indirmesi ve telemetri yok).
- Bu gece `.gitignore` değiştirilemiyor (kişisel genel ayardaki kural kullanıcıya soru çıkarıyor) ve işçiler `.env` ile başlayan dosyalara dokunamıyor. Bu yüzden derleme çıktısı zaten yok sayılan `dist/` klasörüne yazılır; ortam değişkenlerinin adları kodda ve bu kayıtta durur.

## Değişmezler
1. Tarayıcıya giden hiçbir cevap, betik ya da okunabilir çerez belirteç taşımaz; oturum çerezleri betiğe kapalıdır (httpOnly).
2. Backend'e giden her istek sunucu tarafında kurulur; backend adresi ve aracı katman sırrı istemci paketine girmez.
3. Backend'e giden her istek imzalı istemci adresi başlıklarını taşır; imzalanan metin backend'deki tanımla aynıdır (adres, tarayıcı bilgisi ve zaman; aralarında satır sonu).
4. Değiştiren her iş Server Action'dır; girdi önce ekranın Zod şemasıyla doğrulanır, son sözü backend söyler.
5. Backend `kimlik_gerekli` (401) dönerse oturum çerezleri silinir ve giriş ekranına dönülür.
6. Ekran bir işi `<Can>` ile gizleyebilir ama izin kararını vermez; backend'in `yetki_yok` (403) cevabı ekranda ileti olarak gösterilir.

## Yapı
```
frontend/
  src/app/                          yalnız yönlendirme ve düzen
    (acik)/giris/                   giriş ekranı
    (acik)/parola-belirle/          bağlantıyla parola belirleme
    (panel)/layout.tsx              oturum ister; yetki kurallarını yükler; menü
    (panel)/page.tsx                karşılama
    (panel)/kullanicilar/           yönetim ekranları (backend'deki yönetim işlerini izler)
  src/features/kimlik/              ekran parçaları, Zod şemaları, Server Action'lar, backend çağrıları
  src/shared/
    backend/                        backend'e istek: adres, imza, belirteç başlığı, hata eşleme (yalnız sunucu)
    oturum/                         oturum çerezlerinin okunması, yazılması, silinmesi (yalnız sunucu)
    yetki/                          kuralların ekrana taşınması ve <Can>
    bicim/                          tarih ve para
    ui/                             düğme, girdi, tablo gibi küçük parçalar
```
- Paketler (sürümler paket kayıt defterinden okundu, 2026-11-24): next 16.4.6, react ve react-dom 19.3.1, zod 4.6.7, tailwindcss 4.3.5, @casl/ability 7.1.3, @casl/react 7.1.0, @testing-library/react 16.3.3, jsdom 31.0.1; vitest ve typescript backend ile aynı ana sürümde tutulur.
- İlk dilimde kurulmayanlar: TanStack Query ve zustand (TS-001'deki yığın listesinde var; onları gerektiren ilk ekranla gelir) ve Playwright.
- Çerezler: `dextra_erisim` (erişim belirteci), `dextra_yenileme` (yenileme belirteci), `dextra_cihaz` (cihaz sırrı). Üçü de betiğe kapalıdır (httpOnly), SameSite=Lax ve Path=/ taşır, üretimde Secure'dur. Erişim çerezi belirtecin süresi kadar, öbür ikisi 7 gün yaşar. Yenileme ucu gelene kadar öbür ikisi yalnız saklanır.
- Ortam değişkenleri: `BACKEND_ADRESI` (örnek: `http://localhost:3001`) ve `ARACI_KATMAN_SIRRI` (backend'deki ile aynı değer; en az 32 karakter). İkisi de yalnız sunucuda okunur; eksikse ilk kullanımda açık bir hata verir. Değerleri depoya yazılmaz.
- İstemci adresi: aracı katman isteğin `x-forwarded-for` başlığının ilk değerini, o yoksa bağlantının adresini kullanır. Açık: üretimde önde hangi vekilin duracağı ve o başlığa ne kadar güvenileceği dağıtım kararıdır.
- Yetki kuralları: `(panel)` düzeni "yetkilerim" ucunu sunucuda çağırır ve kuralları istemcideki yetki sağlayıcısına verir; kuralların biçimi backend'in o uçtan döndürdüğüdür.
- Hata eşleme: backend'in `{ kod, ileti, ayrinti }` gövdesi tek yerde okunur; `dogrulama_hatasi` alan hatalarına, `kimlik_gerekli` giriş ekranına dönüşe, öbür kodlar ekrandaki iletiye çevrilir.
- Sahte istek koruması: değiştiren işler yalnız Server Action'dan geçer (çatının kaynak denetimi) ve çerezler SameSite=Lax'tır; çerezi başlığa çeviren başka bir yol (geçiş rotası) yazılmaz. KR-014 bulgu 8'in bu dilimdeki karşılığıdır; mobilin geçiş yolu tasarlanmadı.

## İlk ekranların sözleşmesi
Ajan kararı (2026-11-25 gecesi); backend'deki uçlar GV-028 ve GV-030'da yazıldığı gibidir. Backend'den hiçbir şey içe aktarılmaz; biçimler ön yüzde ayrı yazılır.
- Backend uçları: `POST kimlik/oturum/giris` gövdesi `{ kullaniciAdi, parola }`, başarıda 200 ve `{ erisimBelirteci, yenilemeBelirteci, cihazSirri, oturumId }`, her başarısızlıkta 401 `kimlik_gerekli` (neden ayırt edilmez) · `POST kimlik/oturum/cikis` oturumludur, başarıda gövdesiz 204 · `POST kimlik/parola/belirle` gövdesi `{ kod, parola }`, başarıda gövdesiz 204; parola en az 15, en çok 128 karakterdir (Unicode kod noktasıyla sayılır; başka kural yok).
- Ekranlar: `/giris` (kullanıcı adı ve parola) · `/parola-belirle?kod=…` (parola ve tekrarı; kod adresten okunur) · `/` korumalı karşılama (üstte uygulama adı ve Çıkış düğmesi).
- Giriş: başarıda üç çerez yazılır ve `/` adresine gidilir; başarısızlıkta tek ileti gösterilir ("Kullanıcı adı ya da parola hatalı").
- Çıkış: backend'e çıkış isteği atılır; sonuç ne olursa olsun çerezler silinir ve `/giris` adresine gidilir.
- Korumalı düzen: erişim çerezi yoksa backend'e gidilmeden `/giris` adresine yönlendirilir. Bu bir kolaylıktır, güvenlik denetimi değildir; kararı backend verir.
- Oturum bitti yolu (GV-045 incelemesi): çatı, sunucu bileşeninin çerez değiştirmesine izin vermez. Backend 401 dönünce sunucu bileşeni `/oturum-bitti` rota işleyicisine yönlendirir; işleyici yalnız üç çerezi siler ve `/giris` adresine yönlendirir, backend'e istek atmaz. Server Action içindeki 401 çerezleri doğrudan siler. Değişmez 5 böyle uygulanır; bu rota "çerezi başlığa çeviren geçiş rotası" değildir.
- Backend isteğinin yolu (GV-045 incelemesi): yol tek `/` ile başlar; `//` ile başlayan, şema taşıyan ya da çözümlendiğinde kökeni `BACKEND_ADRESI`'nin kökeninden farklı olan yol istek atılmadan reddedilir. Aksi hâlde belirteç ve imzalı başlıklar başka bir kökene gidebilir.
- Bozuk `BACKEND_ADRESI` için fırlatılan hata adresin değerini taşımaz (çatı sunucu hatalarını günlüğe yazar).
- Form kuralları: etiket girdiye bağlıdır; alan hatası alanın yanında, genel hata formun üstünde ve ekran okuyucuya duyurulacak biçimde gösterilir; gönderim sürerken düğme kapalıdır; form verisi tarayıcının kalıcı deposuna yazılmaz (KR-014).

## Yetki kurallarının ekrana taşınması
Ajan kararı (2026-11-25 gecesi); backend ucu GV-032'de yazıldığı gibidir.
- Backend ucu: `GET kimlik/oturum/yetkilerim` (oturumlu) `{ kurallar: [...] }` döner. Her kural bir CASL kuralıdır: `action` (eylem), `subject` (kaynak; model adı), varsa `conditions` (koşul; bütün kayıtlarda yoktur), varsa `fields` (kolonlar; bütün kolonlarda yoktur) ve `yetenekId`. Koşul, backend'in sorguda kullandığı biçimdedir (Prisma sorgu koşulu; `@casl/prisma`).
- Ekran aynı koşulu aynı kitaplıkla değerlendirir (KR-010 Seçim 38): ön yüze `@casl/prisma` kuruldu; koşul yorumlayıcısı onun veritabanı istemcisi istemeyen girişinden alınır. Reddedilen: koşulu ön yüzde elle yorumlamak (iki ayrı yorumlayıcı zamanla ayrışır).
- Akış: korumalı düzen kuralları sunucuda çeker ve istemcideki yetki sağlayıcısına verir; ekran parçaları `<Can>` ile sorar. Kurallar kişinin kendi kurallarıdır ve tarayıcıya bilerek gider; belirteç gitmez.
- Soru biçimleri: tür düzeyi ("Kullanici oluşturabilir miyim": menü ve düğmeler), kayıt düzeyi ("bu kaydı güncelleyebilir miyim": kayıt, türüyle etiketlenerek sorulur) ve kolon düzeyi ("bu kaydın şu kolonunu"). Alan izni ekranda kayıt örneğiyle sorulur (KR-014 bulgu 10).
- Sınır: ekran yalnız kaydın ekrana gelmiş kolonlarına bakan koşulu doğru değerlendirir; ekrana gelmeyen kolona bakan koşulda ekran "hayır" der ve kararı backend verir (KR-014 bulgu 4; ekran gizleyebilir, izin veremez).
- Kurallar oturum boyunca her sayfa isteğinde yeniden çekilir (düzen sunucuda çalışır); ayrı bir tazeleme düzeni yazılmadı.

## Yönetim ekranları
Ajan kararı (2026-11-25 gecesi); backend uçları TS-002 AK-39'daki ortak sözleşmeyle yazılır.
- Adresler: `/kullanicilar` (liste), `/kullanicilar/yeni` (aç), `/kullanicilar/[id]` (kayıt ve işleri). Öbür kaynaklar aynı kalıbı izler (`/gruplar`, `/roller`, `/uyelikler`, `/yetenekler`).
- Liste ekranı sunucu bileşenidir: sayfa, sıralama ve süzgeç adresin sorgusunda durur (`?sayfa=2&sirala=-olusturmaZamani&pasif=false`); ekran backend'in `{ kayitlar, sayfa, boyut, sonrakiVar }` cevabını tabloya döker; toplam sayı yoktur, "Önceki" ve "Sonraki" bağlantıları vardır.
- Kayıtta gelmeyen kolon (kişinin göremediği) tabloda boş işaretle ("—") gösterilir; ekran onu istemez ve tahmin etmez.
- Menü korumalı düzendedir; her bağlantı `<Can>` ile sorulur (tür düzeyi: o kaynağı okuyabiliyor mu). İşi başlatan düğmeler de `<Can>` ile sorulur; kayıt düzeyindeki soru kayıt örneğiyle yapılır.
- Backend `yetki_yok` (403) dönerse ekran "Bu sayfayı görme yetkin yok" iletisini, `bulunamadi` (404) dönerse "Kayıt bulunamadı" iletisini gösterir; `kimlik_gerekli` (401) oturum bitti yoluna gider.
- Bilinen sınır (GV-051 incelemesi): korumalı düzen sayfalar arası gezintide yeniden çizilmez; kurallar tam sayfa yüklemesinde tazelenir. Yetkisi oturum sırasında değişen kişi, sayfayı yenileyene kadar eski menüyü görebilir; kararı yine backend verir. Kuralları tazeleme düzeni tasarlanmadı.
- `<Can>` güvenli tarafta kalır: ekranın değerlendiremediği bir koşul (yorumlayıcının tanımadığı biçim) hata fırlatmaz, "hayır" sayılır.
- Bir kez gösterilen kod (yeni kullanıcının ya da üretilen bağlantının parola belirleme kodu) işin cevabında ekranda bir kez gösterilir; adrese, çereze ya da tarayıcı deposuna yazılmaz; sayfa yenilenince kaybolur.

## Seçenekler
### Veri çekme
- A — Sunucu bileşeni ve Server Action (seçildi): tarayıcıdan backend'e giden yol yoktur; ek kitaplık gerekmez. Bedel: etkileşimli listelerde her değişiklik sunucuya gider.
- B — İstemcide TanStack Query ve geçiş rotaları: etkileşimli listelerde daha rahat; her uç için bir geçiş rotası ve ayrı sahte istek koruması ister.
### Derleme çıktısının yeri
- A — `dist/` (seçildi): `.gitignore` değişmeden yok sayılır. Bedel: çatının varsayılanından ayrılır.
- B — `.next/` (varsayılan): `.gitignore` değişikliği ister.
### Test
- A — Vitest ve Testing Library (seçildi): ağsız ve hızlı. Bedel: gerçek tarayıcıyı ve gerçek backend'i sınamaz.
- B — Tarayıcıyla uçtan uca test: gerçek akışı sınar; tarayıcı indirmesi ve çalışan backend ister. Ertelendi; ilk dilimi ana oturum tarayıcıyla elle sınar ve kanıtını rapora koyar.

## Hata modları
| Durum | Ne olur |
|---|---|
| Backend kapalı | İş "şu an ulaşılamıyor" iletisi döner; çerezler silinmez |
| Erişim belirtecinin süresi doldu | Backend 401 döner, çerezler silinir, giriş ekranı açılır (yenileme gelene kadar) |
| Aracı katman sırrı iki tarafta farklı | Her istek 401 döner, giriş de olmaz; açılış denetimi sırrın varlığını ve boyunu yakalar, eşitliğini yakalayamaz |
| İki makinenin saati 60 saniyeden çok ayrışır | İmza penceresinin dışında kalır; her istek 401 döner |
| Kullanıcı izni olmayan adresi elle açar | Sunucu bileşeni backend'den 403 alır; "yetkin yok" ekranı gösterilir |

## Aşamalar
1. İskelet: Next.js uygulaması, derleyici ve lint ayarı, Tailwind, Vitest; karşılama sayfası; komutlar (`typecheck`, `lint`, `build`, `test`).
2. Aracı katman: backend isteği (adres, imza, belirteç), oturum çerezleri, hata eşleme, biçim yardımcıları.
3. Giriş, çıkış, korumalı düzen, "yetkilerim" ve `<Can>`; bağlantıyla parola belirleme ekranı.
4. Yönetim ekranları: kullanıcı listesi ve kullanıcı aç ile başlar; backend'deki yönetim işlerini izler.
5. Sonra: yenileme (backend ucu gelince), tarayıcıyla uçtan uca test, TanStack Query gerektiren ekranlar.

## Doğrulama
Ölçüm tarihi henüz yok; kod yazılmadı.
- İmza: aracı katmanın ürettiği başlıklar backend'in doğrulayıcısından geçer (aynı girdi aynı imzayı verir; backend'deki test değerleriyle karşılaştırılır).
- İstemci paketinde backend adresi, aracı katman sırrı ve belirteç yoktur (derleme çıktısında arama).
- Giriş akışı: doğru bilgiyle çerezler yazılır ve panele gidilir; yanlış bilgiyle tek ileti gösterilir; çıkışta çerezler silinir.
- `<Can>`: kuralı olmayan iş ekranda görünmez.
- Elle uçtan uca: ana oturum backend'i geçici veritabanıyla açar ve tarayıcıyla giriş yapar; ekran görüntüsü gece raporuna girer.

## Çürütme
Bağımsız inceleme yapılmadı: iş çift yönlüdür ve gece koşusunda zaman koda ayrıldı. Bilinen zayıf yerler yukarıda "Açık" diye işaretlidir (istemci adresinin vekil arkasında okunması; mobilin geçiş yolu; yenileme olmadan 15 dakikalık oturum).
