---
kimlik: TS-003
tur: tasarim
durum: taslak
surum: 1
baslik: Outbox, iz aktarımı ve olay yolu: tablolar, aktarıcı sözleşmesi ve kuyruğun yeri
agirlik: cift-yonlu
tarih: 2026-11-24
---
İş ile aynı işlemde yazılan outbox notunun iki yolunu tanımlar: iz kayıtları (değişiklik kaydı, erişim kaydı) kuyruksuz olarak iz veritabanına aktarılır; olaylar BullMQ'dan geçer ve teslimin durumu veritabanında durur. KR-012 ve KR-013'ün bağımsız incelemede açık kalan bulgularını (KR-012: 1, 2, 3, 5, 8, 11; KR-013: 2, 4, 9) kapatmayı hedefler. İkinci sürümdür: ilk taslak bağımsız bir oturuma çürüttürüldü ("imzalamam"; 18 bulgu) ve bu metin o bulgulara göre yeniden yazıldı. Hiçbir şey kodla sınanmadı.

## Sorun
- Amaç: iş yazıldıysa iz kaydı ve olay eninde sonunda yerine ulaşır; Redis verisinin kaybı kayıt ya da olay kaybettirmez; aynı kayıt ya da etki iki kez oluşmaz; asıl veritabanı kayıt defteriyle şişmez.
- Kapsam dışı: unutma (kişisel verinin değiştirilmesi) akışının tamamı, iz kayıtlarını okuyan uç, güvenlik olayı kaydı, saga, dış sistemden gelen olay. Bunlar KR-012 ve KR-013'te açık durur.
- Başarının ölçüsü (hedefler ölçülmedi): aktarılmamış en eski notun yaşı; denenmiş ama aktarılamamış not sayısı; işlenmeyi bekleyen en eski teslimin yaşı.

## Kısıtlar
- Kullanıcının sözleri (2026-11-24): "Redis çöktü; sistem yükü veritabanı ve outbox üzerine alsın; zaten başarılı olduğunda outbox'tan düşüyor, değil mi?" (KR-009 Seçim 5) · "auditlog yazacağız ya tutmaya gerek var mı onları outbox bi pattern aslında" · "bullmq da dahil olsun bu olaya ya onu da halledelim" · "teslim veritabanında tutulur dedin".
- KR-013 Bağlam (kullanıcı): kayıt defteri asıl veritabanını şişirmemeli ve sistemi anlık yormamalıdır.
- KR-011: yazma yalnız `run` içindedir; erişim kaydı adıyla tek istisnadır ve yazılamazsa okuma reddedilir (Seçim 9). Kimlik uygulamada üretilir (Seçim 8). Unit of Work yalnız asıl veritabanını kapsar; iki veritabanına tek işlemle yazılamaz.
- KR-012 Seçim 1: kuyruk BullMQ'dur, her tüketicinin kendi kuyruğu vardır, feature BullMQ'yu tanımaz (kapı ve bağdaştırıcı).
- Kullanıcının tek kuralı: ilişkiler ilişkisel modellenir; kod sabiti eşlemesi yazılmaz.

## Değişmezler
1. Not, anlattığı işle aynı işlemde yazılır: iş geri alınırsa not da yoktur.
2. İz kaydının kimliği notun kimliğidir ve iz veritabanında tekildir: ikinci yazım etkisizdir.
3. Not, yerine ulaştığı doğrulanmadan silinmez ve işaretlenmez.
4. Aktarıcı, anlamadığı sürümde yazılmış notu almaz (iki sürüm yan yana çalışırken eski kopya yeni notu eksik yazıp silemez).
5. Outbox tabloları, iz tabloları, kuyruk tabloları ve tekrar kayıt tablosu iz üretmez (kendini besleyen döngü olmaz).
6. Sır tablolarının (parola özeti, belirteç özeti) değeri hiçbir notun gövdesine girmez.

## Veri modeli
Öneri ajan; adlar KR-011 Seçim 7'ye göre. Zaman kolonlarını veritabanı verir (`clock_timestamp()` varsayılanı; `now()` işlemin başlangıcıdır ve kopyalar arası saat farkı sırayı bozar; çürütme 8). Not, işin yazmalarından sonra eklenir.

Asıl veritabanı:
```
outbox_iz                            yalnız değişiklik kaydı notu taşır (Seçenek 1: A); tür kolonu yoktur
  id                    uuid PK      v7, uygulamada; iz kaydının kimliği de budur
  surum                 int          gövde biçiminin sürümü; aktarıcı bildiğinden büyük sürümü almaz
  govde                 jsonb        kurucu katı şemayla doğrular (bilinmeyen alan hata verir)
  olusturma_zamani      timestamptz  veritabanı saati
  aktarim_zamani        timestamptz? iz veritabanına yazıldığı doğrulanan an; 3 gün sonra silinir
  deneme_sayisi         int          0; yalnız o satıra özgü (veri) hatada artar
  sonraki_deneme_zamani timestamptz? doluysa ve gelecekteyse aktarıcı satırı atlar
  son_hata              text?        son satır hatasının sınıfı (değer taşımaz)

outbox_olay                          en küçük hâliyle; dizin ve deneme kolonları olay yolu kararından sonra
  id                    uuid PK      olay kimliği
  ad                    text         olay türünün adı
  surum                 int
  govde                 jsonb        yalnız olayın verisi ve zincir alanları (kimlik, ad ve sürüm gövdede yinelenmez)
  olusturma_zamani      timestamptz
  aktarim_zamani        timestamptz? bütün abonelerin kuyruğuna konduğu an; 3 gün sonra silinir (KR-012 Kural 6)
```
İz veritabanı (aktarıcı göreviyle kurulur; kolonlar o görevden önce bir kez daha okunacak):
```
degisiklik_kaydi
  id uuid PK (= notun kimliği) · istek_id uuid? · kullanici_id uuid (yazan; sistem aktörü de kullanıcıdır)
  uyelik_id uuid? · yetenek_id uuid? · is_adi text (her yazmada dolu; çekirdek yolda yolun adı)
  baslatan_kullanici_id uuid? (tüketici yazdıysa olayı başlatan; KR-012 Kural 5)
  veri_sahibi_kullanici_id uuid? (unutma talebinde taranacak kayıtları bulmak için; KR-013 bulgu 3)
  kaynak text · kayit_id uuid · eylem text ('olusturma' | 'guncelleme' | 'silme')
  degisen jsonb ({kolon: {eski, yeni}}; oluşturmada yalnız yeni, silmede yalnız eski)
  olusma_zamani timestamptz (notun yazıldığı an) · yazilma_zamani timestamptz
erisim_kaydi
  id uuid PK · istek_id uuid? · kullanici_id uuid · is_adi text
  erisilen_yer text (rota deseni; adresin kendisi ve sorgu dizgesi yazılmaz) · kayit_sayisi int
  kullanılan yetenek ve üyelik kimlikleri: çoğuldur (KR-010 Seçim 40) — biçimi açık, aşağıda
  olusma_zamani · yazilma_zamani
  (bu tablo erişim kaydını yazan parçayla birlikte, kimlik yürüyen iskeletinde kurulur)
```
- İki outbox tablosunun nedeni: ömür, yük ve temizlik davranışı ayrıdır; tek tabloda türe bağlı boş kolonlar olurdu.
- Açık (kullanıcının tek kuralına karşı tartılacak): erişim kaydındaki yetenek ve üyelik kimlikleri dizi kolonu mu olur, bağlantı tablosu mu. İz veritabanından asıl veritabanına yabancı anahtar kurulamaz; dizi anlık görüntüdür, bağlantı tablosu satır sayısını katlar. İz tabloları kurulmadan sorulacak.
- İz tablolarının temizliği (silme mi, zamana göre bölüm düşürme mi) gerçek veri gelmeden kararlaştırılacak; Prisma 7'nin bölümlü tabloyla göç davranışı ölçülmedi.

## Yapı
Yazma yüzeyi (`shared/messaging`; feature tam repository'yi isteyemez):
- `run` içinde: olay notu ve değişiklik kaydı notu, işin işlem nesnesiyle yazılır.
- Erişim kaydı outbox'a yazılmaz (Seçenek 1: A): istek sonunda ortak altyapı kodu onu doğrudan iz veritabanına yazar; yazan parça kimlik yürüyen iskeletinde kurulur. Yalnız `run` açmayan isteklerde yazılır (ajan okuması, KR-013): işlem onaylandıktan sonra yazılamayan kayıt isteği reddettirirse istemci onaylanmış yazmayı yeniden dener (çürütme 6).
- Değişiklik kaydında eski değerin hangi kilit altında okunduğu repository tabanının işidir (çürütme 9): eski ve yeni değer aynı ifadeden alınır ya da okuma kilitli yapılır; taban kurulurken seçilecek.

İz aktarıcısının sözleşmesi:
1. Asıl veritabanında işlem açar; `outbox_iz`'den sürümünü bildiği, `sonraki_deneme_zamani` boş ya da geçmiş N satırı `FOR UPDATE SKIP LOCKED` ile alır. Sıra güvencesi yoktur ve iz için gerekmez.
2. Satırları iz veritabanına yazar: her yazım kendi başına onaylanan tek ifadedir (açık işleme sarılmaz); kimlik tekildir, çakışan satır atlanır.
3. Yazılan satırları kimlik listesiyle (zaman aralığıyla değil) aktarılmış diye işaretler ve işlemi kapatır. Aktarılmış satırı 3 günden sonra aktarıcının temizlik geçişi siler; aktarılmamış satır silinmez.
4. Hata iki sınıftır. Parti hatası (bağlantı, süre aşımı, şema): işlem geri alınır, satıra dokunulmaz, aktarıcı süreç içinde artan aralıkla bekler. Satır hatası (yalnız o satırın verisi): satırlar tek tek denenir; hata veren satırın `deneme_sayisi` artar ve `sonraki_deneme_zamani` üst sınırı olan artan aralıkla ileri atılır; öbür satırlar ilerler; satır silinmez.
5. "Beklemeden yeniden oku" yalnız parti silinip onaylandıysa geçerlidir.
6. İz yazımının süre sınırı sunucu tarafındadır (`statement_timeout`, `lock_timeout`), asıl işlemin 5 saniyelik sınırından kısadır ve tek tek denemenin toplamını kapsar.
7. Çökme pencereleri: (2) bitti (3) bitmedi → yeniden çalışınca (2) etkisizdir, (3) siler. Birden çok kopya yan yana çalışabilir.
8. Asıl bağlantıda `idle_in_transaction_session_timeout` vardır; `outbox_iz` tabloya özel autovacuum eşiği alır (çürütme 3; etkisi ölçülmedi).
9. Ölçüler: denenmemiş en eski satırın yaşı; denenmiş satır sayısı. Kalıcı bozuk tek satır birinci ölçüyü kör etmez.
10. Bekleyenler asıl veritabanında birikir (KR-013 "Bilinen sınırlar"daki "kuyrukta birikir" cümlesi değişir): iz veritabanına uzun süre yazılamazsa asıl veritabanının diski dolar. Bedeldir; alarm eşiği adlandırılmış sabittir.

## Seçenekler
### 1 — Erişim kaydının yolu (kullanıcı, 2026-11-24: A)
- A — (seçildi) İstek sonunda doğrudan iz veritabanına tek INSERT. Okumada birlikte onaylanacak iş yoktur, outbox'ın atomiklik kazancı da yoktur (KR-013 bulgu 9). Asıl veritabanına okuma başına yazma yok; outbox yalnız değişiklik kaydı ve olay taşır ve kullanıcının 3 gün kuralı aynen kalır. Bedel: iz veritabanı kapalıyken okumalar reddedilir (KR-011 Seçim 9). Ajanın önerisiydi.
- B — Outbox'tan (KR-013 Seçim 4, bugünkü karar). İz veritabanı kapalıyken okumalar sürer. Bedel: okuma başına asıl veritabanına bir ekleme ve bir silme (varsayım aralığıyla saniyede 500–2500); erişim notu 3 gün tutulamaz, yazıldığı doğrulanınca silinir ve iz veritabanı o kaydın tek kopyası olur (yedekten dönülürse aradaki kayıtlar kaybolur).
### 2 — Olay kuyruğunun yeri (kullanıcı, 2026-11-24: a)
Belgeden (BullMQ deposunun belgeleri, 2026-11-24; bu depoda denenmedi): BullMQ 6 kuyruğu PostgreSQL'de de tutabilir (`createPostgresBackend`, `runMigrations`, ayrı şema).
- a — (seçildi) Kuyruk PostgreSQL'de: işlerin durumu veritabanında durur, Redis olay yolunda yoktur, süpürücü yazılmaz. Çürütmenin düzeltmesi (17): kazanç taslağın söylediğinden küçüktür — tekrar güvenliği için (olay, tüketici) "işlendi" tablosu yine gerekir, `outbox_olay` ve olay aktarıcısı da kalır (arka uç bizim işlemimize katılamıyorsa); yeniden deneme fırtınasının yükü asıl PostgreSQL'e biner; tüketici başına bağlantı ve boşta yoklama yükü ile `runMigrations`'ın istediği yetki bilinmiyor.
- b — Kuyruk Redis'te, (olay, tüketici) başına teslim satırı bizim tablomuzda: satır tüketicinin `run`'ında kapanır ve "işlendi" kaydıyla tek tablo olur; kapanmamış satırları süpürücü yeniden kuyruğa koyar. Bedel: süpürücü ile BullMQ'nun kendi durumu ayrışabilir (çürütme 18: denemesi tükenmiş iş duruyorsa yeniden koyma etkisizdir ve teslim sessizce açık kalır) → teslim satırı son durumu ve deneme sayısını taşır.
- c — Teslim tablosu kuyruğun kendisidir (BullMQ'suz; çürütmenin en güçlü karşı görüşü). Kullanıcı BullMQ'yu açıkça istediği için alınmadı.
- İlk taslakta ajan (a)'yı önermişti; çürütme bu öneriyi zayıflattı ve karar ölçüme bırakıldı. Ölçüm (GV-008 ve GV-009; işçi ve inceleyici ayrı ayrı koşturdu, sayılar örtüştü; bullmq 6.7.7, tek makine): göç ayrı bir şemaya 15 tablo, 78 işlev ve 33 dizin kurar, public şemasına yazmaz ve uzantı istemez; göçü koşan role veritabanında CREATE yetkisi gerekir; Redis ayarı olmadan iş eklenir ve işlenir; aynı iş kimliğiyle ikinci ekleme bekleyen, işlenen, tamamlanmış ve başarısız işte yok sayılır, silinmiş işte yeni iş üretir; işçi zorla kapatılınca iş kaybolmaz ve küçültülmüş ayarla 2 saniyede yeniden işlenir (varsayılan ayarda ölçülmedi); hep hata veren iş 3 kez denenir ve başarısız olarak okunabilir; yeni iş LISTEN/NOTIFY ile öğrenilir (ekleme ile tamamlanma arası 40 ms); boşta dinleyen başına 3 bağlantı ve 10 saniyede 8 işlem; resmî arayüz uygulamanın işlemini kabul etmez (yalnız belgelenmemiş bir iç SQL işleviyle olur; kullanılmayacak); 200 işlik hata fırtınası 0,2 saniyede biter ve yan sorgunun ortancası 0,26 ms'den 0,41 ms'ye çıkar (kaba ölçü; ölçümler fırtınanın başını kapsar); tamamlanan ve başarısız işi silme seçenekleri çalışır, olay geçmişi satırları kalır.
- Kullanıcı (a)'yı seçti (2026-11-24). Kabul edilen bedel: dinleyen başına 3 veritabanı bağlantısı (10 dinleyen ve 2 uygulama kopyası 60 bağlantı eder; PostgreSQL'in varsayılan sınırı 100'dür) ve desteğin yeni olması; dinleyen sayısı büyürse sınır yükseltilir ya da (b)'ye geçilir, feature kodu değişmez.
- Seçimin sonuçları: `outbox_olay` ve olay aktarıcısı kalır (aynı işlemde ekleme resmî yoldan yapılamaz); tekrar güvenliği için (olay, tüketici) "işlendi" kaydı bizdedir (silinmiş işin kimliği yeniden eklenebildiği için kuyruğun kopya engeli tek başına yetmez); kuyruk tabloları ayrı şemada durur ve göçleri yayın adımında koşar; Redis yalnız yetki önbelleği için kalır.
- Tekrar güvenliği (kullanıcı, 2026-11-24: b; KR-012 Kural 3 eki): "işlendi" kaydı işin işlemiyle aynı işlemde yazılmaz, ayrı tabloda süreli sahiplenmeyle tutulur. Tablo (öneri ajan): `islenen_olay` — tuketici text, olay_id uuid, durum text ('isleniyor' | 'tamamlandi'), sahiplenme_bitis_zamani timestamptz, tamamlanma_zamani timestamptz (boş olabilir), olusturma_zamani timestamptz; birincil anahtar (tuketici, olay_id). Komutlar tekrar güvenli yazılır.

## Hata modları
- İz veritabanı kapalı: değişiklik kaydı notları asıl veritabanında bekler ve okumalar reddedilir; açılınca aktarım sürer. Fark edilir: en eski satırın yaşı.
- Bozuk tek not: ertelenir, öbürleri ilerler. Fark edilir: denenmiş satır sayısı.
- İki sürüm yan yana: eski aktarıcı yeni sürümlü notu almaz; yeni kopya alır.
- Ağdan düşen kopyanın kilitlediği satırlar sunucu kopmayı fark edene kadar başka kopyaya verilmez (süresi ölçülmedi).
- Unutma ile bekleyen notlar yarışır (çürütme 7): unutmanın iz adımı, `outbox_iz`'de unutma anından eski satır kalmayınca koşmalıdır; olay kişisel değeri değil kimliği taşır. Unutma tasarlanırken yazılacak.

## Aşamalar
1. Deneme: BullMQ PostgreSQL arka ucu (kurulur mu; ayrı şema; iş kimliğiyle kopya engeli; işçi kapanıp açılınca iş kaybı; bizim işlemimizin içinde kuyruğa konabiliyor mu; bağlantı sayısı ve boşta yük; göçü hangi rol koşar; sürekli hata veren işin yükü).
2. Outbox tabloları ve yazma yüzeyi.
3. Değişiklik kaydı tablosu ve iz aktarıcısı.
4. Olay yolu: kapı, bağdaştırıcı, abone defteri, olay aktarıcısı, tüketici tabanı.
5. Bütünün sınaması.

Görevlerin gerçekleşen dökümü ve kartlarda verilen tasarım kararları (2026-11-24; EP-002):
- Alınanlar: iki deneme (GV-008, GV-009) · outbox tabloları ve ilk göç (GV-010) · yazma yüzeyi (GV-011) · değişiklik kaydı tablosu ve iz aktarıcısının tek geçişi (GV-012) · kuyruk kapısı ve BullMQ-PostgreSQL bağdaştırıcısı (GV-013) · adların Türkçe eke çevrilmesi ve ad denetimi testi (GV-014) · olay aktarıcısının tek geçişi ve abone defteri (GV-016).
- Kuyruk kapısı (ajan tanımı; GV-013): arayüz üç iş taşır — kuyruğa iş koy (kimlik, ad, düz veri; aynı kimlik ilki dururken yeni iş üretmez), kuyruğu dinle (hata atan iş yeniden denenir; dinleyici kapatılabilir), başarısız iş sayısını oku. Sabitler: 5 deneme ve 1 saniyeden başlayan üstel aralık (kanondaki değer; uyarlaması açık), tamamlanan iş hemen silinir, başarısız iş silinmez. Kuyruk tabloları `kuyruk` şemasındadır; kuyruk göçü uygulama açılırken koşmaz, yayın adımında çağrılır. `bullmq` yalnız kuyruk klasöründe içe aktarılır.
- Olay aktarıcısı (ajan tanımı; GV-016): tüketicinin adı kuyruğunun adıdır; işin kimliği olayın kimliğidir; işin verisi zarftır (kimlik, ad, sürüm, gövde); dinleyeni olmayan olay kuyruğa konmaz ve aktarılmış sayılır; bir kuyruğuna konamayan not işaretlenmez ve öbür notlar ilerler. Abone defteri süreç içi kayıttır.
- Tüketici tabanı (kullanıcı kararı b; ajan tanımı; GV-017): sahiplenme süresi 60 saniye; sıra sahiplen → işleyiciyi çağır → tamamlandı yaz; işleyici hata atarsa sahiplenme satırı silinir.
- İz aktarıcısının dayanıklılığı (GV-015): iki hata sınıfı, sunucu tarafında süre sınırı, döngü parçası `shared/messaging/aktarim` altında (iki kullanıcısı vardır: iz ve olay aktarıcısı), 3 gün temizliği, iki ölçü. Döngü bu görevde uygulama açılışına bağlanmaz.
- Olay aktarıcısının dayanıklılığı (sırada; GV-016 incelemesinin üç önerisi): `outbox_olay` tablosuna `deneme_sayisi`, `sonraki_deneme_zamani`, `son_hata` kolonları ve bekleyenler için kısmi dizin eklenir (`outbox_iz` ile aynı); geçiş ertelenmiş notu almaz; konamayan işin kuyruğu ve hata sınıfı sonuçta ve `son_hata`'da taşınır; her kuyruk çağrısı 1 saniyeyle, geçiş 3 saniyelik bütçeyle sınırlanır ki notları kilitleyen 5 saniyelik işlem süre aşımına düşmesin (düşerse kuyruğa konmuş işlerin notları işaretsiz kalır ve olay ikinci kez teslim edilir); döngü, 3 gün temizliği ve iki ölçü.
- Bağlama ve bütünün sınaması (sırada): parçalar AppModule'e bağlanır, iki aktarıcının döngüsü uygulama açılınca başlar ve kapanınca durur; göçler uygulama açılırken koşmaz; göçleri uygulanmamış veritabanıyla açılan uygulama çökmez (döngüler hatayı bildirir ve artan aralıkla bekler); uygulamayı bütünüyle açan var olan testler kalıcı veritabanları yerine göçleri uygulanmış geçici veritabanlarını kullanır; feature kodunun kuyruk bağdaştırıcısını, aktarıcıları ve `bullmq`'yu içe aktaramaması lint ile tutulur; uçtan uca sınama: `run` içinde bırakılan değişiklik kaydı notu iz veritabanında, olay notu dinleyenin işleyicisinde görünür.
- Sertleştirme (ajan tanımı, 2026-11-24; GV-013, GV-015 ve GV-017 incelemelerinin önerileri; bağlamadan sonra iki görev olarak koşar):
  - Sahiplenme ile yeniden deneme penceresi (GV-017): sahiplenme 60 saniyedir, kuyruğun yeniden deneme penceresi ise 5 denemeyle yaklaşık 15 saniyedir (1+2+4+8). İşleyicisi çalışırken ölen işçinin olayı yeniden geldiğinde süren sahiplenmeye çarpar, bütün denemelerini sahiplenme dolmadan tüketir ve başarısız olarak kalır; olay hiç işlenmez. Karar: kuyruğun deneme sayısı 8'e çıkar (pencere 1+2+…+64 = 127 saniye) ve "yeniden deneme penceresi sahiplenme süresinden uzundur" değişmezi iki sabitten hesaplanıp testle tutulur. Reddedilen: kuyruk kapısına "deneme saymadan ertele" yeteneği eklemek (kapıyı büyütür; arka uçtaki desteği ölçülmedi) ve sahiplenmeyi kısaltıp yenilemek (kalp atışı ister).
  - Sahiplik (GV-017): işleyicisi 60 saniyeden uzun süren işçinin sahiplenmesi devralınabilir; sonra ilk işçi hata verirse bırakma adımı devralanın satırını siler, ya da ilk işçi "tamamlandı" yazarak devralanın işini örter. Karar: `islenen_olay` tablosuna `sahip_id uuid` kolonu eklenir (her sahiplenmede yeni kimlik); bırakma ve tamamlama yalnız kendi `sahip_id` değerini taşıyan satıra dokunur. BADI'deki düzende de sahip kimliği vardır.
  - Bırakma hatası işleyicinin özgün hatasını örtmez: özgün hata atılır, bırakma hatası günlüğe yazılır (GV-017).
  - Kuyruk bağdaştırıcısı kuyruğun ve dinleyicinin hata olayını dinler ve günlüğe yazar; kapı, geçersiz kimlikte (salt sayı, iki nokta içeren) kendi açık hatasını atar ve kısıt arayüzde yazar (GV-013).
  - Döngü parçası (GV-015): başlatma, süren adım varken ikinci bir zincir kurmaz; adımın hatası yutulmaz — son hata ve ardışık hata sayısı okunabilir ve her hata günlüğe yazılır (değer taşımadan: hata sınıfı ve kodu).
  - İz bağlantısı (GV-015): havuzun bağlantı kurma süresi de sınırlanır ve iz aktarıcısının süre bütçesine girer.
  - İz aktarıcısının hata sınıfı (GV-015): tek tek denemede partinin bütün satırları aynı sınıfta hata veriyorsa bu satır hatası değil parti hatası sayılır (iz şeması kırıcı biçimde değişmişse her satır aynı hatayı alır; hepsine "bozuk" damgası vurulmaz).
- Onarım (GV-019 incelemesinin bulguları, 2026-11-24 gecesi; ajan kararı):
  - Ana dalda kırmızı test: `test/test-database.e2e-spec.ts`, göçleri uygulanmış veritabanındaki tablo listesini birebir sayıyordu ve GV-017 `islenen_olay` tablosunu ekleyince kırıldı; ana oturum o dosyayı GV-017 alındıktan sonra koşturmadığı için fark edilmedi (ana oturumun hatası). Karar: test tablo listesini birebir saymaz, yardımcının işini gösteren tabloların varlığına bakar; şema değiştiren her kart, tablo sayan testleri arayıp bulmayı ve koşturmayı açıkça ister.
  - Düzenli kapanış: `main.ts` süreç sinyallerini dinlemiyordu; gerçek süreçte kapanış kancaları koşmaz, döngüler ve dinleyiciler düzenli durmaz. Karar: uygulama kapanış kancalarını açar ve bu, derlenmiş uygulamaya sinyal gönderilerek sınanır.
  - `bullmq` yasağı feature kodunda yalnız statik içe aktarmayı tutuyordu; dinamik içe aktarma da yasaklanır.
  - Tam tablo listesi sınaması yazılmaz (ajan kararı, 2026-11-24 gecesi; GV-020'nin sorusu üzerine): "şemada bilinenlerden başka tablo yoktur" diye bütün tabloları sayan test, şemaya her tablo eklendiğinde başka görevin testini kırıyor (iki kez yaşandı: `test-database` ve `outbox-sema`). Her şema testi yalnız kendi tablolarının varlığını, kolonlarını ve kısıtlarını sınar; şema ile göçlerin uyumunu Prisma'nın fark komutu, adları ad denetimi testi sınar. Var olan tam liste sınamaları kaldırılır.
  - Aynı sınıftan öbür kırılgan sınamalar da kaldırılır (GV-036 incelemesinin bulgusu, 2026-11-24 gecesi; ajan kararı): göç klasörlerinin sayısını ya da son göçün adını birebir doğrulayan sınamalar (her yeni göçte kırılır) ve şemanın bütününde tür (enum) bulunmadığını doğrulayan sınamalar (başka bir feature'ın türüyle kırılır). Bir görev "yeni göç ekledim, eskiler değişmedi" demek istiyorsa kendi göç klasörünün varlığını ve eski dosyaların değişmediğini sınar. GV-036 yalnız üç dosyayı kapsıyordu ve incelemede kaldı; yerine bütün test klasörünü kapsayan tek bir görev açıldı. GV-036 alınmadı ve atılmayı bekliyor (atma kullanıcıya sorulur).
- İncelemelerin açık bıraktıkları: kuyruk kapısının kimlik kısıtı (salt sayı ve iki nokta reddedilir) arayüzde yazmıyor; kuyruk bağdaştırıcısında hata olayına dinleyici bağlı değil; test veritabanının silinememesi iz bırakmadan yutuluyor.

## Doğrulama
Denetim kimliği ve ölçüm tarihi yok; kod yazılmadı. Görev kartlarına ölçüt olarak girecekler: iş geri alınınca not oluşmaz; iki aktarıcı yan yana aynı notu iki kez yazmaz; iz bağlantısı reddedilirken notlar bekler ve dönünce ulaşır; bozuk satır öbürlerini durdurmaz ve silinmez; büyük sürümlü not alınmaz; çökme penceresinden sonra kayıt tek kalır.

## Bu düzenin BADI'deki karşılığı
Kullanıcı istedi ("badi de nasıl bu bi bak gel outbox olayı", 2026-11-24); ana dal kopyasında yalnız okundu. Bu depoya yalnız genel ders yazılır; BADI'nin olay tarihleri, iş numaraları ve sayıları taşınmaz.
- Tek outbox tablosu; "aktarıldı" olayın Redis'teki kuyruğa konduğu andır; aktarılmış satır günler sonra silinir. Denetim kaydı da aynı yoldan (outbox → Redis kuyruğu → tüketici → tablo) gider.
- Tek aktarıcı satır kilidi almadan okur; çift koymayı iş kimliği (olayın kimliği) engeller. Bu depo iş kimliği fikrini alır, satır kilidini ekler.
- Yönlendirme aktarıcının içinde olay adına göre elle yazılmıştır; ortak kuyruğa düşen olayı rakip tüketicinin kapması ve tüketicisi olmayan olayların başarısız iş olarak birikmesi yaşanmıştır. Bu depoda abone defteri (KR-012 Kural 4) elle dallanmanın yerini alır.
- Redis yeniden başladıktan sonra tüketicinin sessizce durması birden çok kez yaşanmış; karşılığında bir kuyruk sağlık göstergesi ve bir bağlantı bekçisi yazılmıştır. Çıkarım: iz kaydını kuyruktan geçirmemek bu sorun sınıfını iz yolunda kaldırır; olay yolunda Redis kalırsa benzer bir gösterge gerekir.
- Tekrar güvenliği (tüketici, olay) anahtarlı ayrı tabloda ve süreli sahiplenmeyle tutulur; iş ile aynı işlemde değildir.

## Çürütme
Bağımsız oturum (inceleyici rolü, yalnız okuma, 2026-11-24) ilk taslağı çürütmeye çalıştı. Hüküm: "İmzalamam. Yön doğru (kuyruksuz iz aktarımı ve tekil kimlik kayıp ile çift yazımı gerçekten kapatıyor), ama bugünkü metinle 'bozuk satır öbürlerini durdurmaz' ve 'iki sürüm güvenle yan yana çalışır' tutmuyor ve şema üç yerde kararlarla çelişiyor." BullMQ ile ilgili cümleleri belgeden doğrulayamadığını yazdı. Bulgu çıkmayanlar: çökme pencereleri, silme ile ekleme yarışı, SKIP LOCKED'da açlık.

| # | Ağırlık | Bulgu (kısaltıldı) | Cevap |
|---|---|---|---|
| 1 | ağır | Kesintide her satır "bozuk" damgası alır; geri alınan parti beklemesiz sonsuz döngü yapar; sayaç geri alınan işlemde kaybolur | işlendi: iki hata sınıfı (sözleşme 4, 5) |
| 2 | ağır | Eski aktarıcı yeni sürümün notunu eksik yazar ve siler; ikinci yazım etkisiz olduğu için düzeltilemez | işlendi: `surum` kolonu, katı şema (değişmez 4) |
| 3 | orta | Açık duran işlem varken silinen notlar ölü satır olarak birikir; düşen kopyanın kilidi uzun sürer | kısmen: sözleşme 8; etkisi ölçülmedi |
| 4 | orta | Birikmenin sınırı yok; kalıcı bozuk satır ölçüyü kör eder | işlendi: iki ölçü (sözleşme 9), bedel yazıldı (10) |
| 5 | hafif | İz yazımının süre sınırı ve biçimi yazılmamış | işlendi: sözleşme 2, 6 |
| 6 | orta | Okuyup yazan istekte erişim kaydı başarısız olursa istemci onaylanmış yazmayı yeniden dener | işlendi (ajan okuması): erişim kaydı yalnız `run` açmayan isteklerde yazılır |
| 7 | orta | Unutma ile bekleyen notlar yarışır; veri sahibi alanı yok | kısmen: `veri_sahibi_kullanici_id` eklendi; gerisi unutma tasarımına |
| 8 | orta | Zamanı uygulama saati verirse kopyalar arası fark sırayı ters çevirir | işlendi: veritabanı saati |
| 9 | orta | Eski değerin hangi kilit altında okunduğu, değer taşımayan modeller ve iz üretmeyen tablolar yazılmamış | kısmen: değişmez 5, 6; kilit repository tabanına |
| 10 | orta | Erişim kaydında yetenek ve üyelik tekil; kararlar çoğul ister | kısmen: çoğul yazıldı; biçimi (dizi mi, bağlantı tablosu mu) açık |
| 11 | orta | "Hemen sil", kullanıcının açık 3 gün seçimini sessizlikle çeviriyor; söylenmeyen bedel: iz veritabanı tek kopya olur | kapandı (kullanıcı: A): 3 gün kuralı aynen kalır; not aktarılınca silinmez, işaretlenir |
| 12 | orta | Kuyruksuz yolda erişim kaydı için outbox'ın gerekçesi kalmıyor | kapandı (kullanıcı, 2026-11-24: A) |
| 13 | hafif | `erisilen_yer` tanımsız; adres kişisel veri sokar | işlendi: rota deseni |
| 14 | hafif | Değişiklik kaydında "hangi iş" yok | işlendi: `is_adi` |
| 15 | hafif | `outbox_olay`'da yinelenen alanlar ve erken kolonlar; `son_hata` eksik | işlendi: en küçük hâl; `outbox_iz` dizini ölçülünce |
| 16 | hafif | İz tablolarının temizliği silmeyle yapılırsa ortak diski yorar | açık: gerçek veri gelmeden |
| 17 | orta | (a)'nın kazancı küçük, bedeli büyük; denemeye dört soru eksik | kapandı: dört soru deneme görevleriyle ölçüldü; kullanıcı (a)'yı seçti (Seçenek 2) |
| 18 | orta | (b)'de süpürücü ile BullMQ'nun durumu ayrışır | işlendi: teslim satırı son durumu ve deneme sayısını taşır |
