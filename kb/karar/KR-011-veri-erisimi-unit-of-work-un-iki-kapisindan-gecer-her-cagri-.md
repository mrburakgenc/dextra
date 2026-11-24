---
kimlik: KR-011
tur: karar
durum: taslak
surum: 1
baslik: Veri erişimi Unit of Work'ün iki kapısından geçer; her çağrı kendi örneğini alır
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-23
baglam: TS-001
---
Veri erişimi için repository yalnız Unit of Work'ün iki kapısından alınır: yazan iş her çağrıda kendi örneğini ve tek veritabanı işlemini alır, okuyan iş işlem açmadan yalnız okuma görünümünü alır; işlem dışında yazmak derlenmez ve repository tek yerde kaydedilir, karşılığında yazım biçimi BADI ile kanondan ayrılır ve her repository okuma ile yazma için iki arayüz taşır.

> Bu taslak kullanıcının 2026-11-21 seçimlerinden derlendi; metni ajan yazdı. Konuşma TS-001 "Yapı" bölümündeki "Unit of Work" maddelerindedir. "Kullanıcı" yazan satırlar kullanıcının sözüdür; "öneri (ajan)" yazan satırlar teyit ister. Ağırlık tek yönlüdür, çünkü seçim her feature'daki her handler'ın yazım biçimini bağlar. Bağımsız çürütme turu koşmadı, açık noktalar kapanmadı ve kod yoktur; kabule hazır değildir.

## Bağlam
- KR-005: her alt özellik dört katman taşır; repository arayüzü domain'de, Prisma ile yazılmış hâli infrastructure'dadır.
- Kullanıcı (2026-11-21): Unit of Work'ün amacı bir iş birimini tek veritabanı işlemi olarak çalıştırmaktır; tekil (singleton) durum taşımamalı, her çağrı kendi örneğiyle çalışabilmelidir.
- Kanon (okundu 2026-11-21): işlem ortam bağlamıyla açılır (`this.uow.transaction(async () => …)`); işlem dışında repository'ye yazmak yalnız "YASAK" örneğiyle anlatılır, derleme engellemez (`IRON_RULES_BACKEND.md` satır 546–548); sorgu handler'ı repository'yi doğrudan enjekte eder ve Unit of Work kullanmaz (satır 332–339); repository'ler feature başına tek registrar'da kaydedilir (`PATTERNS.md` 6.3).
- BADI'den ölçülenler (2026-11-21; yapı okundu, kod alınmadı): Unit of Work tekil sağlayıcıdır ve işlem durumu AsyncLocalStorage'da tutulur; işlem dışında istenen repository ana veritabanı istemcisine bağlı üretilir, yazma tek tek çalışır ve hata vermez; iç içe çağrı SAVEPOINT'tir; yazma çakışmasında callback en çok 5 kez yeniden denenir; `detached` seçeneği ayrı işlem açar; işlem süre sınırı 5000 ms'dir.
- NestJS belgesi (okundu 2026-11-21): TRANSIENT kapsam her çağrıda değil, enjekte eden her sınıf için bir örnek üretir; REQUEST kapsamı enjeksiyon zincirini istek kapsamlı yapar.
- Prisma belgesi (okundu 2026-11-21): işlem içindeki her çağrı aynı bağlantıyı kullanır; yardımcı fonksiyon kendi işlemini açmak yerine işlem nesnesini parametre olarak almalıdır.
- Bağlı kararlar: yetki repository'nin okuma ve yazma kapısında uygulanır, yazma şartlıdır ve aynı işlemde yeniden okunur, yetkiyi atlayan repository yolu yoktur, feature içinde ham SQL ile okuma yapılmaz (KR-010); başka feature'da aynı işlemde yazan sözleşme işlem nesnesini parametre alır (KR-005 "Feature'lar arası erişim" Kural 3).
- Prisma 7 ile kurulacak (KR-004, kullanıcı 2026-11-24); 7.10 ile 8 arasında işlem arayüzü farklıdır (TS-001 "Yapı") ve 8'e geçiş ayrı bir iştir.

## Ölçütler
Kullanıcıdan sayısal ölçüt gelmedi. Öneri (ajan; teyit edilmedi):
1. İşlem dışında yazma. Ölçü: işlem dışında yazan ve derlenen çağrı sayısı. Hedef: 0 (derleme hatası).
2. Okumanın işlem maliyeti. Ölçü: salt okuma isteğinde açılan veritabanı işlemi sayısı. Hedef: 0.
3. Repository kaydı. Ölçü: bir repository'nin kaydedildiği yer sayısı. Hedef: 1.
4. Ortak koda feature adı sızması. Ölçü: ortak koddaki Unit of Work arayüzünde geçen feature adı sayısı. Hedef: 0.

## Seçenekler
### İşlemin taşınması
- A — Ortam bağlamı (kanon ve BADI): tekil nesne; işlem çağrı bağlamında gizli taşınır. İşlem dışında yazmak derlenir ve çalışır (ölçüt 1'i karşılamaz).
- B — Fabrika (seçildi): `run(async (uow) => …)`; her çağrı kendi örneğini alır ve repository yalnız o örnekten alınır.
- C — İstek kapsamlı sağlayıcı: enjeksiyon zincirini istek kapsamlı yapar; kişisiz işte (zamanlanmış iş, olay tüketicisi) istek yoktur.
### Okumanın yolu
- 1 — Her şey `run` içinde: her okuma işlemle sarılır (iki ek gidiş); paralel sorgular tek bağlantıda sıraya girer; bağlantı callback bitene kadar havuza dönmez; işlem süre sınırı okumaya da uygulanır (ölçüt 2'yi karşılamaz).
- 2 — İki kapı (seçildi): `run` işlem açar ve tam repository verir; `read` işlem açmaz ve yalnız okuma görünümü verir.
- 3 — Okuma arayüzü ayrıca enjekte edilir (ajanın ilk önerisiydi): repository iki yerde kaydedilir (ölçüt 3'ü karşılamaz).

## Seçim
Kullanıcı seçimleri (1–3: 2026-11-21; 4–6: 2026-11-23; 7: 2026-11-24):
1. İşlem fabrikayla taşınır (B): her çağrı kendi örneğini alır ve işlem dışında repository'ye yazmak derlenmez.
2. Unit of Work iki kapılıdır: `run` işlem açar ve tam repository verir; `read` işlem açmaz ve yalnız okuma görünümü verir.
3. Repository'ler tek yerde kaydedilir. Sonuç (ajan): erişim belirteçle olur (`uow.repo(BELİRTEÇ)`, `uow.read(BELİRTEÇ)`), ortak koddaki Unit of Work arayüzüne feature adı yazılmaz ve kayıt feature başına tek registrar'dadır (kanon).
4. Başka feature'da aynı işlemde yazan sözleşme metodu işlem nesnesini parametre alır (KR-005 Kural 3).
5. İç içe çağrı hata verir: işlem içindeyken `run` yeniden çağrılırsa çalıştırıcı hata atar. Aynı işleme katılmak isteyen işlem nesnesini parametre alır; ayrı işlem isteyen bunu adıyla isteyen ayrı çağrıyı kullanır (örnek: iş başarısız olsa da kalması gereken kayıt). Reddedilenler: sessizce ayrı ikinci işlem açmak (iş yarıda düşerse yardımcının yazdığı kayıt geride kalır); dıştaki işleme kendiliğinden katılmak (gizli bağlam ister; kanon ve BADI davranışıdır). Bedel: "şu an bir işlemin içinde miyim" bilgisini tutan küçük bir işaret gerekir; yalnız hata vermek için kullanılır, işlemi taşımak için değil.
6. Okuma görünümü ayrı bir arayüzdür: her repository bir okuma arayüzü ve onu genişleten tam arayüz taşır; `read` kapısı yalnız okuma arayüzünü verir. Bir metot okuma arayüzüne bilerek yazılmadıkça `read` kapısında görünmez. Reddedilen: tek arayüzden metot adı önekiyle türetme (ajanın 2026-11-21 önerisiydi; yazan ama adı okuma gibi duran bir metot okuma görünümüne sızar, yani hata açık tarafa düşer). Bedel: repository başına bir arayüz daha.
7. Veritabanındaki adlar Türkçedir ve snake_case yazılır; tablo, kolon ve öbür veritabanı nesneleri buna dahildir (örnek: `kullanici_adi`). Koddaki model ve alan adları serbesttir. Kullanıcının sözü: "veritabanında terimler Türkçe olsun; veritabanında kesinlikle snake_case olsunlar, objeler de buna dahil; modelde KullaniciAdi olabilir, o fark etmez". Ek (kullanıcı, 2026-11-24: b): dizin, anahtar ve kısıt adlarının eki de Türkçedir; aracın kendiliğinden verdiği ekler (`_pkey`, `_idx`, `_key`, `_fkey`, `_check`) kullanılmaz ve her ad şemada elle yazılır. Biçim (ajan tanımı; kullanıcıya iki örnekle gösterildi: `outbox_iz_ba`, `outbox_iz_olusturma_zamani_dizin`): birincil anahtar `<tablo>_ba`, dizin `<tablo>_<kolonlar>_dizin`, tekil kısıt `<tablo>_<kolonlar>_tekil`, yabancı anahtar `<tablo>_<kolon>_ya`, denetim kısıtı `<tablo>_<ad>_denetim`. Unutulan ad İngilizce ekle sessizce geri geleceği için, göçleri uygulanmış veritabanında bu ekleri arayan bir test tutulur. Ajanın önerisi aracın eklerini bırakmaktı; kullanıcı önce a dedi, hemen ardından "b pardon" diye düzeltti. Sınır (ajan okuması, 2026-11-24; GV-014'ün sorusu üzerine, kullanıcıya bildirildi): PostgreSQL 19, NOT NULL kısıtlarını kendi verdiği `<tablo>_<kolon>_not_null` adıyla tutar ve Prisma bu adı şemada verdirmez; bu kısıtlar ad kuralının ve denetim testinin dışındadır. Reddedilen: her göçe elle yeniden adlandırma yazmak (göç dosyası şemadan üretilmiş hâliyle aynı kalmaz ve her yeni kolonda elle iş ister).
   - Kullanıcı teyidi (2026-11-24; ilk şema taslağı TS-002 "Veri modeli" üzerinde gösterildi): tablo adı tekildir (`kullanici`); adlar Türkçeye özgü harf taşımaz (`uyelik`, `kullanici_adi`); zaman kolonu `_zamani` ile, başka tabloya bağ `_id` ile biter (`olusturma_zamani`, `grup_id`); veritabanında saklanan sabit değerler Türkçedir (kapatılma nedeni: `cikis`, `parola_degisimi`); şartın içindeki anahtarlar Türkçedir (`alan`, `islec`, `deger`); koddaki model ve alan aynı sözcüğün kod yazımıdır (model `Kullanici`, alan `kullaniciAdi`, kolon `kullanici_adi`).
   - Kullanıcı teyidi (2026-11-24): dosya adlarında iş sözcükleri Türkçe, desen ve altyapı sözcükleri İngilizcedir (`giris.handler.ts`, `oturum.repository.ts`); reddedilen: hepsinin Türkçe olması (`giris.isleyici.ts`).
   - Ajan okumaları (teyide sunulmadı): indeks ve kısıt adları tablo ve kolon adından türediği için aynı kurala uyar; göç aracının kendi tablosu bu kuralın dışındadır; teknik altyapı adları İngilizce kalır (`UnitOfWork`, `health`). Yetki tanımındaki kaynak ve alan adları modeldeki adlardır (KR-008 Seçim 33).
8. Kayıtların kimliği zaman sıralı rastgele kimliktir (UUID v7). Kullanıcı (2026-11-24): a. Neden: kimlikler adreslerde ve belirteçlerde dolaşır ve tahmin edilemez, kayıt sayısı dışarıdan anlaşılmaz; faz 2'de her servis kendi kimliğini üretir; zaman sıralı olduğu için yeni kayıt dizinin sonuna eklenir. Reddedilen: artan sayı (en küçük ve en hızlı, elle okunur; ama bir sonraki kimlik tahmin edilir ve servisler ayrılınca ortak sayaç ister). Kabul edilen bedel: kimlik 16 bayttır, tablolar ve dizinler büyür (ölçülmedi); kimlikler göze okunaksızdır. Kimliğin tahmin edilememesi tek başına koruma değildir; korumayı yetenek satırı verir.
   - Ölçüldü (2026-11-24): yereldeki PostgreSQL 19'da `uuidv7()` işlevi hazır geliyor ve değer üretiyor.
   - Üretim yeri (kullanıcı, 2026-11-24: a; bağımsız incelemenin 5. bulgusu): kimlik uygulamada, ortak koddaki tek üreticiyle üretilir; kolonun veritabanı varsayılanı yazılmaz ve kolon yerel `uuid` türündedir. Neden: olayın zarfı kimliği satır yazılmadan taşır (kanon, EVT zarfı); tek üretim yolu kalır; faz 2'de her servis kendi kimliğini üretir. Reddedilen: kolon varsayılanı olarak veritabanı işlevi (kimliği önceden bilmek gereken yerler için ikinci bir yol gerekir). Kabul edilen bedel: elle yazılan SQL kimliği kendisi vermek zorundadır. Altyapı tabloları (outbox, iz) aynı türü ve aynı üreticiyi kullanır (ajan; teyide sunulmadı).
   - Ölçüldü (2026-11-24; Node 24.18.0): `node:crypto` içinde `randomUUIDv7` işlevi hazır geliyor ve sürüm hanesi 7 olan kimlik üretiyor; ek paket gerekmez. Aynı ölçümde art arda üretilen iki kimlik kendi arasında sıralı çıkmadı: aynı milisaniye içinde sıra güvencesi yoktur. Sonuç (ajan): hiçbir yerde kimliğe göre sıralamayla kesin sıra varsayılmaz; outbox'ın okuma sırası ayrı bir kolonla verilir.
   - Zaman bilgisi (ajan; kullanıcıya bildirildi, itiraz gelmedi): zaman sıralı kimlik, kaydın yaklaşık oluşturulma anını kimliği gören herkese gösterir; bu, türü seçmenin kabul edilen bedeli olarak yazıldı. İtiraz gelirse Seçim 8'in kendisi yeniden açılır.
   - Açık (ajan): kimliğin veritabanında mı uygulamada mı üretileceği (kanondaki "kayıt kimliğini kendisi taşır" deseni uygulamada üretmeyi gerektirebilir); altyapı tablolarının (outbox, iz) aynı türü kullanıp kullanmayacağı; kimliğin içindeki zaman bilgisinin kaydın oluşturulma anını ele vermesi (kabul edilen bir sızıntı mı, sorulmadı).
9. Erişim kaydı `read` kapısının dışında, istek sonunda yazılır: okuma kapısı işlemsiz kalır; okuma isteğinin erişim kaydını (KR-013) ortak altyapı kodu, istek bittiğinde tek satırlık ayrı bir yazmayla outbox'a yazar. Bu, "yazma yalnız `run` içinde yapılır" kuralının adıyla sayılı tek istisnasıdır. Kullanıcı (2026-11-24): a. Kaynak: bağımsız incelemenin 1. bulgusu (KR-013 her okuma isteğine bir outbox satırı yazdırırken bu karar okuma kapısında işlem ve yazma vermiyordu; iki kararı inceleyen iki ayrı oturum aynı çelişkiyi buldu). Düzeltme (kullanıcı, 2026-11-24; KR-013 Seçim 6): erişim kaydı outbox'a değil doğrudan iz veritabanına yazılır; asıl veritabanında `run` dışında yazma kalmaz ve bu istisna asıl veritabanı için düşer. "Yazılamazsa okuma reddedilir" aynen geçerlidir.
   - Neden: 2026-11-21'de seçilen iki kapılı yapı ve "okumada işlem açılmaz" kazancı korunur; ek maliyet okuma başına tek yazmadır.
   - Reddedilenler: kimlikli her okumanın `run`'dan geçmesi (okuma kapısı yalnız kimliksiz uçlara kalır; ölçüt 2 ve "Okuma testi" düşer); ortak kodun okumadan sonra küçük bir `run` açması (istisna gerekmez, ama okuma başına bir işlem açılır).
   - Erişim kaydı yazılamazsa okuma reddedilir; veri kayıtsız dönmez. Kullanıcı (2026-11-24): a. Neden: kaydı olmayan okuma olmaz ("kayıt kaybolmaz", KR-013) ve arıza hemen görülür. Reddedilen: verinin kayıtsız dönmesi (sistem ayakta kalır, ama "kim neyi okudu" sorusunda sessiz delik oluşur). Kabul edilen bedel: kayıt yazımındaki arıza okumaları da durdurur; iz yazımı ayakta kalma şartlarından biri olur. Ajan notu (ölçülmedi): kayıt aynı veritabanına yazıldığı için o veritabanı çalışmıyorsa okuma zaten yapılamaz; ek olarak durdurduğu durumların dar olduğu öngörülür. Sonuç (ajan): veri okunduktan sonra kayıt yazılamazsa cevap gönderilmez, yani kayıt cevaptan önce yazılır.
   - Ajan sonuçları (teyide sunulmadı): bu yazmayı yalnız ortak koddaki tek parça yapar, feature kodu çağıramaz ve bu makineyle denetlenir; yükümlülük 2 ve KR-012 Kural 2 ("outbox'a yalnız `run` içinde yazılır") bu istisnayı adıyla anacak biçimde yeniden yazılacak; "Okuma testi" "`read` çağrısında işlem açılmaz; istek sonunda tek bir erişim kaydı yazılır" diye güncellenecek.
10. İşlem içindeyken `read` çağrısı da hata verir: `run` içindeki her okuma o işlemin Unit of Work örneğinden yapılır. Kullanıcı (2026-11-24): a. Kaynak: bağımsız incelemenin 3. bulgusu (karar yalnız iç içe `run`'ı kapatıyordu; işlem içinden çağrılan okumanın davranışı tanımsızdı).
   - Neden: ayrı bağlantıdan yapılan okuma, işlemin henüz onaylanmamış yazmalarını göremez ve kod eski veriyle sessizce çalışır; hata ise ilk çalıştırmada görülür. Seçim 5 ile aynı yöndedir.
   - Reddedilen: `read`'in işlem içinde serbest kalıp ayrı bağlantıdan okuması (kural değişmez; ama okuma kendi işleminin yazdığını görmez ve bağlantı tutan her iş ikinci bir bağlantı ister; bağlantıların tükenmesi riski ölçülmedi).
   - Etkisi: KR-005 Kural 4 genişler. İşlem nesnesi artık yalnız aynı işlemde yazan sözleşme metoduna değil, işlem içinden çağrılan okuma sözleşme metoduna da verilir; KR-005'e not düşüldü.
   - Ajan tanımları (teyide sunulmadı; aynı bulgunun kullanıcı kararı istemeyen kısmı): işlem nesnesi Unit of Work örneğidir, Prisma tipi değildir; KR-010'daki "iş birimi" kişili istekte isteğin kendisi, kişisiz işte tek kapı çağrısıdır; yetki verisinin okunması ve derlenmesi `run` açılmadan önce biter, böylece derleme işlem içinde ikinci bir okuma istemez.

Yazım biçimi (ajan tanımı, 2026-11-24; bağımsız incelemenin 2, 3, 7, 8, 10 ve 11. bulguları; kullanıcı kararı istemeyen kısımlar, teyide sunulmadı). İki ayrı nesne vardır ve adları ayrıdır; önceki metin ikisine de `uow` diyordu:
```
UnitOfWork  (enjekte edilen çalıştırıcı; tekildir)
  run(is: (islem: Islem) => Promise<T>): Promise<T>    işlem açar; is hata atarsa bütün yazmalar geri alınır
  read(belirtec): okuma arayüzü                         işlem açmaz; yalnız okuma arayüzünü verir
Islem       (çağrı başına örnek; yalnız run verir)
  repo(belirtec): tam arayüz                            tam arayüz okuma arayüzünü genişletir
Belirteç    okuma arayüzünü ve tam arayüzü tip olarak taşır; feature adı Unit of Work arayüzüne yazılmaz
Registrar   register(belirtec, fabrika)                 feature başına tektir; fabrika işlemin istemcisini alır
```
- Kapsam: Unit of Work yalnız asıl veritabanını kapsar. İz veritabanına yalnız ortak altyapı kodu kendi istemcisiyle erişir ("İstisna yolu"). Hiçbir feature'a ait olmayan tabloları (outbox gibi) ortak kodun kendi registrar'ı kaydeder; feature outbox'a yalnız "olay yaz" yüzeyinden ulaşır, tam repository'yi isteyemez.
- İşaret: "işlemin içinde miyim" bilgisi AsyncLocalStorage ile tutulur; onu yalnız çalıştırıcı okur (işlem içindeyken `run` ve `read` çağrısına hata vermek için; Seçim 5 ve 10), işlemi taşımak için kullanılmaz ve işlem kapanınca kapalı sayılır. Seçim 5'te reddedilen "gizli bağlam" işlemi taşıyan bağlamdır; bu işaret taşımaz, yalnız hata verir. "Adıyla istenen ayrı işlem" çağrısı ilk kullanıcısı çıkana kadar yazılmaz; iç içe çağrı sınamasının o yarısı ertelenir.
- Hataların dışarıya dönüşü (ajan önerisi; uç kodları yazılmadı): kilitlenme döngüsü ve süre aşımı "yeniden dene"; şartlı yazmada sıfır satır "bulunamadı ya da yetki yok"; tekil kısıt "çakışma". Düzeltme: "iki iş aynı kayıtta çakışırsa hata döner" cümlesi varsayılan yalıtımda böyle gerçekleşmez; çakışan ikinci yazma hata almaz, satır kilidini bekler (bu depoda denenmedi). 5 saniye işlemin toplam süresidir; bağlantı ve kilit beklemesini kapsadığı ajan okumasıdır.
- Göç: şema göçü Unit of Work kullanmaz. Tohum göçü uygulama kodunu (tohum yardımcısı) çağırır; koşucusu tasarlanınca hangi kapıdan yazdığı buraya yazılacak (TS-002).
- Seçeneklerde eksik kalan karşı görüş (inceleme 10): "ortam bağlamı, okuma ve yazma arayüzü ayrımı ve işlem dışında yazmada çalışma anı hatası" birleşimi tartılmamıştı. Kazancı: kanonun ve BADI'nin yazım biçimi, test başına geri alma, tüketicinin komutu aynı işlemde sarabilmesi, sözleşmelerin sade imzası. Bedeli: yanlış kullanım derlemede değil çalışma anında görülür ve işlemi gizli bir bağlam taşır. Kullanıcının seçimi (fabrika) yerindedir; neye karşı seçildiği böyle yazıldı.

Ajan önerileri — kullanıcı teyit etti (2026-11-24); ikisi de ölçümle yeniden bakılacak başlangıç değerleridir:
- İlk sürümde otomatik yeniden deneme yoktur: iki iş aynı kayıtta çakışırsa hata istemciye "yeniden dene" olarak döner. Neden: yeniden deneme işin kodunu baştan çalıştırır ve dışarıya giden etki iki kez gider. BADI'de 5 kez yeniden deneme vardır; yük sınamasında çakışma oranı ölçülür, gerekirse eklenir.
- İşlem veritabanının varsayılan yalıtım düzeyinde çalışır ve süre sınırı 5 saniyeyle başlar (BADI'deki ayar; bu depoda ölçülmedi). Neden: yetki kararları (şartlı yazma, sayaç satırını kilitleme; KR-010) bu düzeye göre tasarlandı.

Açık noktalar:
- Kapanmış örneğin callback dışında kullanılması çalışma anında hata atar (öneri ajan).
- Bu kümede kanondan alınmayı bekleyenler: komut ile sorgunun ayrılması, yumuşak silme, denetim kaydı, outbox ve aggregate root.

Neyden vazgeçildi: kanon ve BADI ile aynı yazım biçimi (kod iki yönde birebir taşınmaz; KR-004'teki kazanç bu noktada azalır); iç içe çağrıda dıştaki işleme kendiliğinden katılma.

## Kabulden önce kapanması gerekenler
Bağımsız inceleme (2026-11-24; çok oturumlu iş akışı, salt okuma): bu kararı bir oturum çürütmeye çalıştı, bulgularını ikinci bir oturum metne karşı tek tek sınadı. Hüküm: imzalamam: `run`/`read` omurgası ve derleme anındaki yazma yasağı savunulabilir, ama tek yönlü denen bu karar kendisinden sonra yazılan KR-012 ve KR-013 ile uzlaştırılmamış (her okuma isteği outbox'a yazıyor, iki veritabanı var, tüketici komutu aynı işlemde sarmak zorunda) ve bağladığını söylediği yazım biçiminin imzası ile kapsamı metinde yok. Bulgu sayısı 12; ikinci oturumun çürütebildiği bulgu 0. "Doğrulandı" ya da "kısmen" denen bulgular aşağıdadır; ağırlıklar ikinci oturumun düzelttiği ağırlıklardır. Metinler kısaltılmıştır; hiçbir şey kodla sınanmadı. Ajan bulguları henüz tek tek işlemedi; "açık" yazan her satır bekliyor.

| # | Ağırlık | İlk kodlama adımını bekletir | Kullanıcı kararı ister | Bulgu | Önerilen düzeltme | Durum |
|---|---|---|---|---|---|---|
| 1 | ağır | evet | evet | KR-013 her okuma isteğinin ana veritabanına bir outbox satırı (erişim kaydı) yazmasını ister; KR-011 ise `read` kapısının işlem açmadığını, yazmanın yalnız `run` içinde yapıldığını ve outbox yazımının istisna olmadığını söyler. … | Erişim kaydının hangi kapıdan ve ne zaman yazıldığını KR-011'e yaz ve kullanıcıya iki yolu sor: (a) `read` kapanırken ortak kod tek satırı kendisi yazar ve bu, 'yazma yalnız `run` içinde' kuralının adıyla sayılı tek istisnası … | kapandı (kullanıcı, 2026-11-24; Seçim 9): kayıt istek sonunda, cevaptan önce ortak kodca yazılır; yazılamazsa okuma reddedilir |
| 2 | orta | evet | hayır | KR-011 'tek veritabanı işlemi' der ama ana ve iz veritabanı ayrımını hiç anmaz: `run`'ın hangisini kapsadığı, iz tablolarının repository'sinin hangi kapıdan alındığı ve ana veritabanı işleminin içinde iz belirteci istenirse ne olacağı yazılı değil. … | KR-011'e ekle: Unit of Work yalnız ana veritabanını kapsar; iz veritabanına yalnız `shared/observability` kendi istemcisiyle erişir ve bu 'İstisna yolu'nda adıyla sayılır; iz kaydı olay kimliğiyle tekil yazılır; … | kapandı (ajan tanımı, 2026-11-24; Yazım biçimi): Unit of Work yalnız asıl veritabanını kapsar; ortak tabloları ortak kodun registrar'ı kaydeder |
| 3 | orta | evet | evet | İşlem içindeyken `read` çağrılırsa ne olacağı yazılı değil ve KR-005 Kural 4 işlem nesnesini yalnız 'aynı işlemde yazan' sözleşme metoduna verdirir; `run` içinden çağrılan okuma sözleşmesi (yetki verisi ve sürümler, kullanıcı sorgusu) bu yüzden ikinci bir bağlantıdan okur. … | Dört tanım yaz: `run` içinde `read` çağrısı da hata verir ve işlem içindeki her okuma o örnekten yapılır; KR-005 Kural 4'ün istisnası aynı işlemde çalışan okuma metotlarını da kapsar (teyitli bir kuralı genişlettiği için … | kapandı (kullanıcı, 2026-11-24; Seçim 10): işlem içinde okuma kapısı hata verir; KR-005 Kural 4 genişledi. İşlem nesnesinin türü ve iş biriminin tanımı ajan tanımı olarak yazıldı |
| 4 | orta | hayır | evet | KR-012 tüketicinin yalnız çevirip kendi feature'ının komutunu çağırmasını ve aynı olayın ikinci kez etki etmemesini (ölçüt 3, hedef 0) ister; komut kendi `run`'ını açar ve iç içe `run` hata verir, yani 'bu olay işlendi' satırı komutun yazmalarıyla aynı işleme giremez. … | Kullanıcıya iki yolu sor ve seçileni KR-011 ile KR-012'ye yaz: (a) tüketici tabanı `run`'ı açar, 'işlendi' satırını yazar ve komutun iş kodunu örnek alan bir işlev olarak çağırır (her komutun iş kodu handler'dan ayrı durur); … | kapandı (kullanıcı, 2026-11-24: b): 'işlendi' kaydı komutun işlemine girmez; ayrı tabloda süreli sahiplenmeyle tutulur ve tüketicinin çağırdığı komut tekrar güvenli yazılır (KR-012 Kural 3 eki). İç içe run gerekmez |
| 5 | orta | evet | evet | Seçim 8'in 'açık' bıraktığı noktalar ilk şemadan önce kapanmak zorunda: ilk şema outbox tablosudur ve zarf olay kimliğini satır yazılmadan taşır, yani uygulamada üretim en az orada şarttır; karar yalnız veritabanındaki `uuidv7()` işlevini ölçmüş. … | İlk şemadan önce dört satır yaz, ilk ikisini kullanıcıya sor: kimlik nerede üretilir (uygulamada tek ortak üretici mi, veritabanı varsayılanı mı); oluşturma anının kimlikten okunması kabul edilen sızıntı mı; … | kapandı (kullanıcı, 2026-11-24; Seçim 8 eki): kimlik uygulamada tek üreticiyle üretilir, kolon yerel uuid, varsayılan yok; Node'un yerleşik üreticisi ölçüldü. Zaman bilgisi bedel olarak yazıldı |
| 6 | hafif | hayır | evet | KR-010 'derlemede sürüm ve yetki verisi tek anlık görüntüde okunur' der, KR-011'de bunu sağlayacak yer yok: `read` işlem açmaz, `run` yalnız varsayılan yalıtımda çalışır ve o düzeyde aynı işlemdeki her sorgu ayrı anı görür; satır 92 sorunu yalnız `read`'e bağlayarak yanlış sınıflandırıyor. … | Kullanıcıya sor: (a) `run`'a isteğe bağlı yalıtım düzeyi ya da ayrı bir 'anlık görüntülü okuma' kapısı eklenir; (b) KR-010'daki cümle 'sürüm önce okunur; … | açık |
| 7 | hafif | hayır | evet | Seçim 5 dıştaki işleme katılmayı 'gizli bağlam ister' diye reddeder, ama 'işlemin içinde miyim' işareti de tekil bir çalıştırıcıda ancak aynı tür gizli bağlamla (AsyncLocalStorage benzeri) tutulabilir; … | İşaretin AsyncLocalStorage olduğunu, yalnız çalıştırıcının okuduğunu ve işlem kapanınca 'kapalı' sayıldığını yaz. Ayrı işlem için kullanıcıya sor: … | kısmen kapandı (ajan tanımı): işaretin mekanizması ve ömrü yazıldı; adıyla istenen ayrı işlem ilk kullanıcısına ertelendi |
| 8 | orta | hayır | hayır | 'İki iş aynı kayıtta çakışırsa hata döner' cümlesi varsayılan yalıtımda böyle gerçekleşmez: ikinci yazma hata almaz, satır kilidini bekler; hatayı üretenler kilitlenme döngüsü, süre aşımı, tekil kısıt ve KR-010'un şartlı yazmasındaki sıfır satırdır, ve hangisinin dışarıya 'yeniden dene', hangisinin 'yetki yok' diye döneceği … | Küçük bir hata tablosu ekle (kilitlenme ve süre aşımı 'yeniden dene', sıfır satır 'bulunamadı ya da yetki yok', tekil kısıt 'çakışma'; dışarıya dönen kodlarıyla); … | kapandı (ajan tanımı): çakışma cümlesi düzeltildi, hata dönüşleri yazıldı; uç kodları yazılmadı, çakışan yazmanın beklediği denenmedi |
| 9 | orta | hayır | hayır | 'Okuma testi' yazıldığı gibi gözlenemez: PostgreSQL tekil sorguyu da örtük bir işlem sayar, 'işlem açılmadı' ancak 'açık BEGIN gönderilmedi' diye tanımlanıp sunucu günlüğünden bakılırsa sınanır. … | Doğrulamayı gözlenebilir cümlelerle yeniden yaz ('`read` çağrısında sunucu günlüğünde BEGIN yok'); yükümlülük 1 için içe aktarma kısıtı ekle (Prisma istemcisini yalnız `shared/database` ve infrastructure içe aktarır); … | kısmen kapandı (GV-007, 2026-11-24): feature kodu ham istemci belirteçlerini ve üretilen istemci klasörlerini içe aktaramaz; lint sınırı kasıtlı ihlal dosyasıyla diskte ölçüldü. Varsayım: shared kod ham istemciyi yeniden dışa vermez (sınır yalnız doğrudan bağımlılığa bakar). Okuma testinin gözlenebilir yazımı açık |
| 10 | hafif | hayır | hayır | En güçlü karşı görüş belgede yok: A seçeneği yalnız BADI'deki zayıf hâliyle ('işlem dışında yazmak derlenir ve çalışır') anlatılmış; 'ortam bağlamı, okuma ve yazma arayüzü ayrımı ve işlem dışında yazmada çalışma anı hatası' birleşimi hiç tartılmamış. … | Seçenekler'e bu dördüncü seçeneği kazancı ve bedeliyle ekle; 'Neyden vazgeçildi'ye test başına geri almayı, komutların sarılabilmesini ve sözleşmelerin sade imzasını yaz. … | kapandı (ajan): eksik karşı görüş kazancı ve bedeliyle yazıldı; seçim değişmedi |
| 11 | orta | hayır | hayır | 'Göç ve tohum betikleri Unit of Work kullanmaz' istisnası yetki tablolarına kapıların dışından yazan ikinci bir yol açar: tohum yardımcısı 'göçün işlemi içinde' çalışır, yani genel sayaç kilidi, sürüm artırma, değişiklik kaydı ve outbox yazımı orada elle yinelenir ve ortak koddaki sürüm parçası ile outbox yazıcı ikinci bir … | Satır 101'i ikiye böl: şema göçü Unit of Work kullanmaz; tohum göçü uygulamanın içinde koşan sürümlü bir iştir ve tohum yardımcısını `run` içinde, öbür yazmalarla aynı kapılardan çağırır. … | kısmen kapandı (ajan tanımı): şema göçü ile tohum göçü ayrıldı; tohum göçü koşucusu tasarlanmadı (TS-002) |
| 12 | hafif | hayır | evet | Seçim 7 ve 8 (adlandırma ve kimlik türü) başlığı ve özeti yalnız Unit of Work'ü anlatan bir kararda duruyor; ölçütleri, yükümlülükleri, sınamaları ve geri dönüş satırları yok, oysa TS-002 tablo ve kolon adlarını 'tek yönlü' sayıyor. … | Seçim 7 ve 8'i kendi karar taslağına taşı ya da bu karara ölçüt, yükümlülük, sınama ve geri dönüş satırlarını ekle; üç ajan okumasını kullanıcıya sun (dizin adı biçimi dahil); … | kısmen kapandı (kullanıcı, 2026-11-24: b): dizin, anahtar ve kısıt adlarının eki Türkçedir ve biçimi yazıldı (Seçim 7 eki). Seçim 7 ve 8'in kendi karar taslağına taşınması ve ölçüt, sınama satırları açık |

## Sonuçlar
- Olumlu: işlem dışında yazma derleme hatasıdır; salt okuma işlem açmaz; repository tek yerde kaydedilir; ortak kod feature adı bilmez; istek ve kişisiz iş aynı yoldan çalışır.
- Olumsuz: yazım biçimi kanondan ve BADI'den ayrılır; örnek her yardımcıya açıkça taşınır; iç içe çağrı kanondakinin tersine hata verir; her repository iki arayüz taşır.
- Yükümlülük (kural adayları; taslakları açık noktalar kapanınca açılacak):
  1. Repository yalnız Unit of Work'ün `run` ya da `read` kapısından alınır; doğrudan enjekte edilmez.
  2. Yazma yalnız `run` içinde yapılır; her repository ayrı bir okuma arayüzü taşır ve `read` kapısı yalnız onu verir (Seçim 6).
  3. Repository feature başına tek registrar'da kaydedilir; ortak koddaki Unit of Work arayüzüne feature adı yazılmaz.
  4. İşlem nesnesi callback dışına çıkarılmaz; yardımcı kendi işlemini açmaz, örneği parametre alır.
  5. İç içe `run` hata verir; ayrı işlem yalnız adıyla istenir (Seçim 5).
- Ortak parça: `shared/database` altında Unit of Work çalıştırıcısı ve registrar arayüzü; adları ve sınırları tasarlanmadı.

## Doğrulama
Denetim kimliği ve ölçüm tarihi henüz yok; kod yazılmadı.
Öneri (ajan). Birim: çağrı.
- Derleme testi: işlem dışında yazma çağrısı ve `read` görünümünde yazma çağrısı derlenmez.
- Geri alma testi: `run` içinde hata olursa hiçbir yazma kalmaz.
- Okuma testi: `read` ile yapılan istekte veritabanında işlem açılmaz.
- Kayıt testi: aynı belirteç iki kez kaydedilemez.
- İç içe çağrı testi: `run` içinde yeniden `run` çağrısı hata atar; adıyla istenen ayrı işlemin yazdığı kayıt, dıştaki iş geri alınsa da kalır.

## Varsayımlar
- "`read` görünümünde yazma derlenmez" TypeScript tip düzeyinde sağlanabilir; denenmedi; varsayım, 2026-12-21.
- Prisma 7 callback içinde işlem nesnesi veren etkileşimli işlemi sunar; 7.10 için belge okundu (2026-11-21), bu depoda denenmedi; varsayım, 2026-12-21.
- `read` kapısında işlem açılmadığı için bir istekteki birden çok okuma veritabanının farklı anlarını görebilir; bunun sorun çıkarmadığı varsayım, 2026-12-21. Yetki derlemesindeki "tek anlık görüntü" kuralı (KR-010) buna takılır ve ayrıca bakılacak.
- Bağlantı havuzu ve işlem süre sınırı sayıları belirlenmedi; varsayım: yürüyen iskelette ölçülür, 2026-12-21.

## Geri dönüş
- Fabrikadan ortam bağlamına dönüş: her handler'ın yazım biçimi değişir; mekanik ama bütün feature'lara yayılır.
- İki kapıdan tek kapıya dönüş: `read` çağrıları `run`'a çevrilir; mekaniktir.
- Yeniden bakma tetiği (öneri, ajan; eşik belirlenmedi): yürüyen iskelette örneği taşımanın yükü ağır çıkarsa; seçilen Prisma sürümü işlem arayüzünü değiştirirse.

## İstisna yolu
- Göç ve tohum betikleri Unit of Work kullanmaz; kendi araçlarıyla çalışır.
- Ortak altyapı yazımları (outbox, değişiklik kaydı) istisna değildir: iş yazmasıyla aynı örnekten geçer.
- Bunların dışındaki sapma için yol tanımlanmadı; kullanıcıya sorulacak.
