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
- AU-21 (kullanıcı, 2026-11-25): "Belirsiz biçimler yazımda reddedilsin": yasak yalnız iki net biçimde yazılabilir (kolon listesi olmayan yasak kaydın bütününü, kolon listesi olan yasak yalnız o kolonları kapatır); ne işareti ne listesi ya da ne işareti ne şartı olan satır, listesinde kimlik kolonu olan yasak ve silme ya da niyet eylemine kolon listesiyle yazılan yasak doğrulama hatası alır. Soru: Yasağın geçerli biçimleri: işaretsiz ve şartsız satır, işaretsiz ve kolonsuz satır, "bütün kolonlar" işaretli satır, listesinde kimlik kolonu olan yasak, silme ve niyet eylemlerinde kolon listesi. Hangisi yazımda reddedilir, hangisi kaydın bütününü kapatır? (İkinci çürütme 2 ve 18: "kolon listesi olmayan yasak" bugün iki ayrı saklı hâle denk geliyor; biri kayıt yasağına yükselir, öbürü etkisiz kalır.)
- AU-22 (kullanıcı, 2026-11-25): "Üçü de izni kapatır": şartının biçimi bozuk, ne işareti ne şartı olan ya da kolon listesi boşalan yasak da bozuk sayılır ve o izni o kişide kapatır; yasak hiçbir yoldan sessizce kalkmaz. Sonucu: kolon adını değiştiren bir göç, o yasağı taşıyan kümenin iznini topluca kapatabilir; göçten önce tarama gerekir. Soru: Hangi durumlar "bozuk yasak" sayılır? Bugün üç durumda satır derleyiciye hiç gelmiyor ya da sessizce düşüyor (biçimi bozuk şart, işaretsiz ve şartsız satır, kolon listesi süzülünce boşalan satır); bunlar yasakta "o izni kapat" kararının dışında kalıyor ve erişim genişliyor (ikinci çürütme 1).
- AU-24 (kullanıcı, 2026-11-25): "Yazımı reddedilsin": korunan kaynakların (yetenek, üyelik, rol, grup) yazma eylemlerine yasak yazılamaz; istek açık bir iletiyle reddedilir. Yetki devri açıldığında yeniden ele alınır. Soru: Korunan kaynakların (yetenek, üyelik, rol, grup yazma eylemleri) yasağı kök yönetici kümesinin dışına yazılabilir mi? Bugün yazılamıyor ve o kümenin satırları muaf; yani dört korunan kaynakta yazma yasağı hiç etki etmez (ikinci çürütme 4).
- AU-27 (kullanıcı, 2026-11-25): "Yalnız SuperAdmin'in sistem yetenekleri": muafiyet kök yönetici rolünün sistem satırlarıyla sınırlıdır; temel rolün ve projelerin sistem satırları yasaklanabilir. Ajan kararı AK-3 (bütün sistem satırları) bu kararla ezildi. Soru: Muafiyet bütün sistem satırlarını mı kapsar (ajan kararı AK-3), yalnız kök yönetici rolünün sistem satırlarını mı? Proje tohumları sistem satırı yazarsa yasak onlara hiç işlemez ("silinemez" işareti "yasaklanamaz" anlamını da yüklenir).
- AU-23 (kullanıcı, 2026-11-25): "Yeni bir ret kaydı": iz veritabanına ayrı bir tablo (kim, eylem, kaynak, kayıt, karar veren yasak, zaman); erişim kaydının bugünkü anlamı (başarılı okumalar) değişmez; teşhis ekranı bu kaydı gösterir. Yeni tablo, göç ve aktarım yolu ister. Soru: Reddedilen yazmanın izi nereye yazılır? Erişim kaydı bugün yalnız başarıyla dönen ve yazma açmamış istekte yazılıyor (KR-010 Seçim 40; TS-002 AK-40) ve iz şemasında izin ile yasağı ayıracak alan yok; "reddi veren yasak erişim kaydına yazılır" bugünkü yolla yazılamaz (ikinci çürütme 3). Yeni bir ret kaydı mı, erişim kaydının genişletilmesi mi?
- AU-25 (kullanıcı, 2026-11-25): "Çevrilemesin": yenileme etkiyi değiştiremez (yasak yasak, izin izin kalır; şart, kolonlar ve öncelik değişebilir). Etkiyi değiştirmek isteyen eskisini siler ve yenisini yazar. Soru: Yenilemede bir yeteneğin etkisi çevrilebilir mi (yasak izne, izin yasağa)? Tek alanlık bir hata yasaklanan kolonu açar; ayrıca yenileyen kişi iki yeni kolonu göremiyorsa "eski değer korunur" kararı uygulanamaz (ikinci çürütme 10).
- AU-26 (kullanıcı, 2026-11-25): "Yeni hâle yalnız düz güncellemede bakılsın": düz güncellemede sonuç yasaklıysa ret; niyet eylemlerinde ve silmede yalnız önceki hâle bakılır (bugünkü iki hâl kuralıyla aynı). Oluşturmada sınama yazılan satırın üzerindedir. Soru: Yeni hâl sınaması silme ve niyet eylemlerinde de yapılır mı? Yasağın şartı yazılan kolona bakıyorsa sınama o duruma GEÇİŞİ de reddeder: "onaylanınca dokunulmaz" yasağı "hiç onaylanamaz"a döner (ikinci çürütme 11). Bu sonuç kabul mü?
- AU-29 (kullanıcı, 2026-11-25): "Yalnız kaydın bütünü": oluşturma yasağı kolon listesi taşımaz; şartı tutan kaydı oluşturmak yasaktır. Kolon listeli oluşturma yasağı yazımda reddedilir (silme ve niyet eylemleriyle aynı kural). Soru: Oluşturmada yasak kayıt düzeyinde mi, kolon düzeyinde mi (kapanan AU-10 "kaydın bütünü", "Yazma" bölümü "yazılan alanlarda" diyor)? Genel olarak: yazmada birden çok izin kuralının kolonları birleşmez (tek yeteneğin bütün yazılan kolonları tutması gerekir; KR-008 Seçim 18); tanım buna göre düzeltilmeli.
- AU-18 (kullanıcı, 2026-11-25): "Yazma, yenileme ve silmede": yasak ya da sıfırdan farklı öncelik taşıyan bir yeteneği yazmak, yenilemek ve silmek ayrı izni ister; izni olmayan biri var olan bir yasağı silerek ya da yenileyerek kaldıramaz. Soru: Yasak ve sıfırdan farklı öncelik yazmak için gereken ayrı iznin kapsamı. Öneri: izin "Yetenek:yasakla"dır ve yasak ya da sıfırdan farklı öncelik taşıyan bir yeteneği yazmak, yenilemek ve silmek bu izni ister (yalnız yazmak değil; aksi hâlde bu izni olmayan biri var olan bir yasağı silerek ya da yenileyerek kaldırabilir).
- AU-19 (kullanıcı, 2026-11-25): "Yalnız SuperAdmin": teşhis ucu ayrı bir izindir ve tohumla yalnız kök yöneticiye verilir (sistem satırı). Soru: Teşhis ucunu kim kullanır: ayrı bir izin mi, yetenekleri okuyabilen herkes mi, yalnız SuperAdmin mi? Uç, başka bir kişinin hangi kayıtta neyi görebildiğini gösterir.
- AU-20 (kullanıcı, 2026-11-25): "Ölçümü hedefsiz raporla": son aşamada 1, 10 ve 50 yasakla liste süresi ve sorgu sayısı ölçülüp rapora yazılır; hedef ya da sınır gerekiyorsa kullanıcı o sayılarla karar verir. Soru: Liste süresi için hedef sayı yok. Son aşamada 1, 10 ve 50 yasakla ölçülüp rapora yazılacak; ayrıca bir hedef (örnek: yasaksız listeye göre en çok iki katı) konsun mu?
- AU-28 (kullanıcı, 2026-11-25): "Ekran sunucuyla aynı kararı versin": yasaklar için yazılacak özel eşleyici boş değeri sunucu gibi "tutmuyor" sayar; ekran ile sunucunun aynı kararı verdiği eşlik testiyle sınanır (boş değerli kayıt dahil). Soru: Ekranda boş değer: kurulu kitaplıkta boş kolonda dört işleç (değil, listede değil, küçük, küçük eşit) "tutuyor" çıkıyor, sunucu kararına göre "tutmuyor" (ikinci çürütmede ölçüldü). Ekran eşleyicisi boş değeri "tutmuyor" sayacak biçimde mi yazılır, yoksa bu dört işleçte ayrışma kabul mü?
- AU-30 (kullanıcı, 2026-11-25): "Veritabanı kısıtı koy": yazım açılana kadar veritabanında da "yasak yok, öncelik 0" kısıtı durur; son aşamadaki göç kısıtı kaldırır. Soru: Yazım kapalıyken göç ya da doğrudan veritabanı yazımı yasak satırı oluşturabilir; veritabanı kısıtıyla da engellensin mi?

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
### İkinci tur (2026-11-25; yeni yön için)
Bağımsız bir oturum yeniden yazılan kaydı çürütmeye çalıştı (dosya değiştirmedi; ekrandaki kitaplığı kurulu sürümle ölçtü, kodu okudu; veritabanı davranışını ölçmedi). Hükmü yine: "bu hâliyle imzalamam".

Engel sayılan bulgular: (1) bozuk yasak üç yoldan sessizce düşüyor ve erişim genişliyor; "o izni kapat" kararı bu üç durumu kapsamıyor (AU-22). (2) "Kolon listesi olmayan yasak" iki ayrı saklı hâle denk geliyor; biri kaydı kapatır, öbürü etkisiz kalır (AU-21). (3) "Reddi veren yasak erişim kaydına yazılır" bugünkü erişim kaydı düzeniyle yazılamaz (AU-23).

Önemli bulgular: Senaryo 2 bu base'de gerçekleşemez (grup silme yalnız kök yönetici kümesine bağlanabiliyor ve o satırlar muaf; AU-24). Senaryo 4'ün tetikleyicisi ulaşılamaz (alt grup listesi grubu hep içerir) ve günlük satırı istek başına değil derleme başına yazılır. Senaryo 8 ölçümle çelişiyor: şartsız kolon yasağında tür düzeyi soru "hayır"dır, başlık çizilmez. "En çok 1 ek sorgu" tutmaz: gerçekçi sayı 1 + izin kuralı sayısı + şartlı kolon yasağı sayısıdır. Uç guard'ı değişmez değildir: ters kural aynı yetki nesnesine girerse yalnız yasağı olan kişi uca girer; ters kurallar guard'ın baktığı kümeden süzülmelidir. Yasağı olan kişide, uygulanacak yasağı kalmayan koşulsuz izin dalı boş koşula döner ve "veya"da yok sayılır (TS-002 AK-52'nin geri gelişi); kural "Okuma"ya yazılmalıdır. Derlenmiş kuralda sistem satırı bilgisi yoktur: ortak sözleşme, repository ve kural tipi değişir. Boş olabilirlik şemadan okunamaz: bu depoda alan tipleri elle yazılıp tiple denetleniyor; aynı yol gerekir. Yenilemede iki yeni kolon "karar kolonları"na girmezse yasak izne döner (AU-25). Yeni hâl sınaması duruma geçişi de yasaklar (AU-26). Ekranda boş değerde dört işleç sunucudan ayrışır (AU-28). Ekranın kural şeması ters kural alanını taşımıyor; bilinmeyen alan atıldığı için ters kural ekranda izin olarak okunur.

Ölçümle doğrulananlar: "sistem izinleri en sonda" sırası muafiyeti kayıt, kolon ve tür düzeyinde veriyor; öncelik sırası tanımla aynı sonucu veriyor; değerlendirilemeyen yasağı yasak sayan eşleyici yazılabilir.

Düşünülmemiş hata kipleri: bir göç yasağın şartındaki kolonu yeniden adlandırırsa o kümenin izni topluca kapanır (herkesin taşıdığı roldeyse kök yönetici dışında herkes); kara liste şema büyüyünce açık kalır (modele eklenen yeni kolon geniş izinle kendiliğinden görünür); yazması yasak kolona tahmin gönderen kişi "başarı" ile "yetki yok" farkından değeri doğrulayabilir; teşhis ucu, soranın göremediği kayıtta "şu şartlı yasak tutuyor" diyerek gizli değeri ele verebilir; yazım yalnız uçta kapalıyken göç yasak yazabilir (AU-30).

En güçlü karşı görüş: bugün bu base'de yasağın etkileyebileceği tek canlı satır yoktur: tohumdaki 29 yeteneğin 29'u muaf sistem satırıdır ve yasağı yazabilen tek küme kök yönetici kümesidir. Bedel ise tek yönlüdür: sorguda üç değerli olumsuzlama, ekranda ikinci bir "belirsizse yasak" değerlendiricisi, yeni bir iz kaydı, teşhis ucu ve kullanıcının "önce kapatılır" ilkesinin tersine çalışan bir kara liste. Kullanıcının ilk şikâyeti ("iki yerde aynı yetenek varsa kazanan olsun") beyaz liste niteliğindeydi; yeni yön onu yalnız "kayıt yasağı ve bir üst öncelikte dar izin" kalıbıyla verir. Kayıtta kısmen bastırılmıştı: erteleme seçeneği tek satırdı ve senaryolarla karşılaştırılmamıştı. Kullanıcıya açıkça sunulacak.

İmza için istenenler: yasağın geçerli biçimleri ve bozuk yasağın delikleri; reddin izi için karar; ulaşılabilir senaryolar; sorgu sayısının düzeltilmesi; ekranda boş değer ve guard süzmesi; yenileme kuralları; "Değişmezler" bölümü ve seçeneklerin senaryolarla karşılaştırılması; ikinci ve üçüncü aşamanın başında iki ölçüm (veritabanı istemcisinde olumsuzlama ile boş değer; kilit yarışı).

### Birinci tur (2026-11-25; ilk taslak için)
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
