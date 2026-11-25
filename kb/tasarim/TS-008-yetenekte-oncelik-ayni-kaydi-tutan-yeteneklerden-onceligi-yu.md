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

## Senaryolar
Ortam: bugünkü tek süreçli backend ve yerel PostgreSQL. Sayılar sayımdır; süre hedefi yoktur (AU-20).
1. Kişi aynı birimde Müdür ve Stajyer rolünü taşır; Stajyer'e "kullanıcı okuma, giremez, kolon: telefon, öncelik 10" yazılır. Kişinin kullanıcı listesinde ve kayıt sayfasında telefon 0 kayıtta gelir; öbür kolonlar bugünkü gibidir.
2. Aynı kişiye "grup silme, giremez, şart: üst grubu kök, öncelik 10" yazılır. Kökün altındaki bir grubu silme isteği "yetki yok" alır; 0 satır değişir, değişiklik kaydı yazılmaz; erişim kaydında karar veren yasak 1 satırdır.
3. Yasak öncelik 10, aynı kaydı tutan izin öncelik 20: izin geçerlidir (yasak 0 kaydı kapatır). İkisi de 10 ise yasak kazanır.
4. Şartı çözülemeyen bir yasak (alt grup listesi boş çıkan) kişide o izni tümden kapatır: liste 0 kayıt döner, yazma "yetki yok" alır, günlüğe istek başına 1 hata satırı düşer.
5. SuperAdmin'in üyesi olduğu kümeye yazılan yasak SuperAdmin'in sistem yeteneklerini kapatmaz: SuperAdmin bütün kayıtları ve kolonları görür (0 fark).
6. Yasağın şartı boş değerli bir kolona bakıyorsa o kayıt yasaklı sayılmaz: üst grubu boş olan kök grup, "üst grubu X olanlar" yasağından etkilenmez.
7. Var olan veri: 29 canlı yeteneğin hepsi girebilir ve öncelik 0'dır; var olan uçtan uca testler değişmeden geçer ve yasağı olmayan kişinin sorguları bugünküyle aynıdır (0 ek sorgu).
8. Ekran: 1. senaryodaki kişi için telefon kolonunun başlığı çizilir (tür düzeyinde okuyabildiği kayıtlar olabilir) ama hücre boştur; 2. senaryodaki kişi kökün altındaki grubun sayfasında silme düğmesini görmez.

## Kapasite
- Ölçüm (yerel veritabanı, tohum hâli, 2026-11-25): 29 canlı yetenek, 27 izin, 2 rol, 1 grup, 2 üyelik, 2 kullanıcı; bir kişiye aynı izin için düşen yetenek en çok 2'dir (ortalama 1,1). Gerçek kullanım verisi yoktur: bu depo base'dir, üzerinde proje yoktur.
- Aritmetik (ölçüm değildir): bir izin için k izin kuralı ve y yasak varsa satır koşulu en çok k × (1 + y) şart taşır (her izin dalına, ondan düşük öncelikli olmayan kayıt yasaklarının "kesin tutmuyor" hâli eklenir). k = 2 ve y = 10 için 22, k = 5 ve y = 50 için 255 şart.
- Kolon yasakları sayfadaki kimlikler için okunur: kolon kümeleri bugün farklıysa kural başına 1 ek sorgu atılıyor; kolon yasağı olan okumada en çok 1 ek sorgu daha (yasakların hangi kayıtları tuttuğu) eklenir.
- Etkisi ölçülmedi; son aşamada 1, 10 ve 50 yasakla ölçülür (kullanıcı kararı, kapanan AU-15).

## Veri modeli
- Yetenek satırına iki kolon: `giremez` (evet ya da hayır; varsayılan hayır) ve `oncelik` (tam sayı; varsayılan 0; veritabanı kısıtıyla 0–100). Göç var olan satırlara varsayılanları yazar. İkisi de kaynak kataloğunda Yetenek'in kolonudur ve değişiklik kaydına bugünkü kurallarla girer.
- Yeni izin satırı: yasak ve sıfırdan farklı öncelik yazmak için (kapanan AU-8); adı ve kapsamı AU-18. İzin göçle eklenir ve SuperAdmin'e tohumlanır.
- Kaynak kataloğu kolonun boş olabilirliğini taşır (kapanan AU-5 için gerekir); şemadan okunur, elle liste tutulmaz.
- Erişim kaydı (iz veritabanı): bir istekte karar veren yasakların yetenek kimlikleri, izin veren yeteneklerden ayırt edilerek yazılır.
- Yetenek değişmez satırdır: iki kolon yazılırken ve yenilenirken verilir; yenilemede verilmezse eski satırın değerleri korunur (kapanan AU-9). Sistem satırlarının değerleri yalnız göçle değişir (kapanan AU-12).

## Yapı
### Tanım
Bir kişi, bir eylem, bir kayıt ve bir kolon için: kaydı tutan izin kuralları arasından biri, o kolonda kendisinden düşük öncelikli olmayan ve kaydı kesin tutan bir yasakla kapatılmamışsa izin vardır. Eşit öncelikte yasak kazanır; daha yüksek öncelikli izin yasağı aşar. Kolon listesi olmayan yasak kaydın bütününü kapatır. İzin kuralları birbirini kapatmaz: aynı kaydı tutanların kolonları birleşir.

### Muafiyetler
- Sistem satırı olan izin kuralları yasaklardan etkilenmez (kapanan AU-2); böylece SuperAdmin kilitlenemez.
- Sistem aktörünün derlenmiş yetkisine yasak girmez (kapanan AU-13).
- Yasak, kişiye hangi üyelikten gelirse gelsin bütün izinlerine uygulanır (kapanan AU-3).

### Derleme
- Derleyici her kurala önceliğini ve etkisini yazar. Şartı çözülemeyen ya da derlenemeyen yasak, o eylem ve kaynak için kişiye koşulsuz, bütün kolonlu, en yüksek öncelikli bir yasak olarak derlenir ve günlüğe hata yazılır (kapanan AU-4); sistem satırı muafiyeti bunda da geçerlidir.
- Yasağın olumsuzu veritabanı istemcisinin genel "değil"i ile yazılmaz: şart ağacından "kesin tutmuyor" koşulu üretilir (yaprakta: koşul sağlanmıyor ya da kolon boş; "ve" ile "veya" yer değiştirir). Bunu şart çevirici yapar ve kolonun boş olabilirliğini katalogdan okur. Koşulsuz yasağın "kesin tutmuyor" hâli hiçbir kaydı tutmayan koşuldur (boş koşul değil).

### Okuma
- Satırlar: izin kuralı başına bir dal; dal, kuralın şartı VE ondan düşük öncelikli olmayan kayıt yasaklarının "kesin tutmuyor" koşullarıdır; dallar "veya" ile birleşir. Yasağı olmayan kişide koşul bugünküyle aynıdır.
- Kolonlar: kayıt, kendisini tutan ve kapatılmamış izin kurallarının kolonlarından, o kuraldan düşük öncelikli olmayan ve kaydı tutan kolon yasaklarının kolonları çıkarılmış hâlini taşır; kimlik her zaman gelir.
- Okumaya katılma: çağıranın süzdüğü ya da sıraladığı kolon, kayıtta görünür olmalıdır; o kolonu bir yasakla kaybeden kayıt o okumada gelmez.
- Erişim kaydı birikimine izin veren yetenekler ile karar veren yasaklar ayrı ayrı girer.

### Yazma
Şartlı yazmanın bugünkü sırası korunur. Satır kilitlendikten sonra, kilit altında: satırı kesin tutan yasaklar okunur; yazmanın yeteneği, yazılan alanlarda (silme ve niyet eylemlerinde kaydın bütününde) kendisinden düşük öncelikli olmayan bir yasakla kapatılmışsa aday olmaz; aday kalmazsa "yetki yok". Yazmadan sonra yeni hâl de aynı biçimde sınanır: yeni hâli tutan bir yasak yazmanın yeteneğini kapatıyorsa iş geri alınır (kapanan AU-11). Oluşturmada sınama yazılan satırın üzerinde yapılır. Reddi veren yasak erişim kaydına yazılır.

### Ekran
- `kimlik/oturum/yetkilerim` kuralları artan öncelikle, aynı öncelikte izinler önce yasaklar sonra gelecek biçimde verir; yasak ters kuraldır. Sistem satırı muafiyeti için sistem izinleri en sonda verilir.
- Ekran, ters kuralın şartını değerlendiremiyorsa (şartın baktığı kolon kayıtta yoksa ya da işleç tanınmıyorsa) yasağı tutuyor sayar (kapanan AU-6); bunun için ters kurallara özel eşleyici yazılır. Tür düzeyi sorular (menü, kolon başlığı) şartlı ters kuraldan etkilenmez; koşulsuz yasak tür düzeyinde de "hayır"dır.
- Uç guard'ı değişmez: o izin için herhangi bir izin kuralı olan kişi uca girer; karar kayıtta verilir.

### Yönetim ve teşhis
- Yetenek yazma ve yenileme gövdeleri isteğe bağlı `giremez` ve `oncelik` alır; yasak ya da sıfırdan farklı öncelik yeni izni ister. Liste ve kayıt sayfası iki alanı gösterir; formlara iki alan eklenir. Bu yazım son aşamaya kadar reddedilir (kapanan AU-17).
- Teşhis ucu: yönetici bir kişi, bir eylem, bir kaynak ve bir kayıt için o kaydı tutan kuralları (yetenek, etki, öncelik, kolonlar) ve kolon başına karar veren kuralı okur; bir ekranı vardır (kapanan AU-14). İzni AU-19.

### Ajan kararları (kullanıcı teyidi bekler)
- AK-1: Etki, iki değerli olduğu için evet ya da hayır kolonu (`giremez`) olarak modellenir; ayrı bir etki tablosu ya da kod sabiti eşlemesi kurulmaz. Üçüncü bir etki gerekirse kolon o zaman tabloya çevrilir.
- AK-2: Derlenemeyen yasağın yerine konan kural "koşulsuz, bütün kolonlu, öncelik 100" yasaktır; böylece "o izni o kişide kapat" kararı ayrı bir düzenek olmadan, aynı motorla uygulanır.
- AK-3: Sistem satırı muafiyeti SuperAdmin rolüyle sınırlı değildir, bütün sistem satırlarını kapsar (bugün: SuperAdmin'in yetenekleri ve herkesin taşıdığı temel rolün "kendi oturumun" satırları). Sonucu: temel role ileride tohumlanacak dar sistem satırları da yasakla kapatılamaz.

## Hata modları
- Yasak silinir ya da pasife çekilir: erişim genişler. Fark edilmesi: değişiklik kaydı (yetenek silme notu). Yayılımı: o yasağın tuttuğu kayıtlar. Bu, yasak kavramının kendisinden gelir; "satır eklemek yalnız erişim açar" özelliği artık yoktur.
- Yasak derlenemez: o izin kişide kapanır (karar); günlükte hata; yönetici teşhis ucunda "derlenemeyen yasak"ı görür. Yayılımı: o kümenin bütün üyeleri, o izinde.
- Yasak yanlış kümeye yazılır (herkesin taşıdığı temel role): herkes kısıtlanır; SuperAdmin muaftır ve yasağı siler. Kilitlenme yoktur.
- Kısıt niyetiyle yazılıp önceliği izinden düşük bırakılan yasak etkisizdir (yüksek öncelikli izin aşar). Fark edilmesi: teşhis ucu karar veren kuralı gösterir.
- Ekran ile sunucu ayrışır (işleç eşliği bozulursa): ekran yanlış düğme gösterir ya da gizler; karar sunucudadır, veri sızmaz. Fark edilmesi: eşlik testi.
- Boş olabilirlik katalogda yanlışsa: boş değerli kayıt yasaklı sayılır ya da sayılmaz. Karşılığı: katalog şemadan okunur ve boş değerli kayıt testi vardır.
- Yazmada yarış: karar kilit altında verildiği için araya giren işlem yasağı atlatamaz; kilit beklerken koşulun yeniden değerlendirildiği varsayımdır ve yarış testiyle ölçülecektir.
- Geçiş: yazım son aşamaya kadar kapalı olduğu için yarım çalışan yasak oluşmaz.

## Performans mantığı
- En sık yol, yasağı olmayan kişinin liste okumasıdır: koşul ve sorgu sayısı bugünküyle aynı kalmalıdır (0 ek sorgu; testle sınanır).
- Yasağı olan kişide: satır koşuluna yasak başına bir "kesin tutmuyor" grubu eklenir (izin dalı başına); olumsuzlanmış koşul dizin kullanamayabilir. Kolon yasaklarında sayfa başına en çok 1 ek sorgu.
- Derleme isteğin başında bir kez yapılır ve bugünkü bellek kaydıyla saklanır; yasak ve öncelik yazımı genel sayacı artırdığı için bayat kural kalmaz (bugünkü düzenek).
- Veri büyüdükçe: satır koşulundaki şart sayısı k × (1 + y) ile artar; ölçüm son aşamadadır.

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
- AU-18: Yasak ve sıfırdan farklı öncelik yazmak için gereken ayrı iznin kapsamı. Öneri: izin "Yetenek:yasakla"dır ve yasak ya da sıfırdan farklı öncelik taşıyan bir yeteneği yazmak, yenilemek ve silmek bu izni ister (yalnız yazmak değil; aksi hâlde bu izni olmayan biri var olan bir yasağı silerek ya da yenileyerek kaldırabilir).
- AU-19: Teşhis ucunu kim kullanır: ayrı bir izin mi, yetenekleri okuyabilen herkes mi, yalnız SuperAdmin mi? Uç, başka bir kişinin hangi kayıtta neyi görebildiğini gösterir.
- AU-20: Liste süresi için hedef sayı yok. Son aşamada 1, 10 ve 50 yasakla ölçülüp rapora yazılacak; ayrıca bir hedef (örnek: yasaksız listeye göre en çok iki katı) konsun mu?

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

## Aşamalar
0. Karar ve kurallar: bu kayıttan bir karar taslağı ve kural taslakları açılır; yetenek kararındaki (KR-008) Seçim 3, 9 ve 30 ile KR-010'un derleme eşlemesine "ezildi, bkz." notu düşülür. Kullanıcı kabul etmeden sonraki aşama başlamaz.
1. Veri ve taşıma: iki kolon ve göç, yeni izin ve tohumu, katalogda boş olabilirlik, derleyicinin etki ve önceliği taşıması, yönetim uçlarının gövdesi. Yasak ve sıfırdan farklı öncelik yazımı REDDEDİLİR; davranış değişmez.
2. Okuma motoru: şart çeviricinin "kesin tutmuyor" koşulu, yasaklı satır koşulu, kolonların çıkarılması, muafiyetler, bozuk yasağın kapatması.
3. Yazma motoru: yasağın kilit altında sınanması, yeni hâlin sınanması, oluşturma, silme ve niyet eylemleri.
4. Ekran: yetkilerim cevabı, ters kurallar için özel eşleyici, sunucu ile ekranın eşlik testi, yetenek formu, liste ve kayıt sayfası.
5. Teşhis: uç ve ekranı; erişim kaydına karar veren yasak.
6. Bütün: sekiz senaryonun uçtan uca testi, tarayıcı denemesi, 1, 10 ve 50 yasakla ölçüm; yasak yazımının açılması.
Sıra bağlayıcıdır. Her aşama ayrı görevdir; ilgili açık uç kapanmadan aşaması başlamaz (AU-18 birinci, AU-19 beşinci, AU-20 altıncı aşamadan önce).

## Doğrulama
- Var olan uçtan uca testlerin hepsi beklentileri değişmeden geçer (hepsi girebilir, öncelik 0); yasağı olmayan kişinin okumasında sorgu sayısı bugünküyle aynıdır (testle).
- "Senaryolar"daki sekiz senaryonun her biri bir testtir.
- Ek testler: koşulsuz yasak ve koşulsuz izin (TS-002 AK-52'deki boş koşul hatasının yasak karşılığı); boş değerli kayıt; "ve", "veya" ve sekiz işleç için "kesin tutmuyor" koşulunun doğruluk tablosu; yasaklı kolona göre süzme ve sıralama; yazmada yarış (iki işlem); bozuk yasak; sistem satırı ve sistem aktörü muafiyeti; yenilemede değerlerin korunması; yazımın son aşamaya kadar reddi.
- Ekran: sunucu ile ekranın aynı kurallar ve aynı kayıtla aynı kararı verdiğini gösteren eşlik testi (sekiz işleç; kolonu eksik kayıt; ters kural).
- Ölçüm: son aşamada 1, 10 ve 50 yasakla liste süresi ve sorgu sayısı.
- Yeni yön için ikinci bağımsız çürütme turu, bu bölümler yazıldıktan sonra koşturulur.

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
