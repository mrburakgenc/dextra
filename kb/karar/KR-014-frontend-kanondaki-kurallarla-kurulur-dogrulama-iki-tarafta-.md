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

## Kabulden önce kapanması gerekenler
Bağımsız inceleme (2026-11-24; çok oturumlu iş akışı, salt okuma): bu kararı bir oturum çürütmeye çalıştı, bulgularını ikinci bir oturum metne karşı tek tek sınadı. Hüküm: İmzalamam: KR-010 Seçim 37/38 yetenek satırının CASL kuralına nasıl derlendiğini yazmadan "birleşmez" diyor ve sunucudaki alan izni cümlesi kendi Seçim 37'siyle çelişiyor; KR-014 ise aynı gün teyit edilen "komut isteğin biçimidir" kuralını etiketsiz bir cümleyle tersine çeviriyor ve tek kazancı olan "ayrışma kolay görülür" iddiasını gösteren araç ya da sınama taşımıyor (KR-014 tek başına düzeltmelerle imzalanır; … Bulgu sayısı 12; ikinci oturumun çürütebildiği bulgu 0. "Doğrulandı" ya da "kısmen" denen bulgular aşağıdadır; ağırlıklar ikinci oturumun düzelttiği ağırlıklardır. Metinler kısaltılmıştır; hiçbir şey kodla sınanmadı. Ajan bulguları henüz tek tek işlemedi; "açık" yazan her satır bekliyor. Bu kümenin bulgularının çoğu KR-010'un Seçim 37 ve 38'i (motorun CASL'a derlenmesi ve ekran eşliği) hakkındadır; KR-010'da bu tabloya atıf vardır.

| # | Ağırlık | İlk kodlama adımını bekletir | Kullanıcı kararı ister | Bulgu | Önerilen düzeltme | Durum |
|---|---|---|---|---|---|---|
| 1 | orta | evet | hayır | Satır 68 ve Yükümlülük 14 (satır 115) veri kararında alan izninin kayıt örneğiyle sorulmasını ister; bu, CASL'in şartı sunucu belleğinde değerlendirmesidir ve aynı belgenin Yükümlülük 1'i (satır 113), Ölçüt 3'ü (satır 30) ile reddettiği B seçeneğidir (satır 46). … | Satır 68 ve 115'i "sunucuda kolon indirimi yetenek başına sorguyla yapılır; kayıt örneğiyle soru yalnız ekranda sorulur" diye yeniden yaz ve satır 71'deki "kütüphaneyle mi sorguyla mı" açığını kaldır; Seçim 37 bunu zaten bağlıyor. | kapandı (ajan tanımı, 2026-11-24; KR-010 Derleme eşlemesi): sunucuda kolon indirimi yetenek başına sorguyla, kayıt örneğiyle soru yalnız ekranda |
| 2 | orta | evet | hayır | Karar "satırlar birleştirilmez, yazma yetenek yetenek denetlenir" kısıtını yazıyor ama yetenek satırının CASL kuralına nasıl derlendiğini yazmıyor; oysa CASL aynı eylem ve türdeki kuralları "veya" ile toplar, birleşik sorgu koşulu hangi kaydı hangi yeteneğin tuttuğunu vermez, şartsız kural bütün kayıtları ve alansız kural bütün … | Seçim 38'e eşleme cümleleri ekle: bir yetenek satırı kimliğini taşıyan tek kuraldır; işareti olmayan ve içeriği boş ya da boşalmış satır derlenmez; … | kapandı (ajan tanımı; KR-010 Derleme eşlemesi): satır kimliğini taşıyan tek kurala derlenir; boşalan satır kural üretmez; iki sınama eklenecek |
| 3 | orta | hayır | evet | Seçim 1'in son cümlesi ("komut uçta, şemadan çıkan veri ve kimlikle açıkça kurulur") kullanıcı seçimleri arasında etiketsiz durur ama ajanın yan sonucudur (TS-001 satır 863) ve aynı gün teyit edilen Ç3'ü ("komut DTO'nun kendisidir", TS-001 satır 121-122; … | Kullanıcıya tek soru sor: (a) şema application'da durur, komut tipi ondan türer ve kimlik ayrı argümandır; (b) şema presentation'da, komut ayrı sınıftır ve controller eşler; (c) interceptor kalır. … | açık |
| 4 | orta | hayır | evet | Eşlik "işleç başına sınama" ile ölçülüyor (satır 30, 114, 141), oysa ayrışma işleç × kolon tipi × boş değer × kaydın ekrana geliş biçiminde doğar; ikinci turun "tek motor" ile kapatılan 28. … | Yükümlülük 13'ü daralt: eşlik yalnız kaydın kendi, ekrana gelen kolonlarına bakan şartlar için ve ekrana giden (JSON) kayıt biçiminde ölçülür; sınama matrisi işleç × tip × boş değer olarak yazılır. … | açık |
| 5 | hafif | hayır | evet | Kuralları ekrana veren uç yalnız adıyla var ("yetkilerim"); koşul dili, yer tutucuların çözülmüş gidip gitmediği, sürüm damgası, yenileme tetiği ve boyut yazılmamış. Kişi yalnız kendi satırlarını aldığı için başkasının yetenek satırı sızmaz; … | KR-010'a "yetkilerim" sözleşmesini yaz (koşul dili, çözülmüş yer tutucu, sürüm damgası; ekran her cevaptaki sürüm değişince kuralları yeniden çeker) ve alan adı zorunluluğunu bu karara taşı. … | açık |
| 6 | orta | hayır | hayır | "Şemasız parametre hatadır ve makineyle denetlenir" yükümlülüğünün denetimi tanımlı değil ve Doğrulama'nın üç maddesi arasında yok; dayandığı çatı davranışı bu depoda denenmedi (satır 20). … | Yükümlülük 2'ye denetimin biçimini ve kapsamını yaz (lint mi, bütün uçları gezen sınama mı; başlık ve özel parametre dekoratörleri dahil mi) ve Doğrulama'ya ekle. … | açık |
| 7 | hafif | hayır | hayır | Karar cümlesi (satır 12) ve Olumlu satırı (52) ayrışmanın "gözle ve araçla kolay görüldüğünü" söyler; Açık satırı (47) eşleşmeyi denetleyen araç olmadığını söyler ve Doğrulama'daki tek ilgili madde (64) sunucunun reddetmesini sınar, ayrışmanın görülmesini değil: bu bir iddiadır, gösterilmiş değildir. … | Ya "araçla" iddiasını sil ve karar cümlesini "gözle karşılaştırılır" diye daralt, ya da aracı tanımlayıp Doğrulama'ya ekle (iki şemayı ortak biçime döküp karşılaştıran, yalnız sınamanın içe aktardığı sözleşme sınaması). … | açık |
| 8 | hafif | hayır | hayır | KR-009 sahte istek korumasını "frontend kümesi"ne bırakır (satır 210; TS-001 satır 319); o kümenin kararı olan KR-014 konuyu ne seçimlerinde ne açık listesinde anar, KU-010 ise kanondaki origin guard'ını çerez görmeyen ve tarayıcıya kapalı backend'de tutar: koruma şu an hiçbir düğümde sahipli değil. … | KR-014 açık listesine sahte istek korumasını ve mobil geçiş yolunu yaz ve şu sınırı şimdiden bağla: çerezden başlığa çeviri yalnız Server Action yolunda yapılır, geçiş yolu yalnız başlıkta belirteçle gelen isteği aktarır. … | açık |
| 9 | orta | hayır | hayır | KR-014 çift yönlü işaretli; oysa Seçim 1 her ucun, komutun ve şemanın yazım biçimini bağlar ve aynı gerekçeyle KR-011 tek yönlü sayılmıştı (KR-011 satır 14). İşaret yüzünden Ölçütler, Varsayımlar, Geri dönüş ve İstisna yolu bölümleri yok: … | Seçim 1'i tek yönlü say ya da ayrı karara böl; Varsayımlar, Geri dönüş ve İstisna yolu bölümlerini ekle (taslak saklamayı açan proje için yol dahil). … | açık |
| 10 | hafif | hayır | hayır | KR-014 kanonun yaklaşık 70 frontend kuralını "olduğu gibi" alır, ama yalnız kural listesi ve üç bölüm okunmuştur (satır 14). Okunan 9b bölümündeki alan düzeyi örnek alan iznini tür adıyla sorar (FRONTEND satır 918); … | Satır 43'ü "alınacak adaylar; her bölüm okunup kurala çevrilirken teyit edilir" diye değiştir ve 9b için sapmayı şimdi yaz: alan izni ekranda da kayıt örneğiyle sorulur. | açık |
| 11 | hafif | hayır | hayır | KR-010'da bırakılan A seçeneği ("ekran kayda özel izni sunucudan gelen listeden okur") yalnız bedeliyle tek satırdır; ajanın onu önerirken saydığı gerekçeler (satırların bağımsız kalması, kolon sınırlı alanın ekranda olmaması, tek hesap; … | Seçenekler'e A'nın kazançlarını ve ara yolu birer satırla ekle; seçim değişmez, kayıt adil olur. | açık |
| 12 | hafif | hayır | hayır | Seçim 3 "yalnız Türk lirası" seçeneğini "kanon" diye etiketler; kanon aynı yardımcıda `formatUSD()` da verir (FRONTEND satır 1099) ve tarih kuralının başlığı ile örneği farklı araç söyler (satır 1045 ve 1059-1063). … | "Kanon" etiketini "kanondan daraltıldı" yap ve hangi tarih aracının alındığını yaz; kuruş varsayımını "MNY-01 backend'de alınınca geçerli" diye işaretle. | açık |

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
