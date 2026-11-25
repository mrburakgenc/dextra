---
kimlik: TS-008
tur: tasarim
durum: taslak
surum: 1
baslik: Yetenekte etki ve öncelik: giremez kuralı izinleri önceliğe göre kapatır
agirlik: tek-yonlu
tarih: 2026-11-25
---
Yeteneğe etki (girebilir ya da giremez) ve öncelik eklenir: giremez kuralı, kendisinden yüksek öncelikli olmayan girebilir kurallarını tuttuğu kayıtlarda ve kolonlarda kapatır; girebilir kuralları kendi aralarında bugünkü gibi birleşir.

## Sorun
Kullanıcı (2026-11-25, kendi sözü): "bak şimdi burada yetenekte yetenekler eğer eşitse yaptığımız bir hata var adamda 2 yeri aynı yeteneği varsa kazanma durumu vardı priority mevzusu ne oldu o iş kanondaki gibi sadeleştiğinde o yapı takır takır çalışıyordu". Sorulunca "şimdi tasarlansın" dedi.

Ölçülenler (2026-11-25):
- Bugün yalnız izin veren kural vardır ve kazanan yoktur: okumada yeteneklerin satırları birleşir, her kayıt kendisini tutan yeteneklerin kolonlarının birleşimini taşır; yazmada adaylar oluşturulma sırasıyla denenir (`backend/src/shared/yetki/infrastructure/okuma-kapisi.ts`, `yazma-kapisi.ts`).
- Yetenek kararı (KR-008, taslak) Seçim 9: "öncelik ve etki alanı (girebilir / giremez) ilk sürümde yoktur; kapatma özelliği yazılırken birlikte eklenir"; 2026-11-23'te kullanıcı teyidiyle ertelenmişti. Seçim 3: "satırlar birbirini ezmez".
- Kanon (`kb/_gelen/ARCHITECTURE.md` satır 429): kurallar "can()/cannot() rule'ları priority sırasına göre" derlenir. Ekrandaki yetki kitaplığının doğal davranışı da budur: kurallar sırayla değerlendirilir, son eşleşen kazanır; yalnız izin veren kurallar arasında sıranın etkisi yoktur (çürütme turunda kurulu sürümle ölçüldü).
- Örnek: kişi aynı birimde hem Müdür (bütün kolonlar) hem Stajyer rolünü taşıyorsa bugün Stajyer rolüyle hiçbir şey kısıtlanamaz.

Yön (kullanıcı, 2026-11-25): ilk taslak "önceliği yüksek olan yetenek tek başına geçerli" anlamını taşıyordu; bağımsız çürütme turu onu imzalamadı (aşağıda "Çürütme") ve kullanıcı bedelleri görünce yönü değiştirdi: "Kanondaki gibi: giremez kuralı ve öncelik".

- Amaç: yöneticinin bir eylemi, bir kaydı ya da bir kolonu açıkça yasaklayabilmesi ve yasağın hangi izinlerin önüne geçeceğini öncelikle belirleyebilmesi.
- Kapsam dışı: kayıt katmanının yeri (TS-007; ondan bağımsızdır: etki ve öncelik yalnız yetki motorunun içini ve derlemeyi değiştirir, repository'lerin biçimini değiştirmez).
- Başarının ölçüsü: var olan bütün veri ve testler değişmeden bugünkü gibi çalışır (hepsi girebilir, öncelik 0); Stajyer rolüne yazılan bir giremez kuralıyla örnekteki kişi yasaklanan kolonu göremez ve yazamaz; ekran aynı kararı gösterir.

## Kısıtlar
- Kullanıcının kararları (2026-11-25) bağlayıcıdır: yön (giremez kuralı ve öncelik); girebilir kuralları eşit öncelikte bugünkü gibi birleşir; yazmada yasak alanı kapsıyorsa cevap "yetki yok"tur; öncelik sayıdır, varsayılan 0, büyük sayı kazanır.
- Var olan davranış korunur: etkisi yazılmamış yetenek girebilirdir, önceliği yazılmamış yetenek 0'dır; göç var olan satırlara bunları yazar.
- Veri kararını sunucuda veritabanı verir (KR-010): yasak da sorguya çevrilir, bellekte kayıt süzülmez.
- Süzme ve sıralama görünmeyen kolonu ele vermez (bugünkü kural).
- Yetenek değişmez satırdır (KR-008 Seçim 7): etki ve öncelik yazılırken ve yenilenirken verilir.
- Kullanıcının ilkesi (KR-008; 2026-11-23): önce kapatılır, sonra açılır; tanım yanlış ya da eksikse erişim kapalı kalır.

## Yapı (taslak; açık uçlar kapanmadan kesinleşmez)
### Veri
Yetenek satırına iki kolon eklenir: `etki` (girebilir ya da giremez; varsayılan girebilir) ve `oncelik` (tam sayı; varsayılan 0; büyük kazanır). İkisi de kaynak kataloğunda Yetenek'in kolonudur.

### Tanım
Bir kişi, bir eylem, bir kayıt ve bir kolon için: kaydı tutan ve o kolonu kapsayan kurallar arasında önceliği en yüksek olan karar verir; girebilir ise izin vardır, giremez ise yoktur. Kolon listesi olmayan giremez kuralı kaydın bütününü kapatır. Hiç girebilir kuralı tutmayan kayıt bugünkü gibi görünmez. Girebilir kuralları birbirini kapatmaz: aynı kaydı tutanların kolonları birleşir.

### Okuma
- Satırlar: bir kayıt, onu tutan bir girebilir kuralı varsa ve o kuraldan düşük öncelikli olmayan, kaydın bütününü kapatan bir giremez kuralı onu tutmuyorsa gelir.
- Kolonlar: kayıt, kendisini tutan girebilir kurallarının kolonlarından, onlardan düşük öncelikli olmayan giremez kurallarının kapattıkları çıkarılmış hâlini taşır.
- Süzme ve sıralamada bakılan kolon kayıtta görünür olmalıdır (bugünkü kural); kapatılmış kolona göre süzülen ya da sıralanan okumaya o kayıt girmez.

### Yazma
Şartlı yazmanın bugünkü sırası korunur; adaylar belirlenirken satırı tutan giremez kuralları da okunur ve yazmanın yeteneği, yazılan alanlarda kendisinden düşük öncelikli olmayan bir giremez kuralıyla kapatılmamış olmalıdır; değilse "yetki yok". Bu karar satır kilitlendikten sonra, kilit altında verilir (çürütme 4).

### Derleme ve ekran
Derleyici kuralları artan öncelikle sıralar ve giremez kuralını ters (inverted) kural olarak üretir; aynı öncelikte giremez kuralı girebilir kuralından sonra gelir. Ekran aynı kuralları yetki kitaplığıyla değerlendirir (KR-010). Uç guard'ı değişmez.

### Yönetim
Yetenek yazma ve yenileme uçları isteğe bağlı `etki` ve `oncelik` alır; liste ve kayıt sayfası ikisini gösterir; formlara iki alan eklenir.

## Seçenekler
### 1. Yön (kullanıcı, 2026-11-25)
- A (seçildi: "Kanondaki gibi: giremez kuralı ve öncelik") — Açık yasak yazılabilir; ekrandaki kitaplığın doğal davranışıdır; KR-008 Seçim 9'un ertelediği "kapatma" budur.
- B (ilk seçim; çürütme turundan sonra kullanıcı bıraktı) — Önceliği yüksek olan yetenek tek başına geçerli: emsali yoktu; veritabanında olumsuzlama ve ekranda yapay ters kural istiyor, bir eylemi yasaklayamıyordu.
- C — Önceliği ertelemek: bugünkü birleşim kalırdı.

### 2. Girebilir kurallarının eşit öncelikte birleşmesi (kullanıcı, 2026-11-25: "Eşit olanlar birleşsin")
Yeni yönde girebilir kuralları her öncelikte birleşir; kullanıcının seçimi bunun içindedir.

### 3. Yazmada (kullanıcı, 2026-11-25: "Yetki yok")
Yasak alanı kapsıyorsa daha düşük öncelikli bir izne düşülmez.

### 4. Değer (kullanıcı, 2026-11-25: "Sayı, varsayılan 0, büyük kazanır")

## Açık uçlar
- AU-16: Bu tasarım yetenek kararını değiştirir (KR-008 Seçim 3, 9 ve 30; KR-010 derleme eşlemesi): değişikliği hangi karar taslağı taşıyacak?

## Kapanan uçlar
- AU-1 (kullanıcı, 2026-11-25): "Yasak kazanır": aynı öncelikte giremez kuralı girebilir kuralını kapatır; izin yasağı aşmak için daha yüksek öncelikle yazılır. Soru: Aynı öncelikte bir girebilir ve bir giremez kuralı aynı kaydı ve kolonu tutuyorsa hangisi geçerli? Kullanıcının ilkesi ("önce kapatılır") giremezin kazanmasını gösterir; karar kullanıcınındır.
- AU-2 (kullanıcı, 2026-11-25): "Kapatamaz": SuperAdmin'in sistem yetenekleri her yasağın üstünde sayılır; kilitlenme olmaz, SuperAdmin hiçbir yasakla daraltılamaz. Soru: SuperAdmin'in sistem yetenekleri bir giremez kuralıyla kapatılabilir mi? Kapatılabilirse yönetici kendini kilitleyebilir (çürütme: herkesin taşıdığı temel üyeliğe düşen bir yasak yetenek ekranını kör eder; ikinci bir hatayla tek çıkış göçtür). Adaylar: sistem satırları her yasağın üstündedir; ya da korunan kaynaklarda ve kök kümelerde giremez yazılamaz; ya da kapatılabilir kalır ve kilit göçle çözülür.
- AU-3 (kullanıcı, 2026-11-25): "Evet, kişinin bütün izinlerini": yasak kişiye yapışır; hangi üyelikten gelirse gelsin şartı tuttuğu kayıtlarda geçerlidir. Soru: Giremez kuralı kişinin bütün üyeliklerindeki izinleri mi kapatır, yalnız aynı birimin izinlerini mi? Birim şartı olan kaynakta yasak zaten o birimin kayıtlarıyla sınırlıdır; birim kolonu olmayan kaynaklarda (kullanıcı, oturum, rol, izin) bir birimden gelen yasak kişiyi her yerde kısıtlar. KR-008 "Rol karışması" güvencesiyle birlikte düşünülmelidir.
- AU-4 (kullanıcı, 2026-11-25): "O izni o kişide kapat": derlenemeyen ya da şartı çözülemeyen yasak, o eylemi o kaynakta o kişi için tümden kapatır ve günlüğe hata yazılır; yasak düzeltilince açılır. Soru: Derlenemeyen ya da şartı çözülemeyen giremez kuralı ne yapar: düşer mi (yasak kalkar, erişim genişler), yoksa o izni o kişide tümden kapatır mı? Kullanıcının ilkesi kapatmayı gösterir.
- AU-5 (kullanıcı, 2026-11-25): "Yasaklı sayılmasın": şartı kesin tutmayan kayıt yasağın dışındadır; sorguda boş değer ayrıca ele alınır ve kolonun boş olabilirliği kataloğa yazılır. Ekrandaki değerlendirmeyle aynı sonuç. Soru: Giremez kuralının şartı bir kayıtta boş değer yüzünden "bilinmiyor" çıkarsa yasak o kaydı tutuyor mu sayılır? (Veritabanında olumsuzlanan koşul boş değerde satır kaybeder; çürütme 1. Tutmuyor sayılırsa katalogda kolonun boş olabilirliği gerekir.)
- AU-6 (kullanıcı, 2026-11-25): "Değerlendirilemeyen yasak ekranda yasak sayılsın": ekran emin olamadığı düğmeyi ve formu gizler; özel eşleyici yazılır. Kararı her durumda sunucu verir. Soru: Ekran, şartı ekrana gelmeyen bir kolona bakan giremez kuralını değerlendiremez ve bugünkü kitaplıkla "izin var" der (çürütme turunda ölçüldü): kısıtlı kişi yazamayacağı formu görür, backend reddeder. Değerlendirilemeyen yasak ekranda "yasak" mı sayılsın (özel eşleyici ister; bazı düğmeler gereksiz gizlenir), yoksa bugünkü sınır mı geçerli olsun (ekran gösterebilir, kararı backend verir)?
- AU-9 (kullanıcı, 2026-11-25): "Eski satırın değerleri korunsun": yenilemede etki ve öncelik verilmezse eski satırınkiler yazılır; değiştirmek isteyen açıkça verir. Soru: Yenilemede etki ve öncelik verilmezse eski satırın değerleri mi korunur, varsayılan mı yazılır? (Varsayılan yazılırsa yasak sessizce izne döner; çürütme 10.)
- AU-10 (kullanıcı, 2026-11-25): "Bütün eylemlerde": her izin için yasak yazılabilir; oluşturma, silme ve niyet eylemlerinde yasak kaydın bütünü içindir. Soru: Giremez kuralı hangi eylemlerde yazılabilir: yalnız okuma ve güncellemede mi, oluşturma, silme ve niyet eylemlerinde de mi? Silme ve niyet eylemlerinde kolon sınırı olmadığı için yasak kaydın bütünü içindir.
- AU-7 (kullanıcı, 2026-11-25): "0 ile 100 arası": negatif yok; 0 en alt düzeydir ve varsayılanla yazılan satır hiçbir şeyi ezmez; üst sınır 100. Soru: Önceliğin aralığı: alt ve üst sınır var mı, negatif yazılabilir mi?
- AU-8 (kullanıcı, 2026-11-25): "Ayrı bir izin": yeteneğin etkisini (yasak) ve önceliğini yazmak için yetenek yazma izninden ayrı bir izin gerekir; izin satırı, göç ve tohum yeteneği eklenir. İznin adı ve bu iznin yenilemeyle ilişkisi tasarımın 'Yapı'sında yazılacak. Soru: Etkiyi ve önceliği kim yazabilir: yetenek yazabilen herkes mi, ayrı bir izin mi?
- AU-11 (kullanıcı, 2026-11-25): "Reddedilsin": yazmanın sonucu yasaklı bir kayıtsa işlem "yetki yok" alır ve geri alınır (iki hâl kuralının yasak karşılığı). Soru: Güncellemede yeni hâl bir yasağın içine giriyorsa yazma reddedilir mi (iki hâl kuralının yasak karşılığı)?
- AU-13 (kullanıcı, 2026-11-25): "etkilemesin ve şöyle de bir şey var sistem aktörü ile asla giriş yapılamasın": sistem aktörünün yetenekleri yasakların üstünde sayılır. İkinci cümle ayrı bir karardır ve TS-002'ye yazıldı (bugün girişte, oturum denetiminde, parola bağlantısında ve giriş bilgisi değişikliğinde reddediliyor; testleri var). Soru: Kişisiz işlerin sistem aktörü yasaklardan etkilenir mi?
- AU-12 (kullanıcı, 2026-11-25): "Evet, yalnız göçle": sistem satırlarının etkisi ve önceliği çalışma anında değiştirilemez; bugünkü koruma aynen kalır. Soru: Sistem satırlarının (tohumla gelen yetenekler) etkisi ve önceliği çalışma anında değiştirilemez; yalnız göçle değişir. Bu kabul mü?
- AU-14 (kullanıcı, 2026-11-25): "Kayıt ve teşhis ucu": yasağın reddettiği işte karar veren yetenek erişim kaydına yazılır; ayrıca yönetici bir kişi, bir eylem ve bir kayıt için hangi kuralların tuttuğunu ve hangisinin karar verdiğini sorabildiği bir uç ve ekran alır. Soru: Erişim kaydına ve değişiklik kaydına yasaklar yazılır mı (hangi yasak hangi kolonu kapattı)? Yönetici "bu kişi bu kayıtta neden şunu göremiyor" sorusunu nereden cevaplar?
- AU-15 (kullanıcı, 2026-11-25): "Önce ölç, sınırı ölçümle koy": ilk sürümde sınır yoktur; son aşamada 1, 10 ve 50 yasakla liste süresi ölçülür ve rapora yazılır; sınır gerekiyorsa kullanıcı o ölçümle karar verir. Soru: Bir kişide aynı izin için kural ve öncelik düzeyi sayısına üst sınır konur mu (sorgu büyüklüğü; ölçülmedi)?
- AU-17 (kullanıcı, 2026-11-25): "Son aşamaya kadar yazılamasın": kolonlar ve motor hazırlanır; giremez kuralı ve sıfırdan farklı öncelik yazımı son aşamada açılır. Soru: Geçiş boyunca tutarsız ara durum olmasın diye, okuma ve yazma motoru ile ekran bitene dek giremez kuralı ve sıfırdan farklı öncelik yazılması reddedilsin mi?

## Aşamalar (açık uçlar kapanınca kesinleşir)
1. Veri ve taşıma: iki kolon, göç, katalog, derleyici, yönetim uçlarının gövdesi; motor etkiyi ve önceliği taşır ama henüz kullanmaz, giremez yazılamaz (davranış değişmez).
2. Okuma motoru: yasaklı satır koşulu ve kolonların çıkarılması.
3. Yazma motoru: yasağın kilit altında sınanması.
4. Ekran: yetkilerim cevabı ve yetki kuralları, yetenek formu, liste ve kayıt sayfası.
5. Bütün: örnek senaryonun uçtan uca testi ve tarayıcı denemesi; giremez yazımının açılması.
Sıra bağlayıcıdır; ilgili açık uç kapanmadan aşama başlamaz.

## Doğrulama
- Var olan uçtan uca testlerin hepsi beklentileri değişmeden geçer (hepsi girebilir, öncelik 0).
- Yeni testler: Müdür ve Stajyer örneği (okuma, kolonlar, yazma); kaydın bütününü kapatan yasak; yüksek öncelikli iznin düşük öncelikli yasağı aşması; eşit öncelik (AU-1'in kararına göre); boş değerli kayıt (AU-5); koşulsuz yasak ve koşulsuz izin; yasaklı kolona göre süzme ve sıralama; yarış (yazmada kilit altında karar).
- Ekran: aynı kurallarla aynı karar (AU-6'nın kararına göre); backend ile ekranın sekiz işleçte aynı sonucu verdiğini gösteren eşlik testi.
- Tek yönlü kaydın istediği bölümler (senaryolar, kapasite, hata modları, performans) açık uçlar kapandıktan sonra yazılır; ardından ikinci bir bağımsız çürütme turu koşar.

## Çürütme
İlk taslak ("önceliği yüksek olan tek başına geçerli") için bağımsız çürütme turu 2026-11-25'te koştu (ayrı bir oturum; dosya değiştirmedi; ekrandaki kitaplığın davranışını kurulu sürümlerle ölçtü, Prisma ve veritabanı davranışını belgeden okudu, ölçmedi). İnceleyicinin hükmü: "bu hâliyle imzalamam". Kullanıcı bulguları görünce yönü değiştirdi; bu kayıt yeni yöne göre yeniden yazıldı ve yeni yön için çürütme turu HENÜZ KOŞMADI.

İlk taslağın engel bulguları ve yeni yöndeki karşılıkları:
1. Olumsuzlanan koşul boş değerde satır kaybeder (örnek: üst grubu boş olan kök grup). Yeni yönde de geçerlidir: yasak, satır koşulunda olumsuzlanır. Karşılığı AU-5.
2. Koşulsuz kural düzeyli koşulda eski hatayı (TS-002 AK-52) iki yöne de açar. Yeni yönde koşulsuz yasak ve koşulsuz izin için kural ve test gerekir ("Doğrulama").
3. Derlenemeyen kısıtlayıcı kural düşünce erişim genişler. Karşılığı AU-4.
4. Yazmada kararı vermekle satırı kilitlemek arasında yarış. Karşılığı "Yazma": karar kilit altında verilir.
5. Ekran, şartı kayıtta olmayan kolona bakan ters kuralda "izin var" der (ölçüldü). Karşılığı AU-6.

İlk taslağa özgü olup yeni yönde düşen bulgular: okumayı kısıtlayan satırın yazmayı kısıtlamaması (yeni yönde her eylem için yasak ayrıca yazılır; AU-10); "tek başına geçerli" düzeyin kaydı görünmez yapması; karesel sorgu büyüklüğü (yeni yönde büyüklük yasak sayısıyla artar; AU-15).

En güçlü karşı görüş ilk taslağa karşıydı ve yönü değiştirdi: seçilen anlam adı konmamış bir "giremez" kuralıydı; onun bedelini ödüyor, kazancını almıyordu. Kalan bedel yeni yönde de sürer: "satır eklemek yalnız erişim açar" özelliği gider (yasak silinirse ya da bozulursa erişim genişler); karşılığı AU-4.

Doğrulanamayanlar: Prisma'nın olumsuzlama ile boş değer ve boş koşul davranışı bu depoda ölçülmedi; kilit beklerken koşulun yeniden değerlendirilmesi çıkarımdır; sorgu büyüklüğü ölçülmedi.
