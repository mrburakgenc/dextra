---
kimlik: KR-014
tur: karar
durum: taslak
surum: 1
baslik: Frontend kanondaki kurallarla kurulur; doğrulama iki tarafta da Zod'dur ve form taslağı saklanmaz
agirlik: cift-yonlu
tip: mimari
tarih: 2026-11-24
baglam: TS-001
---
Web arayüzü için kanonun frontend kuralları alınır ve üç yerde sapılır: doğrulama iki tarafta ayrı dosyalarda ama ikisinde de Zod ile yazılır, form taslağı tarayıcıda saklanmaz ve tarih ile para biçimi tek yardımcıda sabittir; iki tarafın kuralı aynı dilde olduğu için ayrışma kolay görülür, karşılığında backend kanondaki doğrulama aracından ayrılır ve yarıda kalan form baştan doldurulur.

> Bu taslak kullanıcının 2026-11-24 seçimlerinden derlendi; metni ajan yazdı. Kanonun frontend belgesinin (`kb/_gelen/IRON_RULES_FRONTEND.md`) yalnız kural listesi (satır 5–81) ve üç bölümü (9b, FE-FORM-06, 13) okundu; öbür bölümler kurala çevrilirken okunacak. Ağırlık çift yönlüdür. Bağımsız inceleme yapılmadı; web dilimi henüz kurulmadı ve kod yoktur.

## Bağlam
- Kullanıcı kanonun tamamını uygun buldu (2026-11-21); kanonda yaklaşık 70 frontend kuralı vardır: derleyici sıkılığı, sunucu ve istemci sınırı, Server Action, durum yönetimi, form, erişilebilirlik, performans, dosya düzeni, hook, yetki, iz, yönlendirme, tarih ve para.
- Frontend'e başka kararlardan gelenler: tarayıcı backend'e yalnız aracı katmandan ulaşır, çerez yalnız aracı katmanda yaşar, yenileme istek girişinde yapılır, adres bilgisi imzalanır, mobil de aracı katmandan geçer (KR-009); ekran yetki kurallarını CASL ile değerlendirir ve `<Can>` bileşeniyle sorar, son sözü sunucu söyler (KR-010 Seçim 37 ve 38); teknik günlüğe kişisel veri yazılmaz (KR-013); izleme araçları ilk dilimde kurulmaz (TS-001).
- Kanon doğrulamayı iki ayrı araçla ister ve karıştırmayı yasaklar: frontend'de Zod, backend'de komut sınıfı üzerinde class-validator (`IRON_RULES_SHARED.md` VAL-01, VAL-02; `IRON_RULES_FRONTEND.md` FORM-04).
- NestJS 12 belgesi (okundu 2026-11-24; "Validation" ve "Controllers" bölümleri): şemayla doğrulama çatının kendi parçasıdır (`StandardSchemaValidationPipe`, çekirdek paketten gelir) ve Zod örnekleriyle anlatılır; şema `@Body`, `@Query` ve `@Param` parametrelerine verilir, parametrenin tipi şemadan türer, hata biçimi özelleştirilebilir. Belgedeki uyarı: genel doğrulayıcı yalnız şema bildiren parametreyi doğrular, şemasız parametreyi olduğu gibi geçirir. Bu depoda denenmedi.
- Kullanıcının 2026-11-17 talimatı: ajan kişisel veriyi gizleme işini kendiliğinden eklemez, sorar.

## Seçenekler
### Doğrulamanın yazıldığı yer
- A — İki ayrı kaynak, iki ayrı araç (kanon): frontend'de Zod, backend'de class-validator.
- B — Tek ortak şema: bir kez yazılır, iki taraf da kullanır; yüzeyler arasında ortak paket ister ve mobil ayrı çalışma alanında olduğu için ona ayrıca taşınır.
- C — İki ayrı dosya, aynı dil (seçildi): frontend'de de backend'de de Zod; ortak paket yoktur.
### Form taslağının tarayıcıda saklanması
- A — Kişisel alanlar hariç saklanır (kanon): "hangi alan kişisel" işareti gerektirir.
- B — Saklanmaz (seçildi).
- C — Her şey saklanır: ortak bilgisayarda kişisel veri sonraki kişiye görünür.
### Tarih ve para biçimi
- A — Sabit: Türkçe, İstanbul saati, Türk lirası (seçildi; kanon).
- B — Proje ayarı.
- C — Kullanıcı başına tercih.

## Seçim
Kullanıcı seçimleri (2026-11-24):
1. Doğrulama frontend'de ve backend'de ayrı dosyalarda, ikisinde de Zod ile yazılır; ortak paket yoktur ve son sözü sunucu söyler. Ajanın önerisi kanondaki iki ayrı araçtı; kullanıcı aynı dili seçti, sonra "a daha mı güvenli" diye sordu ve belge doğrulamasının ardından seçimini yineledi ("c kalsın"). Kanondan sapmadır (VAL-02). Komut uçta, şemadan çıkan veri ve isteği yapanın kimliğiyle açıkça kurulur.
2. Form taslağı tarayıcıda saklanmaz; ihtiyaç duyan proje ekler. Ajan bunu kendiliğinden almadı, sordu.
3. Tarih Türkçe ve İstanbul saatiyle, para Türk lirası olarak ve kuruş cinsinden tam sayıdan gösterilir; ekranlar kendi başına biçimlemez, ortak koddaki tek yardımcıyı çağırır.

Kanondan olduğu gibi alınacaklar (satırları kurala çevrilirken okunacak): derleyici ve React sıkılık kuralları; sunucu ve istemci sınırı ile Server Action kuralları; durum yönetimi; form kuralları (taslak hariç); erişilebilirlik; performans; dosya düzeni ve Atomic Design; hook kuralları; yetkinin `<Can>` ile sorulması; iz kimliğinin taşınması; yönlendirme grupları.

Açık:
- Seçim 1'in sonucu (ajan): backend'de doğrulama komut sınıfının üstündeki dekoratörlerden Zod şemasına geçer; kanondaki "komut sınıfı isteğin biçimidir" kuralının (TS-001 "Kanon harmanı" Ç3, kullanıcı teyidi 2026-11-24) yeni hâli yazılmadı ve isteği yapanın kimliğinin komuta nasıl girdiği (KU-013) buna bağlıdır.
- İki dosyanın eşleşmesini denetleyen bir araç yoktur; kanon bunu elle denetler.
- Hata izleme aracı (kanondaki üçüncü kanal) ilk dilimde kurulmaz.
- Web dilimi için kütüphanelerin ve Next.js'in sürümleri ölçülmedi.

## Sonuçlar
- Olumlu: iki tarafın kuralı aynı dilde yazıldığı için fark gözle ve araçla kolay görülür; yüzeyler arasında ortak çalışan kod yoktur; tarayıcıda form verisi birikmez; biçim tek yerde durur.
- Olumsuz: backend kanondaki ve BADI'deki doğrulama aracından ayrılır ve komut sınıfı deseni yeniden tanımlanmak zorundadır; iki dosya yine ayrışabilir (form geçirir, sunucu reddeder); uzun formu yarıda bırakan kullanıcı baştan başlar; başka bir ülke için biçim yardımcısı ayara çevrilmek zorunda kalır.
- Yükümlülük (kural adayları; taslakları açılacak):
  1. Doğrulama frontend'de ve backend'de Zod ile, ayrı dosyalarda yazılır; frontend ile backend arasında ortak çalışan paket yoktur.
  2. Sunucu, ekranın doğrulamasına güvenmez; her isteği kendi şemasıyla doğrular. Uçtaki her gövde, sorgu ve yol parametresi şema taşır; şemasız parametre doğrulanmadan geçeceği için hatadır ve makineyle denetlenir (öneri ajan; kullanıcı teyidi, 2026-11-24).
  3. Form verisi tarayıcının kalıcı deposuna yazılmaz.
  4. Tarih ve para yalnız ortak biçim yardımcısıyla gösterilir.
- Ortak parça: frontend'in ortak kodunda biçim yardımcıları ve yetki bileşeni; adları ve sınırları tasarlanmadı.

## Doğrulama
Denetim kimliği ve ölçüm tarihi henüz yok; kod yazılmadı.
Öneri (ajan). Birim: çağrı ve dosya.
- Ekranın geçirdiği ama sunucu şemasına uymayan istek reddedilir.
- Tarayıcının kalıcı deposuna form verisi yazan kod lint'te hata verir.
- Tarihi ya da parayı yardımcı dışında biçimleyen kod lint'te hata verir.
