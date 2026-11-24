---
kimlik: KR-009
tur: karar
durum: taslak
surum: 1
baslik: Oturum her istekte veritabanından doğrulanır; belirteç yalnız kimliği taşır
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-23
baglam: TS-001
---
Kimlik doğrulama için oturumun açık olup olmadığı her istekte veritabanındaki oturum satırından okunur, belirteç yalnız kullanıcı ve oturum kimliğini taşır ve refresh token her kullanımda değişir; kapatılan oturum bir sonraki istekte geçersizdir ve çalınan refresh token fark edilir, karşılığında her istek veritabanında bir satır daha okur ve istemci eşzamanlı yenilemeyi kilitlemek zorundadır.

> Düzeltme (2026-11-23): Seçim 1 değişti. İlk hâli beyaz listeydi (Redis'te oturum başına bir kayıt); kullanıcı, beyaz listenin bu anlama geldiği açık anlatılınca oturum denetiminin veritabanında yapılmasını seçti. Dosya adı ilk başlıktan kalmadır. Seçim 5 ve aşağıda "yeniden teyit bekliyor" yazan satırlar bu değişikliğe göre kullanıcıya yeniden sorulacak.

> Bu taslak kullanıcının 2026-11-23 seçimlerinden derlendi; metni ajan yazdı. Konuşma TS-001 "Veri modeli" bölümünün sonundaki "Kimlik doğrulama ve oturum" bloğundadır. "Kullanıcı" yazan satırlar kullanıcının sözüdür; "öneri (ajan)" yazan satırlar teyit ister. Bağımsız çürütme turu 2026-11-23'te koştu (TS-001 "Çürütme", "KR-009 için ilk tur"): hüküm "bu hâliyle imzalamam", 30 bulgu, sekizi ağır. Sekiz ağır bulgu aynı gün kullanıcıyla kapatıldı (Seçim 1, 2, 4 ve 5 değişti; Seçim 7, 8 ve 9 ile Kural 1–10 eklendi). Orta ve hafif bulgular açıktır (liste: TS-001 "Aşamalar"); belgenin bu yeni hâli bağımsız incelenmedi, kural taslakları açılmadı ve çalışan bir denetim yoktur; kabule hazır değildir.

## Bağlam
- KR-008 ve KR-010 bu kararı önceden bağlar: belirteç (token) yetki bilgisi taşımaz, derlenmiş yetki Redis'te durur (KR-010 Seçim 23); sırlar kaynak olmayan ayrı tabloda durur (KR-008 Seçim 21); kişisiz iş belirteç kullanmaz, sistem aktörüyle çalışır (KR-010 Seçim 25).
- Kullanıcının ilkesi (2026-11-23): önce kapatılır, sonra açılır; erişmesi için zaman harcanabilir, erişmemesi için değil. Ölçek beklentisi: aynı anda 1000–5000 kişi (ölçüm değil).
- Kullanıcı (2026-11-23): Redis yığında zaten olacak (kuyruk); olay güdümlü tasarım ileride gelecek.
- Kanon (okundu 2026-11-23; `kb/_gelen/`): belirteçler HttpOnly çerezde taşınır, imza RS256'dır, refresh token özetlenerek saklanır, parola özeti bcrypt'tir (iş faktörü en az 12), hız sınırı Redis'lidir (`IRON_RULES_SHARED.md` satır 335–346); access token 15 dakika, refresh token 7 gün, hareketsizlikte 30 dakika, "beni hatırla" 30 gün, en çok 3 etkin oturum, parola değişince bütün oturumlar düşer (`IRON_RULES_BACKEND.md` satır 1894–1972); web'de token yenileme ve çok sekme eşgüdümü (`ARCHITECTURE.md` satır 598–624).
- Kanonda olmayanlar (aynı satırlar): access token için liste denetimi yoktur (geri alma yalnız refresh token'ı iptal eder); refresh token'ın döndürülmesi geçmez; mobil yüzey hiç ele alınmaz; giriş akışı örneği telefon ve SMS koduyladır (projeye özgü).
- OWASP parola saklama sayfası (okundu 2026-11-23): ilk tercih Argon2id'dir (en az 19 MiB bellek, 2 tur, 1 paralellik); bcrypt yalnız eski sistemler içindir (iş faktörü en az 10, 72 bayt girdi sınırı); algoritma değişince özet bir sonraki girişte yenilenir.

## Ölçütler
Kullanıcıdan sayısal ölçüt gelmedi; ilke ve ölçek geldi. Öneri (ajan):
1. Kapatılan oturumun etkisizleşmesi. Ölçü: kapatmadan sonra erişimin sürdüğü istek sayısı. Hedef: 0.
2. Çalınan refresh token. Ölçü: aynı refresh token'ın işe yaradığı yenileme sayısı. Hedef: hoşgörü penceresi dışında en çok 1 (Kural 3); ikinci kullanımda kullanıcının bütün oturumları kapanır.
3. Veri kaybında kapalı kalma. Ölçü: Redis verisi silindikten ya da eski bir kopyaya döndükten sonra geçerli sayılan kapatılmış oturum sayısı. Hedef: 0 (oturum Redis'te durmadığı için yapıdan sağlanır).
4. İstek başına kimlik maliyeti. Ölçü: kimlik için ek Redis gidişi ve ek veritabanı sorgusu sayısı. Hedef: 0 gidiş, 0 ek sorgu (oturum satırı yetki sürümüyle aynı sorguda okunur; sorgu bir satır büyür). Ölçülmedi.
5. Yeni giriş yöntemi. Ölçü: yöntem eklenirken değişen oturum çekirdeği dosyası sayısı. Hedef: 0.

## Seçenekler
### Oturumun geçerliliği
- D — Veritabanında, sürüm okumasıyla birlikte (seçildi): oturumun açık olup olmadığı, her istekte zaten yapılan yetki sürümü okumasıyla aynı sorguda okunur. Bağımsız incelemenin ikinci karşı görüşüydü; kullanıcıya 2026-11-23'te sunuldu.
- A — Beyaz liste (ilk seçimdi, bırakıldı): her oturumun Redis'te kaydı vardır; kayıt yoksa istek reddedilir. Bırakılma nedeni: kapatma iki yere yazılır (sıra ve yarış sorunu), Redis'e ulaşılamazsa giriş yapmış herkes dışarıda kalır, Redis eski bir kopyaya dönerse kapatılmış oturum dirilebilir.
- B — Karaliste (kullanıcının ilk önerisi): iptal edilen belirteçler Redis'e yazılır; listede olmayan geçerlidir. Redis verisi kaybolursa iptal edilmiş belirteçler yeniden geçerli olur (ölçüt 3'ü karşılamaz).
- C — Liste yok (kanon): access token süresi dolana kadar geçerlidir (ölçüt 1'i karşılamaz; 15 dakikaya kadar erişim sürer).
### Belirtecin türü
- A — İmzalı kısa ömürlü token ve dönen refresh token (seçildi; kullanıcı 2026-11-23'te karşı görüş sunulduktan sonra bunda kaldı).
- B — Opak sunucu tarafı oturum (belirteç anlamsız bir oturum numarasıdır, yenileme yoktur): bağımsız incelemenin en güçlü karşı görüşüydü. Her istekte sunucu kaydına bakıldığı için imzalı token'ın durumsuz doğrulama faydası kullanılmaz; opak oturum imza anahtarı yönetimini, döndürme yarışını, hoşgörü penceresini ve çizim sırasındaki çerez sorununu kaldırır. Bedeli: çalınan belirteç hiç fark edilmez ve uzun ömürlü sır her istekte taşınır. Ajan önce bunu önerdi; kullanıcının hırsızlığa verdiği ağırlık üzerine önerisini geri çekti.
- C — Hazır kimlik sağlayıcı: incelemenin üçüncü karşı görüşü; kullanıcıya ayrıntılı sunulmadı (açık).
### Refresh token
- A — Döndürme ve yeniden kullanım tespiti (seçildi).
- B — Sabit refresh token (kanon): basit ve yarışsız; çalınan token süresi dolana kadar sessizce kullanılabilir (ölçüt 2'yi karşılamaz).
### Cihaza bağlama
- A — Cihaz bağı: cihaza özel ikinci bir sır, yalnız yenilemede aranır (seçildi; BADI'deki yapı).
- B — IP ve tarayıcı bilgisiyle kapı, her istekte (A'ya ek olarak seçildi; Seçim 8): başka ağdaki hırsızı durdurur; ağ değiştiren kullanıcıyı dışarıda bırakır, aynı ağdaki hırsızı durdurmaz. Alt seçenekler: her yerde zorunlu (seçildi) ya da proje ve yüzey bazında kapatılabilir (ajanın önerisiydi).
- C — Donanım anahtarıyla imzalı yenileme: en güçlü koruma; büyük iş, web tarafı ayrıca çözülmeli (ertelendi).
- D — Bağlama yok, yalnız kayıt ve güvenlik olayı (ajanın ilk önerisiydi).
### Giriş yöntemi
- A — Kapı ve hazır parola girişi (seçildi).
- B — Yalnız kapı: iskeleti denemek için yine yöntem yazılır; iş ertelenir.
- C — Kapısız gömülü tek yöntem: ikinci projede çekirdek değişir (ölçüt 5'i karşılamaz).
### Erişim yolu
- C — İkisi de aracı katman üzerinden (seçildi): backend hiç açılmaz; mobil web sunucusuna bağımlı olur ve her istek fazladan duraktan geçer.
- A — Web aracı katman üzerinden, mobil doğrudan (ilk seçimdi, bırakıldı): backend internete açılır; adres bilgisine güven yalnız imzaya kalır.
- B — İkisi de doğrudan: en az parça; çerez, alan adı ve sahte istek korumaları backend'e taşınır.

## Seçim
Hepsi kullanıcı seçimidir (2026-11-23):
1. Oturumun açık olup olmadığı her istekte veritabanındaki oturum satırından okunur: bu okuma yetki sürümü okumasıyla (KR-010 Seçim 24) aynı sorguda yapılır, belirteç oturum kimliğini taşır, satır yoksa ya da kapatılmışsa istek reddedilir. Redis'te oturum kaydı tutulmaz; Redis yalnız derlenmiş yetki içindir (KR-010 Seçim 23). Kullanıcının sözü: "Redis'te oturum kaydı tutmak değil de yetki derlemelerini oradan diye konuşmuştuk".
2. Refresh token her kullanıldığında değişir; eski bir token ikinci kez gelirse çalınmış sayılır ve kullanıcının bütün oturumları kapatılır. İlk hâli "o oturum düşürülür" idi; kullanıcı 2026-11-23'te BADI'deki gibi bütün oturumların kapanmasını seçti ("BADI hırsızlıkta oturumları kapatıyorsa bizimki de öyle olsun"). Bu sertlik, meşru iptalin hırsızlık sayılmamasını zorunlu kılar (BADI'nin tuzak kaydı T-0012; aşağıdaki Kural 7).
3. Base oturum çekirdeğini (belirteç üretme, oturum kaydı, yenileme, çıkış) ve bir "giriş yöntemi" kapısını taşır; parola ile giriş hazır gelir, proje başka yöntemi kapıya takar. Desen: strateji; mimarideki adı kapı ve bağdaştırıcı.
4. Web de mobil de backend'e yalnız Next.js aracı katmanı (BFF) üzerinden ulaşır; backend internete açılmaz. Tarayıcı belirteci betiğin okuyamadığı çerezde, mobil cihazın güvenli saklama alanında tutar ve istek başlığında gönderir; aracı katman mobil isteği backend'e aynen aktarır. İlk hâli "web aracı katmandan, mobil doğrudan" idi; kullanıcı 2026-11-23'te değiştirdi ("mobil de frontun üzerinden gider"), çünkü backend internete açıkken "gerçek adres" bilgisini herkes yazabilir ve IP kapısı (Seçim 8) atlatılır. BADI'de de mobil aracı katmandan geçer.
   - Kazanç: adres güveni, hız sınırı ve güvenlik denetimleri tek kapıda toplanır; backend'in açık yüzeyi küçülür.
   - Kabul edilen bedel: mobilin her isteği bir durak fazla yapar (ölçülmedi); aracı katman mobil trafiği de taşır ve düşerse mobil de düşer; mobil uygulama web sunucusunun yayınına bağımlı olur; yalnız mobili olan proje de aracı katmanı kurar.
   - Şart (kurulum işi; kod garanti edemez): backend'e ağ düzeyinde yalnız aracı katman ulaşabilir. İkinci güvence imzadır (aracı katmanın adres bilgisini imzalaması; aşağıdaki Kural 9).
5. Redis'e ulaşılamazsa oturum düşmez ve kullanıcı istekleri çalışmaya devam eder: yetki veritabanından derlenir ve sunucunun belleğinde kısa süre tutulur (KR-010), kuyruğa gidecek her şey outbox'ta bekler (KR-012). Kullanıcı (2026-11-24): "Redis çöktü; düzelmesi için sistem yeri geldiğinde yükü veritabanı ve outbox üzerine alsın". Redis bir hızlandırıcıdır, sistemin ayakta kalma şartı değildir.
   - Geçmişi: ilk hâli "Redis'e ulaşılamazsa kimlik gerektiren bütün istekler reddedilir" idi (oturum Redis'teyken). 2026-11-23'te Seçim 1 değişince "oturum düşmez, ama yetki okunamadığı için istek 503 alır" oldu (ajan önerisi; kullanıcı teyit etmişti). 2026-11-24'te kullanıcının beklediği davranışın bu olmadığı görüldü ve kullanıcı çalışmaya devam etmeyi seçti.
   - Neden: güvenlikten bir şey vermez; yetki yine her istekte denetlenir ve doğruluk kaynağı veritabanıdır. Bellekteki kayıt bayat yetki vermez, çünkü yetki sürümü her istekte veritabanından okunur ve kayıt o sürümle karşılaştırılır (öngörü; denenmedi).
   - Kabul edilen bedel: Redis yokken veritabanı yükü artar (ölçülmedi; yürüyen iskelette ölçülecek); sunucu belleğindeki kayıt yeni bir parçadır.
   - Reddedilen: Redis yokken isteği reddetmek (kesinti boyunca giriş yapmış kullanıcı iş yapamaz).
   - Açık: hız sınırı da Redis'e dayanacak; Redis yokken ne yapacağı hız sınırı kümesinde kararlaştırılacak.
6. Parola özeti Argon2id ile üretilir (OWASP sayfasındaki en az ayarlarla başlanır: 19 MiB bellek, 2 tur, 1 paralellik).
   - Neden: OWASP'ın güncel ilk tercihidir; base sıfırdan kurulduğu için eski özet yoktur. Kanondan sapmadır: kanon bcrypt (iş faktörü en az 12) der; OWASP onu yalnız eski sistemler için önerir.
   - Geri dönüş: özet algoritmasını ve ayarlarını kendi içinde taşır; algoritma değişirse özet bir sonraki girişte yenilenir.
   - Açık (ajan): Node tarafında hangi kütüphaneyle üretileceği seçilmedi ve denenmedi.
7. Refresh token cihaza bağlanır (cihaz bağı): girişte sunucu o cihaza özel rastgele bir sır üretir, veritabanında yalnız özeti oturum satırında durur ve yenileme isteğinde bu sır gelmezse ya da uymazsa istek reddedilir. Web'de sır ayrı bir HttpOnly çerezde durur ve yalnız kimlik uçlarına gider (aracı katman backend'e başlıkta iletir); mobilde güvenli saklama alanında durur ve yenileme isteğinde gönderilir. Sır döndürmede aynı kalır, her yeni girişte yenisi üretilir. Kullanıcının fikri (2026-11-23): token geldiği yere bağlansın, çalınsa da parmak izi olmadan çalışmasın. Yapı BADI'den okundu (salt okuma; kod alınmadı; TS-001 "BADI'den okunanlar — kimlik").
   - Neyi korur: refresh token tek başına sızarsa işe yaramaz. Neyi korumaz: iki sır aynı yerden birlikte kopyalanırsa (tarayıcının çerez deposu, telefonun deposu); o durumu yalnız döndürme yakalar, o da gerçek sahibi geri dönerse.
   - Reddedilen: parmak izinin yalnız kayıt olarak tutulması (ajanın ilk önerisiydi). IP ve tarayıcı bilgisi tek başına bağ sayılmaz (BADI bırakmış); bu bağa ek kapı olarak Seçim 8'de alındı.
   - Ertelenen: donanım anahtarı (cihazdan çıkmayan bir anahtarla yenileme isteğini imzalamak). Depo bütünüyle kopyalandığında da koruyan tek yol odur; tasarlanmadı.
8. Oturum, açıldığı IP adresine ve tarayıcı bilgisine de bağlanır: ikisi girişte oturum satırına yazılır ve her istekte, zaten okunan oturum satırıyla karşılaştırılır; uymayan istek reddedilir ve kişi yeniden giriş yapar. Her yüzeyde (web ve mobil) ve her projede zorunludur; kapatma ayarı yoktur. Kullanıcının sözü (2026-11-23): "bir kere bile olmasını engellemek şart". Ajanın önerisi base'de açık doğup proje ve yüzey bazında kapatılabilmesiydi; kullanıcı zorunlu olmasını seçti.
   - Neyi korur: çalınan access token ve refresh token başka bir ağdan kullanılamaz (uzaktaki hırsız sıfır kullanımda durur). Neyi korumaz: aynı ağdaki hırsızı ve kişinin kendi cihazından istek atan zararlı yazılımı. Tarayıcı bilgisi gizli değildir ve kopyalanır; tek başına koruma saymayız, yalnız özensiz kopyayı durdurur.
   - Kabul edilen bedel (kullanıcı): ağ değiştiren kullanıcı (özellikle telefonda Wi-Fi ile mobil veri arasında) yeniden giriş yapar; dışarıya birden çok adresle çıkan ağdaki kullanıcı çalışamaz; tarayıcı ya da uygulama güncellenince yeniden giriş gerekir. Hiçbiri ölçülmedi.
   - Hiçbir katman "hiçbir durumda bir kez bile" güvencesi vermez; bu seçim cihaz bağıyla birlikte uzaktan kullanımı kapatır.
   - Ayrıntı kuralları aşağıdadır (Kural 8, 9 ve 10).
9. İlk parola davet akışıyla belirlenir: "kullanıcı aç" komutu kısa ömürlü, tek kullanımlık bir parola belirleme bağlantısı üretir, yönetici bunu bir kez görür ve kişiye iletir, kişi parolasını kendisi belirler; veritabanında bağlantının yalnız özeti durur. İlk SuperAdmin için bağlantıyı kurulum komutu üretir ve terminale bir kez yazar. Yönetici aynı yolla yeni bağlantı üreterek unutulan parolayı da çözer; kendi kendine sıfırlama base'de yine yoktur. Kullanıcı (2026-11-23): a; "normalde b'ye gidecektim".
   - Neden: parolayı sahibinden başkası hiçbir an bilmez; kullanılmayan bağlantı kendiliğinden ölür.
   - Reddedilen: geçici parola ve ilk girişte zorunlu değişim (yönetici parolayı bilir ve kişi değiştirene kadar onun yerine girebilir; kullanılmayan geçici parola geçerli kalır).
   - Kabul edilen bedel: "parola belirle" ucu giriş yapmadan çağrılır ve hız sınırı ister (hız sınırı henüz tasarlanmadı; bu uç ondan önce yayına çıkmaz); base'de e-posta ya da SMS gönderimi olmadığı için bağlantıyı yönetici elle iletir.
   - Ajan önerisi; kullanıcı teyit etti (2026-11-24, "uygun"): bağlantının ömrü 24 saattir ve proje ayarıyla değişir (başlangıç değeri; ölçüm değil); yeni bağlantı üretilince kişinin eski bağlantısı ölür; parola bağlantıyla yeniden belirlenince kişinin bütün oturumları kapanır (kabul edilen bedel: kişi öbür cihazlarında yeniden giriş yapar); bağlantı üretmek kendi izni olan bir niyet eylemidir (`Kullanici:parola_baglantisi_uret`; KR-008 Seçim 34); parola belirlendikten sonra kişi giriş ekranından olağan yolla girer, bağlantı kendiliğinden oturum açmaz.
10. Base iki hazır giriş yöntemi taşır: parola ile giriş (kullanıcı adı ve parola) ve tek kullanımlık kodla giriş (telefon ve kod); hangisinin açık olduğunu proje ayarı söyler ve bir proje parolayı kapatıp yalnız kodla çalışabilir. Kullanıcı (2026-11-24): "BADI'deki yapıyı da ekleyebiliriz, OTP ile giriş; esneklik; kullanıcı adını kaldırıp ona bile geçebilir sistem"; üç yol gösterilince a'yı seçti. Seçim 3'ü genişletir: "parola hazır gelir, gerisini proje takar" yerine iki yöntem hazır gelir, proje üçüncüsünü yine kapıya takar.
   - Sıra (ajan önerisi; kullanıcı a ile birlikte kabul etti): ilk dilimde parola ile giriş yazılır (dışarıya bağlı değildir, iskelet uçtan uca sınanır); kodla giriş hemen ardından ikinci yöntem olarak eklenir.
   - Base'de duran: kodun üretilmesi, tek kullanımlık olması, veritabanında yalnız özetinin saklanması, ömrü ve deneme sınırları; ayrıca "kodu gönder" kapısı ve geliştirme ortamı için sahte gönderici. Projede duran: gerçek gönderici (SMS sağlayıcısı).
   - Reddedilenler: yalnız kodla giriş (en az kod ve ilk parola derdi kalkar; ama her giriş gönderim sağlayıcısına bağlanır, sağlayıcı kesilirse kimse giremez, sözleşmesi olmayan proje base'i ilk gün kullanamaz; Seçim 6 ve 9 düşerdi); şimdilik yalnız parola.
   - Kabul edilen bedel: daha çok kod ve iki giriş yüzeyi; deneme sınırlarının tasarımı öne gelir (sınırsız kod isteği hem tahmin edilir hem gönderim faturası yazdırır); kodla giriş açık olan projede `kullanici` tablosu telefon numarası taşır.
   - Seçimden doğan sonuçlar (ajan): giriş yöntemi kapısı iki adımlı yöntemi taşır (kod iste, kod doğrula); `kullanici_adi` yalnız parola yöntemi açıksa aranır, telefon yalnız kodla giriş açıksa aranır; Seçim 6 ve 9 yalnız parola yöntemi için geçerlidir.
   - Açık (ajan; tasarımda sorulacak): deneme sayaçlarının nerede durduğu (öneri: veritabanında, kod satırının üstünde; Seçim 5'le çelişmemesi için Redis'e bağlı olmaması); kodun uzunluğu ve ömrü; günlük ve bekleme sınırlarının sayıları; aynı ağdan çıkan çok kullanıcının sınırlara takılması; kayıtlı olmayan telefon için verilen cevabın kayıtlı olanla aynı olması; telefon numarasının yazım kanonu. BADI'deki uygulamaya bu seçim için bakılmadı.
11. Parola kuralı (ajan önerisi; kullanıcı teyit etti, 2026-11-24): en az 15 karakter (proje ayarıyla değişir); 128 karaktere kadar kabul edilir, uzunu reddedilir; büyük harf, rakam ya da işaret zorunluluğu yoktur; düzenli aralıklarla parola değiştirme zorunluluğu yoktur. Kural yalnız parola ile giriş yöntemi içindir.
   - Dayanak (okundu 2026-11-24; arama özetlerinden, belgelerin tamamı okunmadı): NIST SP 800-63B-4 tek başına kullanılan parolada en az 15 karakteri zorunlu tutar, çok adımlı doğrulamanın parçası olan parolada en az 8; en az 64 karaktere izin verilmesini ister; uzunlukta her Unicode kod noktası bir karakter sayılır. OWASP Authentication Cheat Sheet aynı sayıları verir, bileşim kuralı konmamasını ve düzenli değişimin zorunlu tutulmamasını söyler. OWASP ASVS 5.0 en az 8 karakteri zorunlu tutar, 15'i kuvvetle önerir. Base'de çok adımlı doğrulama olmadığı için parola tek başına kullanılır.
   - Üst sınırın nedeni: çok uzun parolayla özetleme yükü bindiren saldırıyı kesmek; 128 sayısı ajanın seçimidir (kaynaklar yalnız "en az 64'e izin ver" der).
   - Kabul edilen bedel: 15 karakter uzundur; kullanıcıya birkaç sözcükten oluşan bir parola cümlesi önerilir.
   - Ertelenen (açık iş; kaynaklar ister): yaygın ve sızmış parolaların engellenmesi. Yerel bir liste dosyası ya da dış servis çağrısı gerektirir; ilk dilimde yoktur.
12. Yenileme belirteci imzalıdır ve kişinin kimliğini, oturumun kimliğini ve nesil sayısını taşır; oturumun nesil sayısı her döndürmede artar. İmzası geçerli ama nesli eski olan her belirteç, kaç nesil eski olursa olsun, yeniden kullanım sayılır (Seçim 2); imzasız ya da bozuk belirteç hiçbir oturuma dokunulmadan reddedilir. Kullanıcı (2026-11-24): a. Kaynak: TS-002 birinci çürütme turunun 2. bulgusu (yalnız bir önceki özet saklandığı için, art arda iki kez yenileyen hırsız gerçek sahibi dönünce yakalanmıyordu). "İmzalı mı opak mı" açığını kapatır.
   - Neden: her eski belirteç satır biriktirmeden tanınır; oturum kimliğini bilen biri sahte belirteçle alarm çaldırıp kişinin oturumlarını kapattıramaz.
   - Reddedilenler: verilmiş her belirtecin özetini saklamak (oturum başına yedi günde 4 × 24 × 7 = 672 satıra kadar); yalnız son iki özeti saklamak (ilk hâl; iki nesil eski belirteç tanınmaz).
   - Kabul edilen bedel: yenileme belirteci de imza anahtarına bağlanır (anahtarın üretimi ve değiştirilmesi açık iştir).
   - Ajan ayrıntıları (teyide sunulmadı): güncel ve bir önceki belirtecin özeti saklanmaya devam eder (imza anahtarı sızarsa ikinci engel; hoşgörü penceresi için); yenileme belirteci erişim belirteci yerine kullanılamasın diye türü belirtecin içinde ayrı işaretlenir; hangi anahtarla imzalanacağı anahtar yönetimiyle birlikte kararlaştırılır.

Ajan okumaları — kullanıcı teyit etti (2026-11-23):
- Backend yalnız istek başlığındaki belirteci tanır; çerez yalnız aracı katmanda yaşar.
- Belirteç yalnız kullanıcı kimliği, oturum kimliği ve süre taşır; rol, grup ya da yetki taşımaz.
- Oturumun tek kaydı veritabanındaki oturum satırıdır; özetlenmiş refresh token o satırın alanıdır (Seçim 1 değişince düzeltildi; ilk hâli "Redis'teki oturum kaydı ondan türetilir" diyordu).
- Çıkışta, parola değişince ve kullanıcı kapatılınca ilgili oturum satırları kapatılır; etkisi bir sonraki istektedir.
- Kullanıcı silinmez, pasife alınır; pasif kullanıcı giriş yapamaz.
- Kanondaki sayılar base'in varsayılanıdır (access token 15 dakika, refresh token 7 gün, hareketsizlikte 30 dakika, en çok 3 oturum); proje ayarla değiştirir.
- İsteği yapanın kimliği yalnız doğrulanmış belirteçten alınır ve isteğe kimlik guard'ı yazar; istek gövdesinden okunmaz (KU-013).
- Kendi kendine parola sıfırlama, kendi kendine kayıt ve çok adımlı doğrulama base'de yoktur; ihtiyaç duyan proje ekler. Yöneticinin yeni parola bağlantısı üretmesi vardır (Seçim 9).
- Kullanıcı teyidi (2026-11-24): kişi oturum sınırını aşınca en eski oturumu `oturum_siniri` nedeniyle kapanır ve yeni giriş kabul edilir (reddedilen: yeni girişin reddedilmesi). Kişi parolasını değiştirince bütün oturumları kapanır, o anki dahil, ve yeni parolayla yeniden girer (reddedilen: o anki oturumun açık kalması).

Çürütme turundan ve BADI'den çıkan kurallar (ajan önerisi; kullanıcı 2026-11-23'te teyit etti; hiçbiri denenmedi, her biri yürüyen iskelette bir sınamayla gösterilecek). Oturum satırı (adlar örnek; oturum başına tek satır):
```
Oturum   kimlik · kullanıcı · başlangıç zamanı · mutlak bitiş
         geçerli refresh token özeti · son döndürme zamanı
         bir önceki refresh token özeti
         cihaz sırrı özeti · IP adresi · tarayıcı ya da uygulama bilgisi
         kapatılma zamanı · kapatılma nedeni   (çıkış, süre, parola değişimi, yönetici, yeniden kullanım,
                                                oturum sınırı, adres değişti, cihaz uymadı)
```
- Uyarlama (ajan önerisi; kullanıcı teyidi, 2026-11-24; TS-002 "Veri modeli"): "oturumlarım" yetenek satırıyla okunduğu için (KR-008 Seçim 46) oturum bir kaynak olur ve sırlar kaynak modelinde duramaz (KR-008 Seçim 21); bu yüzden yenileme belirteci özetleri, nesil sayısı ve cihaz sırrı özeti ayrı bir sır tablosuna (`oturum_sirri`) ayrılır; son döndürme zamanı sır değildir ve oturum satırında kalır (TS-002 ikinci tur 7). Her istekteki okuma yalnız oturum satırına bakar; yenileme oturum satırını kilitler, sonra sır satırını okur ve yazar. Kural 1 değişmez.
- Kural 1. Oturumu kapatmak tek yazmadır: satıra kapatılma zamanı ve nedeni yazılır; yenileme aynı satırı kilitler ve kapatılmış satırı yenilemez.
- Kural 2. Redis'e ulaşılamadığında ne olacağı Seçim 5'tedir.
- Kural 3. Bir önceki token kısa pencere içinde yeniden gelirse oturum düşmez ve hırsızlık olayı yazılmaz; pencere dışında gelirse hırsızlık sayılır (Seçim 2). Pencerenin süresi iskelette ölçülerek konur (BADI'de 5 saniyedir; tuzak kaydı kısa pencerenin yük altında sorun çıkardığını söyler).
- Kural 4. Cevabı yolda kaybolan yenileme isteği aynen tekrarlanırsa başarılı olur; aynı anda gelen farklı bir yenileme isteği reddedilir ama oturum yaşar. Yöntem iskelette testle seçilir; aday: istemcinin her yenileme isteğine koyduğu tekrar anahtarı. BADI bu durumu çözmez.
- Kural 5. Web'de yenilemeyi yalnız aracı katmanın istek girişi ve kendi yenileme ucu yapar; sayfa çizilirken yenileme yapılmaz ve ön yükleme isteği yenileme tetiklemez. Refresh çerezinin yol kapsamı buna göre seçilir (BADI'de dar kapsam bir devir düzeni gerektirmiştir).
- Kural 6. Oturumun mutlak bitişi girişte belirlenir ve döndürmeyle uzamaz (varsayılan 7 gün; kanon ve BADI sayısı, ölçülmedi); sınırı aşacak access token üretilmez. Bilinen sınır: gerçek sahibi geri dönmezse yeniden kullanım tespiti çalışmaz; hırsızı mutlak ömür, cihaz bağı ve IP kapısı sınırlar.
- Kural 7. Hırsızlık alarmı yalnız döndürmeyle değiştirilmiş bir token geri gelirse çalar; çıkış, süre dolması, parola değişimi ya da pasife alma ile kapanmış oturumun token'ı yalnız reddedilir. Güvenlik olayı yalnız gerçekten bir oturum kapandıysa yazılır (BADI dersleri).
- Kural 8. IP ya da tarayıcı bilgisi uymazsa, ya da yenilemede cihaz sırrı yanlışsa, istek reddedilir ve yalnız o oturum ilgili nedenle kapatılır; kişinin öbür oturumlarına dokunulmaz ve güvenlik olayı yazılır.
- Kural 9. Aracı katman, isteği yapanın gerçek adresini ve tarayıcı ya da uygulama bilgisini backend ile paylaştığı gizli anahtarla imzalayıp (HMAC) iletir; imza adresi, bilgiyi ve zamanı kapsar ve kısa ömürlüdür; backend imzasını doğrulayamadığı adres bilgisini yok sayar. Aracı katman adresi, önündeki sunucunun adıyla bildirilen başlığından ve zincirin en sağındaki değerden okur. Anahtar en az 32 karakterdir, iki taraf açılışta denetler, karşılaştırma sabit sürelidir. Desen BADI'nin refresh devrindeki imzadır; adres bilgisine uygulanması bu deponun eklemesidir (BADI'de adres imzasızdır). Reddedilen: karşılıklı sertifika (kurulumu ağır).
- Kural 11 (ajan önerisi; kullanıcı teyidi, 2026-11-24; TS-002 birinci çürütme turu, bulgu 7). Yenilemede denetimler şu sırayla yapılır: (1) belirtecin imzası ve türü; geçersizse ya da yenileme belirteci değilse hiçbir satıra dokunulmadan reddedilir. (2) Kişi ve oturum kilitlenir; oturum kapalıysa yalnız reddedilir (Kural 7). (3) Nesil satırdakinden büyükse ya da eşit olup özeti uymuyorsa tutarsızlıktır ve oturum kapatılır; küçükse: bir önceki nesil pencere içindeyse oturum yaşar (Kural 3 ve 4) ama 4–6. adımlardan geçmeden cevap üretmez, değilse yeniden kullanımdır ve kişinin bütün oturumları kapanır; yeniden kullanım kararı cihaz sırrına bakmaz. Kapalı oturuma eski nesil gelirse istek reddedilir ve güvenlik olayı yazılır; bu, Kural 7'deki "olay yalnız bir oturum kapandıysa yazılır" cümlesinin adıyla istisnasıdır (TS-002 ikinci tur 5, üçüncü tur 7). (4) Mutlak bitiş ya da hareketsizlik sınırı geçmişse oturum süre nedeniyle kapanır. (5) Adres, tarayıcı bilgisi ya da cihaz sırrı uymuyorsa yalnız o oturum kapanır (Kural 8). (6) Oturumun açıldığı giriş yöntemi kapatılmışsa oturum kapanır. (7) Döndürülür. Çözülen çatışma: eski belirteç yanlış cihaz sırrıyla gelirse Kural 8 "yalnız o oturum", Seçim 2 "bütün oturumlar" diyordu; sert olan seçildi.
- Kural 12 (ajan düzeltmesi, 2026-11-24; bulgu 1, 5 ve 12; kullanıcıya düzeltme olarak bildirildi, teyit istenmedi). Kişinin birden çok oturumuna dokunan her komut önce kişinin satırını kilitler; giriş, kilit altında kişinin durumuna ve doğrulamanın dayandığı sırrın değişmediğine yeniden bakar (kapatmayla yarışan giriş, kapatmadan sonra oturum bırakmaz). Kilit sırası bütün komutlarda aynıdır: genel sayaç, kişi, bağlantı ya da kod, oturumlar (TS-002 ikinci tur 11'e göre düzeltildi; ilk yazım oturumları öne alıyordu). Kişinin satırı anahtar dışı güncelleme kilidiyle kilitlenir (ölçüldü, 2026-11-24, GV-003: değer değiştirmeyen bir güncelleme model API'siyle gerçekten bir güncelleme deyimi gönderir ve bu kilidi alır; ham SQL gerekmez. Tekil dizinli kolonun değerini değiştiren güncelleme ise tam satır kilidi alır; giriş bilgisini değiştirme ve unutma bu kipe düşer). Hem oturum kapatıp hem isteği reddeden dal işlemi tamamlar ve reddi sonuç değeri olarak döndürür; hata olarak atılırsa kapatma da geri alınırdı (TS-002 üçüncü tur 6). Hareketsizlik sınırı yenilemede son döndürme zamanından denetlenir.
- Kural 13 (ajan önerisi; kullanıcı teyidi, 2026-11-24; bulgu 11). Sistem aktörü olmayan kullanıcı, açık giriş yöntemlerinden en az birinin giriş bilgisini taşır. "Kullanıcı aç" parola bağlantısını yalnız parola yöntemi açıksa üretir. Bir yöntem kapatılınca o yöntemle açılmış oturumlar bir sonraki yenilemede kapanır; son açık yöntem ve onunla girebilen (Kök, SuperAdmin) üyesi kalmayan yöntem kapatılamaz. Oturum, hangi yöntemle açıldığını taşır.
- Kural 10. IP ve tarayıcı bilgisi olduğu gibi saklanır (gizli değildir; "oturumlarım" listesinde gösterilecektir); cihaz sırrının yalnız özeti saklanır; IPv6'da adresin ağ kısmı karşılaştırılır (denenmedi).
- Açık (tasarlanmadı; kullanıcı kararı beklemiyor): imza anahtarının üretimi, saklanması ve değiştirilmesi; backend'e yalnız aracı katmanın ulaşmasını sağlayan ağ ayarı; refresh token'ın imzalı mı opak mı olacağı (kapandı, 2026-11-24: imzalı ve nesilli; Seçim 12); yenilemenin kullanıcının etkin olduğuna bakması (BADI'de var; orta bulgularla birlikte ele alınacak).

Neyden vazgeçildi: oturum denetiminin veritabanına hiç gitmemesi (her istekte bir satır daha okunur); mobilin backend'e doğrudan, aradaki durak olmadan ulaşması; ağ değiştiren kullanıcının oturumunun sürmesi; kanondaki yarışsız sabit refresh token.

## Kabulden önce kapanması gerekenler
Ajanın gördüğü açık noktalar (2026-11-23); altısı da kullanıcıyla kapatıldı. Bağımsız çürütme turu sonradan koştu ve bu kapanışlardan 2, 4 ve 6'yı yeniden açtı (TS-001 "KR-009 için ilk tur", bulgu 1, 3, 4 ve 17). Seçim 1 değişince (2026-11-23) 1, 2, 4 ve 5 numaralı kapanışlar Redis'teki oturum kaydına dayandığı için geçersiz kaldı: kapatma artık tek yere (oturum satırına) yazılır, Redis'te ömrü olan bir oturum kaydı yoktur ve Redis boşalınca oturumlar etkilenmez (yalnız KR-010'daki derleme dalgası olur). 6 numaralı kapanış (hoşgörü penceresi) geçerlidir; tanımı Kural 3 ve 4'te yazıldı. Aşağıdaki altı satır ilk hâlin kaydıdır.
1. Redis'e ulaşılamadığında oturum nasıl doğrulanır — kapandı (kullanıcı, 2026-11-23): istek reddedilir (Seçim 5). Sonuç (ajan): kişisiz iş oturum kullanmadığı için bundan etkilenmez; onun yetkisi KR-010'daki istisna yoluyla veritabanından derlenir.
2. Geri almada işlem sırası — kapandı (kullanıcı teyidi, 2026-11-23): önce Redis kaydı silinir, sonra veritabanı satırı iptal edilir; ikinci adım düşse bile kişi önce dışarıda kalır.
3. Parola özeti algoritması — kapandı (kullanıcı, 2026-11-23): Argon2id (Seçim 6).
4. Oturum kaydının ömrü — kapandı (kullanıcı teyidi, 2026-11-23): Redis'teki kayıt access token süresi kadar yaşar ve her yenilemede yeniden yazılır; hareketsizlik süresi veritabanındaki refresh satırının son kullanım zamanından denetlenir.
5. Yenileme dalgası — kabul edilen risk (kullanıcı teyidi, 2026-11-23): Redis boşalırsa bağlı herkes aynı anda yenilenir; yürüyen iskelette ölçülür.
6. Hoşgörü penceresi — kapandı (kullanıcı teyidi, 2026-11-23): eşzamanlı yenileme için kısa bir pencere olur ve istemciler (web ile mobil) tek yenileme kilidi kullanır; pencerenin süresi uygulamada ölçülerek konur.

## Sonuçlar
- Olumlu: kapatılan oturum bir sonraki istekte dışarıdadır; oturumun gerçeği tek yerdedir ve Redis'in kaybı ya da kesintisi oturumu düşürmez; çalınan refresh token fark edilir; oturum çekirdeği giriş yöntemine bağlı değildir; backend tek sözleşme bilir.
- Olumsuz: her istek veritabanında bir satır daha okur (ölçülmedi); ağ değiştiren kullanıcı yeniden giriş yapar ve dışarıya birden çok adresle çıkan ağdaki kullanıcı çalışamaz (Seçim 8); istemci eşzamanlı yenilemeyi kilitlemek zorundadır; mobilin her isteği aracı katmandan geçer ve aracı katman düşerse mobil de düşer (Seçim 4); parola girişini kullanmayan projede o parça boşta durur.
- Yükümlülük (kural adayları; taslakları açık noktalar kapanınca açılacak):
  1. Belirteç yetki bilgisi taşımaz.
  2. Oturum satırı açık olmayan istek reddedilir; Redis'te oturum kaydı tutulmaz.
  3. Refresh token özetlenerek saklanır ve tek kullanımlıktır; yeniden kullanım kullanıcının bütün oturumlarını kapatır.
  4. Backend çerez okumaz; çerez yalnız aracı katmanda yaşar.
  5. İsteği yapanın kimliği yalnız doğrulanmış belirteçten alınır (KU-013, var).
  6. Giriş yöntemi kapıyı uygular; oturum çekirdeği hiçbir yöntemi içe aktarmaz.
  7. Çıkış, parola değişimi ve kullanıcı kapatma ilgili oturum satırlarını kapatır.
  8. İmza RS256'dır (kanon).
  9. Yenileme cihaz bağı olmadan ya da yanlış bağla kabul edilmez; bağın yalnız özeti saklanır (Seçim 7).
  10. Her istekte isteğin IP adresi ve tarayıcı bilgisi oturum satırıyla karşılaştırılır; uymayan istek reddedilir; kapatma ayarı yoktur (Seçim 8).
  11. Backend'e yalnız aracı katman ulaşır; aracı katman isteği yapanın adresini ve tarayıcı ya da uygulama bilgisini imzalayarak iletir ve backend imzasız adres bilgisini yok sayar (Seçim 4, Kural 9).
  12. Oturum kapatma tek yazmadır ve nedenini taşır; yenileme oturum satırını kilitler (Kural 1).
  13. Hırsızlık alarmı yalnız döndürmeyle değiştirilmiş token için çalar; meşru nedenle kapanmış oturumun token'ı yalnız reddedilir (Kural 7).
  14. Oturumun mutlak bitişi döndürmeyle uzamaz (Kural 6).
  15. Web'de yenileme yalnız aracı katmanın istek girişinde ve yenileme ucunda yapılır (Kural 5).
  16. Redis'e ulaşılamazsa oturum kapatılmaz ve istek reddedilmez; yetki veritabanından derlenir (Seçim 5).
  17. Parola yalnız tek kullanımlık bağlantıyla belirlenir; bağlantının yalnız özeti saklanır ve yönetici bir kullanıcıya parola yazamaz (Seçim 9).
- Ortak parça: `shared` altında oturum çekirdeği, kimlik guard'ı ve giriş yöntemi kapısı; adları ve sınırları tasarlanmadı.
  - Uyarlama (kullanıcı, 2026-11-24; TS-002 "Yapı"): oturum ve kullanıcı tablolarının sahibi `kimlik` feature'ıdır; oturum çekirdeği (giriş, yenileme, kapatma) `kimlik`in içindedir. `shared`'de kimlik guard'ı, adres imzasının doğrulanması ve `kimlik`in uyguladığı arayüzler (oturum denetimi, giriş yöntemi kapısı) kalır. Üstteki satır kabulden önce buna göre yeniden yazılacak.

## Doğrulama
Denetim kimliği ve ölçüm tarihi henüz yok; kod yazılmadı.
Öneri (ajan). Birim: uç ve çağrı.
- Geri alma testi: oturum kapatıldıktan sonraki ilk istek reddedilir.
- Yeniden kullanım testi: aynı refresh token ikinci kez gelince kullanıcının bütün oturumları kapanır; çıkışla kapanmış oturumun token'ı geri gelince öbür oturumlar kapanmaz.
- Cihaz bağı testi: doğru refresh token eksik ya da yanlış cihaz bağıyla gelirse yenileme reddedilir.
- Adres testi: geçerli access token başka bir IP'den ya da başka tarayıcı bilgisiyle gelirse istek reddedilir; kişinin öbür oturumları açık kalır.
- Başlık testi: imzasız ya da yanlış imzalı "gerçek adres" bilgisi dikkate alınmaz; süresi geçmiş imza kabul edilmez.
- Pencere testi: aynı anda gelen iki yenileme isteğinden sonra oturum açıktır; pencere dışında gelen eski token bütün oturumları kapatır.
- Kaybolan cevap testi: cevabı alınmamış yenileme isteği aynen tekrarlanınca başarılı olur.
- Meşru iptal testi: çıkışla, süreyle ya da parola değişimiyle kapanmış oturumun token'ı geri gelince hırsızlık olayı yazılmaz.
- Mutlak süre testi: sürekli yenilenen oturum mutlak bitişte kapanır.
- Redis kesintisi testi: Redis yokken oturum kapanmaz, yenileme çalışır ve istek doğru yetkiyle cevaplanır; o sırada alınan bir yetki bir sonraki istekte etkisizdir; Redis dönünce istek yeniden giriş olmadan geçer.
- Çizim testi: süresi dolmuş access token ile gelen sayfa isteği oturumu düşürmeden yenilenir (Next.js sürümü seçilince).
- Davet testi: parola belirleme bağlantısı ikinci kez kullanılamaz; süresi dolan bağlantı çalışmaz; yönetici bir kullanıcıya parola yazamaz.
- Veri kaybı testi: Redis boşaltıldıktan sonra kapatılmış oturum geçerli sayılmaz; açık oturum yeniden giriş ya da yenileme gerektirmeden çalışır.
- Kapı testi: yeni bir giriş yöntemi oturum çekirdeği değişmeden eklenir.
- Sözleşme testi: backend çerezli isteği belirteç olmadan kabul etmez.

## Varsayımlar
- Redis yığında bulunur; kullanıcı beyanı (2026-11-23), kurulumda kesinleşecek; varsayım, 2026-12-21.
- Oturum satırı ile yetki sürümü tek sorguda okunabilir ve bu sorgu birincil veritabanına gider; ölçülmedi; varsayım, 2026-12-21.
- Aracı katman ve önündeki vekil tarayıcının gerçek adresini güvenilir biçimde iletebilir; tasarlanmadı ve denenmedi; varsayım, 2026-12-21.
- IP kapısının yeniden giriş yükü kullanılabilir düzeydedir; ölçülmedi; varsayım: yürüyen iskeletten sonra "adres değişti" nedeniyle kapanan oturum sayısına bakılır, 2026-12-21.
- Kanondaki süre ve sınır sayıları varsayılan olarak yeterlidir; ölçülmedi; varsayım, 2026-12-21.
- RS256 anahtarlarının üretimi, saklanması ve değiştirilmesi tasarlanmadı; varsayım: altyapı kararlarıyla birlikte ele alınır, 2026-12-21.
- Mobilde güvenli saklama için kütüphane seçilmedi; mobil yüzey kanonda yoktur; varsayım: mobil kümesinde kararlaştırılır, 2026-12-21.
- Aracı katmandaki sahte istek koruması frontend kümesinde kararlaştırılır; varsayım, 2026-12-21.
- Hız sınırı ve kaba kuvvet koruması kanonun ayrı bölümündedir ve henüz alınmadı; varsayım: ayrı kümede ele alınır, 2026-12-21.

## Geri dönüş
- Oturum denetiminin yeri (veritabanı, Redis ya da hiç) sunucu tarafında değişir; belirteç biçimi değişmezse istemciler etkilenmez.
- Döndürmeden sabit refresh token'a dönüş istemciyi bozmaz; tersi istemcide yenileme kilidi ister.
- Mobili yeniden doğrudan bağlamak: backend iki durumda da başlıktaki belirteci tanıdığı için mobilde adres değişir ve backend dışarı açılır; o zaman adres bilgisine güven yalnız imzaya kalır (öngörü, ajan; denenmedi). Web'i aracı katmandan çıkarmak en pahalı dönüştür: çerez, alan adı ve sahte istek korumaları backend'e taşınır.
- Yeniden bakma tetiği belirlenmedi; aday: yürüyen iskelette ölçülen Redis gidiş süresi ve yenileme dalgası.

## İstisna yolu
- Kişisiz iş (zamanlanmış iş, olay tüketicisi) belirteç ve oturum kullanmaz; sistem aktörüyle çalışır (KR-010 Seçim 25).
- Kimlik gerektirmeyen uçlar (sağlık denetimi, dış sistemden gelen çağrı) KR-007'deki istisna yolunu izler.
- Bunların dışındaki sapma için yol tanımlanmadı; kullanıcıya sorulacak.
