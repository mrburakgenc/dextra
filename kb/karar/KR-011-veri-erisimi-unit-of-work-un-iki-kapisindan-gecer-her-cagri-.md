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
7. Veritabanındaki adlar Türkçedir ve snake_case yazılır; tablo, kolon ve öbür veritabanı nesneleri buna dahildir (örnek: `kullanici_adi`). Koddaki model ve alan adları serbesttir. Kullanıcının sözü: "veritabanında terimler Türkçe olsun; veritabanında kesinlikle snake_case olsunlar, objeler de buna dahil; modelde KullaniciAdi olabilir, o fark etmez".
   - Kullanıcı teyidi (2026-11-24; ilk şema taslağı TS-002 "Veri modeli" üzerinde gösterildi): tablo adı tekildir (`kullanici`); adlar Türkçeye özgü harf taşımaz (`uyelik`, `kullanici_adi`); zaman kolonu `_zamani` ile, başka tabloya bağ `_id` ile biter (`olusturma_zamani`, `grup_id`); veritabanında saklanan sabit değerler Türkçedir (kapatılma nedeni: `cikis`, `parola_degisimi`); şartın içindeki anahtarlar Türkçedir (`alan`, `islec`, `deger`); koddaki model ve alan aynı sözcüğün kod yazımıdır (model `Kullanici`, alan `kullaniciAdi`, kolon `kullanici_adi`).
   - Kullanıcı teyidi (2026-11-24): dosya adlarında iş sözcükleri Türkçe, desen ve altyapı sözcükleri İngilizcedir (`giris.handler.ts`, `oturum.repository.ts`); reddedilen: hepsinin Türkçe olması (`giris.isleyici.ts`).
   - Ajan okumaları (teyide sunulmadı): indeks ve kısıt adları tablo ve kolon adından türediği için aynı kurala uyar; göç aracının kendi tablosu bu kuralın dışındadır; teknik altyapı adları İngilizce kalır (`UnitOfWork`, `health`). Yetki tanımındaki kaynak ve alan adları modeldeki adlardır (KR-008 Seçim 33).
8. Kayıtların kimliği zaman sıralı rastgele kimliktir (UUID v7). Kullanıcı (2026-11-24): a. Neden: kimlikler adreslerde ve belirteçlerde dolaşır ve tahmin edilemez, kayıt sayısı dışarıdan anlaşılmaz; faz 2'de her servis kendi kimliğini üretir; zaman sıralı olduğu için yeni kayıt dizinin sonuna eklenir. Reddedilen: artan sayı (en küçük ve en hızlı, elle okunur; ama bir sonraki kimlik tahmin edilir ve servisler ayrılınca ortak sayaç ister). Kabul edilen bedel: kimlik 16 bayttır, tablolar ve dizinler büyür (ölçülmedi); kimlikler göze okunaksızdır. Kimliğin tahmin edilememesi tek başına koruma değildir; korumayı yetenek satırı verir.
   - Ölçüldü (2026-11-24): yereldeki PostgreSQL 19'da `uuidv7()` işlevi hazır geliyor ve değer üretiyor.
   - Açık (ajan): kimliğin veritabanında mı uygulamada mı üretileceği (kanondaki "kayıt kimliğini kendisi taşır" deseni uygulamada üretmeyi gerektirebilir); altyapı tablolarının (outbox, iz) aynı türü kullanıp kullanmayacağı; kimliğin içindeki zaman bilgisinin kaydın oluşturulma anını ele vermesi (kabul edilen bir sızıntı mı, sorulmadı).

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
| 1 | ağır | evet | evet | KR-013 her okuma isteğinin ana veritabanına bir outbox satırı (erişim kaydı) yazmasını ister; KR-011 ise `read` kapısının işlem açmadığını, yazmanın yalnız `run` içinde yapıldığını ve outbox yazımının istisna olmadığını söyler. … | Erişim kaydının hangi kapıdan ve ne zaman yazıldığını KR-011'e yaz ve kullanıcıya iki yolu sor: (a) `read` kapanırken ortak kod tek satırı kendisi yazar ve bu, 'yazma yalnız `run` içinde' kuralının adıyla sayılı tek istisnası … | açık |
| 2 | orta | evet | hayır | KR-011 'tek veritabanı işlemi' der ama ana ve iz veritabanı ayrımını hiç anmaz: `run`'ın hangisini kapsadığı, iz tablolarının repository'sinin hangi kapıdan alındığı ve ana veritabanı işleminin içinde iz belirteci istenirse ne olacağı yazılı değil. … | KR-011'e ekle: Unit of Work yalnız ana veritabanını kapsar; iz veritabanına yalnız `shared/observability` kendi istemcisiyle erişir ve bu 'İstisna yolu'nda adıyla sayılır; iz kaydı olay kimliğiyle tekil yazılır; … | açık |
| 3 | orta | evet | evet | İşlem içindeyken `read` çağrılırsa ne olacağı yazılı değil ve KR-005 Kural 4 işlem nesnesini yalnız 'aynı işlemde yazan' sözleşme metoduna verdirir; `run` içinden çağrılan okuma sözleşmesi (yetki verisi ve sürümler, kullanıcı sorgusu) bu yüzden ikinci bir bağlantıdan okur. … | Dört tanım yaz: `run` içinde `read` çağrısı da hata verir ve işlem içindeki her okuma o örnekten yapılır; KR-005 Kural 4'ün istisnası aynı işlemde çalışan okuma metotlarını da kapsar (teyitli bir kuralı genişlettiği için … | açık |
| 4 | orta | hayır | evet | KR-012 tüketicinin yalnız çevirip kendi feature'ının komutunu çağırmasını ve aynı olayın ikinci kez etki etmemesini (ölçüt 3, hedef 0) ister; komut kendi `run`'ını açar ve iç içe `run` hata verir, yani 'bu olay işlendi' satırı komutun yazmalarıyla aynı işleme giremez. … | Kullanıcıya iki yolu sor ve seçileni KR-011 ile KR-012'ye yaz: (a) tüketici tabanı `run`'ı açar, 'işlendi' satırını yazar ve komutun iş kodunu örnek alan bir işlev olarak çağırır (her komutun iş kodu handler'dan ayrı durur); … | açık |
| 5 | orta | evet | evet | Seçim 8'in 'açık' bıraktığı noktalar ilk şemadan önce kapanmak zorunda: ilk şema outbox tablosudur ve zarf olay kimliğini satır yazılmadan taşır, yani uygulamada üretim en az orada şarttır; karar yalnız veritabanındaki `uuidv7()` işlevini ölçmüş. … | İlk şemadan önce dört satır yaz, ilk ikisini kullanıcıya sor: kimlik nerede üretilir (uygulamada tek ortak üretici mi, veritabanı varsayılanı mı); oluşturma anının kimlikten okunması kabul edilen sızıntı mı; … | açık |
| 6 | hafif | hayır | evet | KR-010 'derlemede sürüm ve yetki verisi tek anlık görüntüde okunur' der, KR-011'de bunu sağlayacak yer yok: `read` işlem açmaz, `run` yalnız varsayılan yalıtımda çalışır ve o düzeyde aynı işlemdeki her sorgu ayrı anı görür; satır 92 sorunu yalnız `read`'e bağlayarak yanlış sınıflandırıyor. … | Kullanıcıya sor: (a) `run`'a isteğe bağlı yalıtım düzeyi ya da ayrı bir 'anlık görüntülü okuma' kapısı eklenir; (b) KR-010'daki cümle 'sürüm önce okunur; … | açık |
| 7 | hafif | hayır | evet | Seçim 5 dıştaki işleme katılmayı 'gizli bağlam ister' diye reddeder, ama 'işlemin içinde miyim' işareti de tekil bir çalıştırıcıda ancak aynı tür gizli bağlamla (AsyncLocalStorage benzeri) tutulabilir; … | İşaretin AsyncLocalStorage olduğunu, yalnız çalıştırıcının okuduğunu ve işlem kapanınca 'kapalı' sayıldığını yaz. Ayrı işlem için kullanıcıya sor: … | açık |
| 8 | orta | hayır | hayır | 'İki iş aynı kayıtta çakışırsa hata döner' cümlesi varsayılan yalıtımda böyle gerçekleşmez: ikinci yazma hata almaz, satır kilidini bekler; hatayı üretenler kilitlenme döngüsü, süre aşımı, tekil kısıt ve KR-010'un şartlı yazmasındaki sıfır satırdır, ve hangisinin dışarıya 'yeniden dene', hangisinin 'yetki yok' diye döneceği … | Küçük bir hata tablosu ekle (kilitlenme ve süre aşımı 'yeniden dene', sıfır satır 'bulunamadı ya da yetki yok', tekil kısıt 'çakışma'; dışarıya dönen kodlarıyla); … | açık |
| 9 | orta | hayır | hayır | 'Okuma testi' yazıldığı gibi gözlenemez: PostgreSQL tekil sorguyu da örtük bir işlem sayar, 'işlem açılmadı' ancak 'açık BEGIN gönderilmedi' diye tanımlanıp sunucu günlüğünden bakılırsa sınanır. … | Doğrulamayı gözlenebilir cümlelerle yeniden yaz ('`read` çağrısında sunucu günlüğünde BEGIN yok'); yükümlülük 1 için içe aktarma kısıtı ekle (Prisma istemcisini yalnız `shared/database` ve infrastructure içe aktarır); … | açık |
| 10 | hafif | hayır | hayır | En güçlü karşı görüş belgede yok: A seçeneği yalnız BADI'deki zayıf hâliyle ('işlem dışında yazmak derlenir ve çalışır') anlatılmış; 'ortam bağlamı, okuma ve yazma arayüzü ayrımı ve işlem dışında yazmada çalışma anı hatası' birleşimi hiç tartılmamış. … | Seçenekler'e bu dördüncü seçeneği kazancı ve bedeliyle ekle; 'Neyden vazgeçildi'ye test başına geri almayı, komutların sarılabilmesini ve sözleşmelerin sade imzasını yaz. … | açık |
| 11 | orta | hayır | hayır | 'Göç ve tohum betikleri Unit of Work kullanmaz' istisnası yetki tablolarına kapıların dışından yazan ikinci bir yol açar: tohum yardımcısı 'göçün işlemi içinde' çalışır, yani genel sayaç kilidi, sürüm artırma, değişiklik kaydı ve outbox yazımı orada elle yinelenir ve ortak koddaki sürüm parçası ile outbox yazıcı ikinci bir … | Satır 101'i ikiye böl: şema göçü Unit of Work kullanmaz; tohum göçü uygulamanın içinde koşan sürümlü bir iştir ve tohum yardımcısını `run` içinde, öbür yazmalarla aynı kapılardan çağırır. … | açık |
| 12 | hafif | hayır | evet | Seçim 7 ve 8 (adlandırma ve kimlik türü) başlığı ve özeti yalnız Unit of Work'ü anlatan bir kararda duruyor; ölçütleri, yükümlülükleri, sınamaları ve geri dönüş satırları yok, oysa TS-002 tablo ve kolon adlarını 'tek yönlü' sayıyor. … | Seçim 7 ve 8'i kendi karar taslağına taşı ya da bu karara ölçüt, yükümlülük, sınama ve geri dönüş satırlarını ekle; üç ajan okumasını kullanıcıya sun (dizin adı biçimi dahil); … | açık |

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
