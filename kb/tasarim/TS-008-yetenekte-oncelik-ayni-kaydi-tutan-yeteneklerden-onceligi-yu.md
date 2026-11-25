---
kimlik: TS-008
tur: tasarim
durum: taslak
surum: 1
baslik: Yetenekte öncelik: aynı kaydı tutan yeteneklerden önceliği yüksek olan tek başına geçerlidir
agirlik: tek-yonlu
tarih: 2026-11-25
---
Aynı izin bir kişiye birden çok yetenekten geliyor ve hepsi aynı kaydı tutuyorsa, önceliği en yüksek olan yetenek o kayıt için tek başına geçerlidir; eşit önceliktekiler bugünkü gibi birleşir.

## Sorun
Kullanıcı (2026-11-25, kendi sözü): "bak şimdi burada yetenekte yetenekler eğer eşitse yaptığımız bir hata var adamda 2 yeri aynı yeteneği varsa kazanma durumu vardı priority mevzusu ne oldu o iş kanondaki gibi sadeleştiğinde o yapı takır takır çalışıyordu". Sorulunca "şimdi tasarlansın" dedi.

Ölçülenler (2026-11-25):
- Bugün kazanan yoktur. Okumada aynı izni veren yeteneklerin satırları birleşir ve her kayıt, kendisini tutan yeteneklerin kolonlarının birleşimini taşır (`shared/yetki/infrastructure/okuma-kapisi.ts`). Yazmada adaylar oluşturulma sırasıyla denenir; koşulu tutan ama alanı kapsamayan yetenek atlanır ve satırı ilk kilitleyen yetenek kayda geçer (`yazma-kapisi.ts`; kurallar kimlik sırasıyla gelir).
- Yetenek kararı (KR-008, taslak) Seçim 3: "satırlar birbirini ezmez ve birleştirilmez"; Seçim 9: "öncelik ve etki alanı (girebilir / giremez) ilk sürümde yoktur" ve bu, 2026-11-23'te kullanıcı teyidiyle ertelenenler arasındadır.
- Kanon (`kb/_gelen/ARCHITECTURE.md` satır 429): kurallar "priority sırasına göre" derlenir (can ve cannot).
- Örnek: kişi aynı birimde hem Müdür (bütün kolonlar) hem Stajyer (yalnız ad) rolünü taşıyorsa bugün bütün kolonları görür; dar yeteneğin geniş olanı kısıtlaması mümkün değildir.

- Amaç: yöneticinin bir yeteneği öbürünün önüne koyabilmesi; kazanan tek ve öngörülebilir olsun.
- Kapsam dışı: "giremez" türünde kural (kullanıcı ayrı seçenek olarak sunulduğunda onu seçmedi); kapatma özelliği (KR-008 Seçim 9'un öbür yarısı); kayıt katmanının yeri (TS-007; ondan bağımsızdır: öncelik yalnız yetki motorunun içini değiştirir, repository'lerin biçimini değiştirmez).
- Başarının ölçüsü: var olan bütün veri ve testler değişmeden bugünkü gibi çalışır (hepsi öncelik 0); önceliği farklı yazılmış iki yetenekle örnekteki kişi yalnız yüksek öncelikli yeteneğin kolonlarını görür ve yalnız onun alanlarını yazabilir.

## Kısıtlar
- Kullanıcının dört kararı (2026-11-25) bağlayıcıdır ve "Seçenekler"de yazılıdır.
- Var olan davranış korunur: önceliği yazılmamış yetenek 0'dır ve eşit önceliktekiler birleşir; göç var olan satırlara 0 yazar.
- Veri kararını sunucuda veritabanı verir (KR-010); öncelik de sorguya çevrilir, bellekte kayıt süzülmez.
- Süzme ve sıralama görünmeyen kolonu ele vermez (bugünkü kural) ve bu kural öncelikle birlikte de geçerlidir.
- Yetenek değişmez satırdır (KR-008 Seçim 7): öncelik yazılırken ve yenilenirken verilir, yerinde değiştirilmez.
- Şema değişikliği göçle yapılır; yerel veritabanı kum havuzudur (TS-001), başka ortam yoktur.

## Değişmezler
1. Kayıt, onu tutan herhangi bir yetenek varsa görünür; öncelik bir kaydı görünmez yapmaz, yalnız hangi yeteneğin kolonlarının ve yazma sınırının geçerli olduğunu belirler.
2. Bir kayıt için "kazanan düzey", o kaydı tutan yeteneklerin en yüksek önceliğidir; yalnız o düzeydeki yetenekler uygulanır.
3. Bütün yeteneklerin önceliği eşitken her uç bugünkü cevabı verir.

## Yapı
### Veri
Yetenek satırına `oncelik` kolonu eklenir: tam sayı, boş olamaz, varsayılan 0; büyük sayı kazanır. Kaynak kataloğunda Yetenek'in bir kolonudur (kolon sınırlarına ve değişiklik kaydına bugünkü kurallarla girer).

### Tanım
Aynı izin (eylem ve kaynak) için bir kaydı tutan yetenekler önceliğe göre düzeylere ayrılır. En yüksek düzey kazanır: o düzeydeki yetenekler kendi aralarında bugünkü gibi birleşir (satırlar "veya", kolonlar kayıt başına birleşim); daha düşük düzeydeki yetenekler o kayıt için yok sayılır. Öncelik yalnız aynı iznin yetenekleri arasında karşılaştırılır.

### Okuma
- Satırlar: bir kayıt, onu tutan en yüksek düzeyde okumaya katılan bir yetenek varsa gelir. Sorgu koşulu düzey düzey kurulur: "bu düzeyin okumaya katılan yeteneklerinden biri tutuyor VE daha yüksek düzeydeki hiçbir yetenek tutmuyor", düzeyler "veya" ile birleşir. Tek düzey varken koşul bugünkü koşulla aynıdır.
- Okumaya katılma: çağıranın süzdüğü ya da sıraladığı kolonu göremeyen yetenek katılmaz (bugünkü kural). Kazanan düzeyde o kolonu gören yetenek yoksa kayıt o okumada gelmez: düşük düzeydeki bir yetenek kolonu görse de kayıt onun üzerinden sızmaz.
- Kolonlar: her kayıt, kazanan düzeyde kendisini tutan yeteneklerin kolonlarının birleşimini taşır (kimlik her zaman).
- Erişim kaydı birikimine yalnız kazanan düzeyde katılan yetenekler girer.

### Yazma
- Güncelleme, silme ve niyet eylemi: satırı tutan en yüksek düzey bulunur (yeteneğin alanı kapsayıp kapsamadığına bakılmadan). Yazmanın yeteneği o düzeyden seçilir: alanı kapsayan ve satırı kilitleyen ilk yetenek. O düzeyde alanı kapsayan yetenek yoksa cevap "yetki yok"tur; daha düşük düzeye inilmez. İki hâl kuralı aynı yetenekle sürer.
- Oluşturma: satır yazıldıktan sonra yeni satırı tutan en yüksek düzey bulunur; yazmanın yeteneği o düzeyde, alanları kapsayan ve satırı gören bir yetenek olmalıdır, yoksa "yetki yok" (iş geri alınır).
- Değişiklik kaydı notu bugünkü gibi yazmanın yeteneğini ve üyeliğini taşır.

### Derleme ve ekran
- Derleyici her kurala önceliğini yazar; kuralların sırası artan önceliktir.
- Ekranın yetki soruları (kayıt düzeyi ve kolon düzeyi) aynı sonucu vermelidir. Öneri: `kimlik/oturum/yetkilerim` cevabı, alt düzeyi olan her düzey için önce o düzeyin koşullarını taşıyan ters (inverted) kuralları, sonra izin kurallarını verir; CASL son eşleşen kuralı uyguladığı için yüksek düzeyin tuttuğu kayıtta alt düzeyin kolonları "hayır" olur. Tür düzeyi sorular (menü, kolon başlığı) şartlı ters kuraldan etkilenmez. Bu öneri AU-5 ile karara bağlanır.
- Uç guard'ı (kaba karar) değişmez: o izin için herhangi bir kuralı olan kişi uca girer.

### Yönetim
Yetenek yazma ve yenileme uçlarının gövdesi isteğe bağlı `oncelik` alır (verilmezse 0); yetenek listesi ve kayıt sayfası önceliği gösterir; formlara "Öncelik" alanı eklenir.

## Seçenekler
### 1. Kazanan (kullanıcı, 2026-11-25)
- A (seçildi: "Önceliği yüksek olan tek başına geçerli") — Dar bir yetenek geniş olanı kısıtlayabilir; kazanan tektir.
- B — "Giremez" kuralı (kanondaki can ve cannot): daha anlatımlı; iki tür kural ve iki ayrı okuma biçimi ister.
- C — Bugünkü birleşim, öncelik yalnız yazmada kayda geçen yeteneği belirler: en ucuz; kısıtlama sağlamaz.

### 2. Eşitlik (kullanıcı, 2026-11-25)
- A (seçildi: "Eşit olanlar birleşsin") — Var olan veri değişmeden çalışır; kazanan yalnız öncelik bilerek farklı yazılınca devreye girer.
- B — İlk oluşturulan kazanır. C — Son oluşturulan kazanır. İkisi de var olan verinin davranışını değiştirir (örnek: SuperAdmin'in "bütün oturumlar" yeteneği ile herkese verilen "yalnız kendi oturumu" yeteneği).

### 3. Yazmada kazananın alanı kapsamaması (kullanıcı, 2026-11-25)
- A (seçildi: "Yetki yok") — Okumayla aynı kural; dar ve yüksek öncelikli yetenek yazmayı da kısıtlar.
- B — Sıradaki önceliğe düşmek: yazma daha az kısıtlanır; okuma ile yazmanın kuralı ayrışır.

### 4. Değer (kullanıcı, 2026-11-25)
- A (seçildi: "Sayı, varsayılan 0, büyük kazanır") — Yönetici yalnız gerektiğinde sayı verir.
- B — Zorunlu alan: hiçbir yetenek farkında olmadan eşit kalmaz; her yazmada bir karar daha ister.

## Açık uçlar
- AU-1: SuperAdmin'in sistem yetenekleri öncelikle kısıtlanabilir mi? Bugünkü kararlarla, SuperAdmin'e (ya da herkesin taşıdığı temel role) yüksek öncelikli dar bir yetenek düşerse yönetici de o kayıtta kısıtlanır ve kendini kilitleyebilir. Seçenek adayları: sistem yetenekleri her zaman en üst düzey sayılır; ya da öncelik yalnız aynı (grup, rol) kümesinin yetenekleri arasında karşılaştırılır; ya da kısıtlanabilir kalır ve kilitlenme tohum göçüyle çözülür (KR-008 "Kilitlenme").
- AU-2: Önceliğin aralığı: alt ve üst sınır var mı (örnek 0–100), negatif yazılabilir mi?
- AU-3: Önceliği kim yazabilir: yetenek yazabilen herkes mi, ayrı bir izin mi; kişi kendi yeteneğinden yüksek öncelik yazabilir mi?
- AU-4: Öncelik karşılaştırması bütün üyelikler arasında mı yapılır (bir birimdeki yüksek öncelikli yetenek, başka birimdeki rolün yeteneğini aynı kayıtta ezer), yoksa yalnız aynı birimin yetenekleri arasında mı? KR-008 "Rol karışması" güvencesiyle birlikte düşünülmelidir.
- AU-5: Ekranın kayıt ve kolon düzeyi soruları önceliği nasıl öğrenir: ters kurallarla derlenmiş CASL kuralları mı (öneri), yoksa ekran bu soruları kazanan düzeyi bilmeden mi sorar (ekran fazladan düğme gösterebilir, kararı yine backend verir)?
- AU-6: Öncelik değiştirmek için yenileme yeterli mi (yeni satır, eskisi pasif), yoksa yalnız önceliği değiştiren ayrı bir eylem mi istenir?

## Aşamalar
1. Veri ve taşıma: kolon, göç, katalog, derleyici, yönetim uçlarının gövdesi; motor önceliği taşır ama henüz kullanmaz (davranış değişmez).
2. Okuma motoru: düzeyli satır koşulu ve kazanan düzeyin kolonları.
3. Yazma motoru: kazanan düzeyin bulunması, alt düzeye inmeme, oluşturma.
4. Ekran: yetkilerim cevabı (AU-5'in kararına göre), yetenek formu, liste ve kayıt sayfası.
5. Bütün: örnek senaryonun uçtan uca testi ve tarayıcı denemesi.
Sıra bağlayıcıdır; açık uçlar kapanmadan ilgili aşama başlamaz (AU-1 ve AU-4 ikinci aşamadan, AU-2, AU-3 ve AU-6 birinci aşamadan, AU-5 dördüncü aşamadan önce).

## Doğrulama
- Var olan uçtan uca testlerin hepsi beklentileri değişmeden geçer (bütün öncelikler 0).
- Yeni testler: Müdür ve Stajyer örneği (okuma, kolonlar, yazma); eşit öncelikte birleşim; yüksek düzeyin görmediği kolona göre sıralamada kaydın gelmemesi; yazmada alt düzeye inilmemesi; oluşturmada kazanan düzey; erişim kaydı ve değişiklik kaydı notu.
- Ekran: kısıtlanan kişide kayıt düzeyi soruların backend'le aynı cevabı vermesi (AU-5'e göre).

## Çürütme
Bağımsız çürütme turu bu kayıt yazıldıktan sonra koşturulur; bulguları ve cevapları buraya yazılır. O zamana kadar: bağımsız inceleme yapılmadı.
