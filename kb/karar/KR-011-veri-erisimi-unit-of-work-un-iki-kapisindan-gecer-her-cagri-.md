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
   - Ajan okumaları (ilk şema yazılırken kullanıcıya gösterilip teyit edilecek): adlar Türkçeye özgü harf taşımaz (`kullanici`, `uyelik`); tablo adı tekildir; indeks ve kısıt adları tablo ve kolon adından türediği için aynı kurala uyar; veritabanında saklanan sabit değerler ve JSON anahtarları da Türkçedir (şart: `alan`, `islec`, `deger`); göç aracının kendi tablosu bu kuralın dışındadır.
   - Ajanın seçimi (kullanıcı serbest bıraktı): koddaki alan adları da Türkçe yazılır ki kod, veritabanı ve yetki tanımları tek sözlüğü konuşsun (model `Uyelik`, alan `kullaniciId`, kolon `kullanici_id`); teknik altyapı adları İngilizce kalır (`UnitOfWork`, `health`). Yetki tanımındaki kaynak ve alan adları modeldeki adlardır (KR-008 Seçim 33).

Ajan önerileri — kullanıcı teyit etti (2026-11-24); ikisi de ölçümle yeniden bakılacak başlangıç değerleridir:
- İlk sürümde otomatik yeniden deneme yoktur: iki iş aynı kayıtta çakışırsa hata istemciye "yeniden dene" olarak döner. Neden: yeniden deneme işin kodunu baştan çalıştırır ve dışarıya giden etki iki kez gider. BADI'de 5 kez yeniden deneme vardır; yük sınamasında çakışma oranı ölçülür, gerekirse eklenir.
- İşlem veritabanının varsayılan yalıtım düzeyinde çalışır ve süre sınırı 5 saniyeyle başlar (BADI'deki ayar; bu depoda ölçülmedi). Neden: yetki kararları (şartlı yazma, sayaç satırını kilitleme; KR-010) bu düzeye göre tasarlandı.

Açık noktalar:
- Kapanmış örneğin callback dışında kullanılması çalışma anında hata atar (öneri ajan).
- Bu kümede kanondan alınmayı bekleyenler: komut ile sorgunun ayrılması, yumuşak silme, denetim kaydı, outbox ve aggregate root.

Neyden vazgeçildi: kanon ve BADI ile aynı yazım biçimi (kod iki yönde birebir taşınmaz; KR-004'teki kazanç bu noktada azalır); iç içe çağrıda dıştaki işleme kendiliğinden katılma.

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
