---
kimlik: KR-012
tur: karar
durum: taslak
surum: 1
baslik: Olay outbox'tan geçer, her tüketicinin kendi kuyruğu vardır ve tüketici sistem aktörüyle çalışır
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-24
baglam: TS-001
---
Feature'lar arası olaylar için olay iş ile aynı işlemde outbox'a yazılır, aktarıcı her tüketicinin kendi kuyruğuna birer iş koyar ve tüketici kendi feature'ının sistem aktörüyle çalışır; olay kaybolmaz, her abone olayı alır ve kişisiz iş en az yetkiyle çalışır, karşılığında abone listesi kodda tutulur, her feature'a aktör tohumlanır ve tüketiciler tekrar gelen olaya dayanıklı yazılır.

> Bu taslak kullanıcının 2026-11-24 seçimlerinden derlendi; metni ajan yazdı. Konuşma TS-001 "Çürütme" bölümünün sonundaki kapanış satırlarındadır. "Kullanıcı" yazan satırlar kullanıcının sözüdür; "öneri (ajan)" yazan satırlar teyit ister. Ağırlık tek yönlüdür, çünkü zarf, sözleşme ve tüketici biçimi olay yayan ve dinleyen her feature'ı bağlar; kuyruk aracının kendisi arayüzün arkasında kaldığı için çift yönlüdür. Bağımsız çürütme turu koşmadı ve kod yoktur; kabule hazır değildir.

## Bağlam
- Kullanıcı (2026-11-23): kuyruk kullanılacak ve olay güdümlü tasarım (EDD) buradan gelecek; mikroservis faz 2'dir ve yapı adım adım taşınacaktır (KR-005).
- Kanon (`kb/_gelen/IRON_RULES_EVENTS.md`; okunanlar: dizin satır 1–26, EVT-00 satır 27–121, EVT-01 satır 125–164, EVT-04 satır 311–350, EVT-05 satır 389–418, EVT-10 satır 693–762; öbür kuralların yalnız başlığı ve sorumluluk cümlesi okundu): on üç kural vardır. Olay doğrudan kuyruğa konmaz, iş ile aynı işlemde outbox tablosuna yazılır ve aktarıcı kuyruğa taşır (EVT-04); her olay standart zarfla yayınlanır (EVT-01); tüketici aynı olayı iki kez işlese de sonuç aynıdır ve bunun için olay kimliği + tüketici kimliğiyle kayıt tutulur (EVT-05, EVT-06).
- Kanondaki örnek bütün tüketicileri tek ortak kuyruğa bağlar (EVT-05 örneği, `@Processor('domain-events')`).
- BullMQ belgesi (okundu 2026-11-24, docs.bullmq.io "Relay > How it compares"): kuyrukta her mesaj tek işçiye gider. Aynı belge deneysel yayın-abone parçası Relay için "it is not a log: when a message must be processed reliably and with retries, use a queue" der.
- NestJS belgesi (okundu 2026-11-24): `@nestjs/bullmq` BullMQ'yu sarar ve BullMQ işlerini Redis'te tutar; RabbitMQ ayrı bir sunucudur ve ayrı bir taşıyıcıyla bağlanılır.
- BADI (salt okuma, 2026-11-24): bağımlılık listesinde `@nestjs/bullmq`, `bullmq` ve `ioredis` vardır; RabbitMQ paketi yoktur.
- Bağlı kararlar: kişisiz iş sistem aktörüyle çalışır ve yeteneği unutulan iş çalışmaz (KR-010 Seçim 25); başka feature'da yazma ya aynı işlemde ya da olayla yapılır (KR-005 Kural 3); outbox yazımı iş yazmasıyla aynı Unit of Work örneğinden geçer (KR-011).
- Kullanıcının 2026-11-17 talimatı: ajan kişisel veriyi gizleme ya da maskeleme işini kendiliğinden eklemez, sorar.

## Ölçütler
Kullanıcıdan sayısal ölçüt gelmedi. Öneri (ajan; teyit edilmedi):
1. Kaybolan olay. Ölçü: işi yazılmış ama outbox satırı olmayan olay sayısı. Hedef: 0.
2. Abonelere ulaşma. Ölçü: bir olayı alan abone sayısının abone sayısına oranı. Hedef: 1.
3. Tekrar gelen olay. Ölçü: aynı olayın aynı tüketicide ikinci kez etki ettiği durum sayısı. Hedef: 0.
4. Kuyruk aracına bağımlılık. Ölçü: feature kodunda kuyruk kütüphanesini içe aktaran dosya sayısı. Hedef: 0.

## Seçenekler
### Bir olay birden çok tüketiciye nasıl ulaşır
- A — BullMQ, tüketici başına ayrı kuyruk (seçildi): aktarıcı abone listesine bakar ve her aboneye birer iş koyar; yeni sunucu gerekmez.
- B — RabbitMQ: olayı abonelere sunucu dağıtır; bugünden kurulup işletilecek yeni bir sunucudur; faz 2'de değişiklik gerektirmez.
- C — BullMQ, tek ortak kuyruk (kanondaki örnek): iş tek tüketiciye gider, öbür aboneler olayı görmez (ölçüt 2'yi karşılamaz).
### Tüketici kimin adına çalışır
- A — Sistem aktörüyle (seçildi).
- B — Olayı başlatan kişinin adına: her kullanıcıya olayların dokunduğu bütün feature'lar için yetenek vermek gerekir; yetkisi sonradan alınan kişinin olayı yeniden denemede düşer.
### Sistem aktörü kaç tanedir
- A — Tek aktör: zamanla her şeye yetkili olur; izden hangi işin yazdığı anlaşılmaz.
- B — Feature başına bir aktör (seçildi).
- C — İş başına bir aktör: kullanıcı ve üyelik satırı yükü kazancı karşılamaz.
### Silme talebinde kişisel veri
- A — Kanondaki mekanizma base'e alınır (seçildi).
- B — Base'e alınmaz: sonradan eklemek yazılmış her feature'a geri dönmeyi gerektirir.

## Seçim
Kullanıcı seçimleri (2026-11-24):
1. Kuyruk BullMQ'dur ve her tüketicinin kendi kuyruğu vardır: aktarıcı outbox'tan okur, abone listesine bakar ve her aboneye birer iş koyar. Feature'lar BullMQ'yu doğrudan tanımaz; olay gönderme ve dinleme ortak kodda tek bir arayüzün arkasında durur (kapı ve bağdaştırıcı) ve faz 2'de arkası başka bir mesaj sunucusuyla değiştirilebilir.
2. Olay tüketicisi, olayı bir insan başlatmış olsa da sistem aktörüyle çalışır; olayı çıkaran iş zaten başlatanın yetkisiyle denetlenmiştir.
3. Her feature'ın kendi sistem aktörü vardır; o feature'ın tüketicileri ve zamanlanmış işleri onunla çalışır ve aktör yalnız o feature'ın işlerine yetecek yeteneği taşır. Her aktör kök grupta kendi rolüyle üyedir; kullanıcısı, rolü ve yetenek satırları göçle tohumlanır.
4. Silme talebi mekanizması kanondaki gibi base'e alınır: kullanıcı kaydındaki kişisel alanlar kişiye geri götürmeyen bir değerle değiştirilir ve kullanıcı kapatılır; bir olay çıkar ve kişisel veri tutan her feature kendi kopyasını aynı şekilde değiştirir; denetim kayıtları, değişiklik kayıtları ve eski olayların içeriği de aynı işlemden geçer, satırlar silinmez. Kural şimdi yazılır, kod olay altyapısı çalıştıktan sonra eklenir. Ajan bunu kendiliğinden almadı, sordu; ekranda gizleme değildir.

Kurallar (öneri ajan; kullanıcı 2026-11-24'te teyit etti; hiçbiri denenmedi):
```
shared/<konu>/olaylar/<olay>.v1.ts                    olay sözleşmesi: tür adı, sürüm, düz veri
features/<yayan>/<alt özellik>/application/…          run içinde outbox'a yazar; kuyruğu tanımaz
features/<dinleyen>/<alt özellik>/infrastructure/workers/<olay>.tuketici.ts
                                                      çevirir ve kendi feature'ının komutunu çağırır
```
- Kural 1. Olay sözleşmesi (tür adı, sürüm ve taşıdığı veri) ortak kodda, iş konusunun klasöründe durur; taşıdığı veri düzdür.
- Kural 2. Olayı çıkaran iş onu yalnız `run` içinde outbox'a yazar; zarfı ortak koddaki kurucu üretir.
- Kural 3. Tüketici yalnız çevirir ve kendi feature'ının komutunu çağırır; iş kuralı tüketicide değil o komutta durur. Bu, feature ACL'inin (KR-005 Kural 7) olaylardaki karşılığıdır; tüketici kanondaki yerinde, alt özelliğin infrastructure katmanında kalır.
- Kural 4. Her tüketici hangi olayı dinlediğini ortak koddaki kayıt defterine bildirir; aktarıcı işleri bu deftere göre dağıtır.
- Kural 5. Zarf, kanondaki alanlara ek olarak olayı başlatan kişinin kimliğini taşır ve tüketicinin yazdığı değişiklik kaydı onu gösterir (kanondan sapma; kanondaki zarfta bu alan yoktur).

- Kural 6. Aktarılan outbox satırı 3 gün sonra silinir; aktarılmamış satır silinmez (kullanıcı, 2026-11-24; kanonda 30 gündür, ajanın önerisi hemen silmekti). Neden: okuma kayıtları da outbox'tan geçer (KR-013) ve bekleyen satırlar asıl veritabanını büyütür.

Kanondan olduğu gibi alınacaklar (ayrıntıları kurala çevrilirken okunacak): zincirin izlenmesi (EVT-02), şema sürümü (EVT-03), tekrar güvenli tüketici ve kayıt tablosu (EVT-05, EVT-06), bekleme kuyruğu (EVT-07), artan aralıklı yeniden deneme (EVT-08), yeniden oynatma (EVT-09), dış sistemden gelen olayın çevrilmesi (EVT-11), saga (EVT-12).

Açık:
- Kapandı (kullanıcı teyidi, 2026-11-24; TS-001 "Kanon harmanı" Ç1): kanonda kuyruğa doğrudan yazan örnekler alınmaz; kuyruğa giden her şey, denetim kaydı dahil, outbox'tan geçer.
- Silme talebinde değişiklik kayıtlarının içinin nasıl taranacağı tasarlanmadı; hangi projede hangi kayda uygulanacağı hukuki değerlendirmedir ve projeye aittir.
- Yetki önbelleği ile kuyruk aynı Redis'i paylaşırsa bellek dolduğunda ne olacağı (altyapı).
- Değişiklik ve erişim kayıtlarının nereye yazılacağı (gözlemlenebilirlik kümesi).

Neyden vazgeçildi: abonelerin kuyruk aracında tanımlanması (liste kodda tutulur); tüketicinin başlatan kişinin yetkisiyle çalışması; kanondaki tek ortak kuyruk örneği.

## Sonuçlar
- Olumlu: iş yazıldıysa olay da yazılmıştır; her abone olayı alır; kuyruk aracı değişse feature kodu değişmez; kişisiz iş en az yetkiyle çalışır ve izden hangi feature'ın yazdığı okunur; faz 2'de feature'ın hazır bir kimliği olur.
- Olumsuz: abone listesi kodda tutulur ve aktarıcı her olay için abone sayısı kadar iş üretir; her feature için aktör, rol ve yetenek satırları tohumlanır ve unutulursa tüketici çalışmaz; tüketiciler tekrar gelen olaya dayanıklı yazılmak zorundadır; zarf kanondan sapar; silme talebi geri alınamaz bir veri değişikliğidir.
- Yükümlülük (kural adayları; taslakları açılacak):
  1. Olay kuyruğa doğrudan konmaz; iş ile aynı işlemde outbox'a yazılır (EVT-04).
  2. Feature kodu kuyruk kütüphanesini içe aktarmaz; olay gönderme ve dinleme ortak koddaki arayüzden geçer.
  3. Her tüketicinin kendi kuyruğu vardır ve dinlediği olayı kayıt defterine bildirir.
  4. Tüketici tekrar gelen olaya dayanıklıdır (EVT-05) ve yalnız çevirip kendi feature'ının komutunu çağırır.
  5. Tüketici ve zamanlanmış iş kendi feature'ının sistem aktörüyle çalışır; aktörler göçle tohumlanır.
  6. Olay sözleşmesi ortak kodda durur, düz veri taşır ve sürümlüdür; zarf başlatan kişinin kimliğini taşır.
  7. Kişisel veri tutan feature silme olayını dinler ve kendi kopyasını değiştirir.
- Ortak parça: `shared/messaging` altında zarf kurucu, outbox yazıcı, aktarıcı, abone kayıt defteri ve tüketici tabanı; adları ve sınırları tasarlanmadı.

## Doğrulama
Denetim kimliği ve ölçüm tarihi henüz yok; kod yazılmadı.
Öneri (ajan). Birim: çağrı.
- Bütünlük testi: iş geri alınırsa outbox satırı da kalmaz; iş yazılırsa outbox satırı da yazılmıştır.
- Dağıtım testi: üç abonesi olan bir olay üç tüketiciye de ulaşır.
- Tekrar testi: aynı olay bir tüketiciye iki kez gelince etki bir kez olur.
- Yetki testi: sistem aktörüne yeteneği tohumlanmamış tüketici yazamaz; bir feature'ın aktörü başka feature'ın işini yapamaz.
- İz testi: tüketicinin yazdığı değişiklik kaydı sistem aktörünü ve olayı başlatan kişiyi gösterir.
- Sınır denetimi: feature kodunda kuyruk kütüphanesi içe aktarımı yoktur.
- Kesinti testi: Redis yokken iş yazılır ve olay outbox'ta bekler; Redis dönünce tüketicilere ulaşır.

## Varsayımlar
- Tüketici başına ayrı kuyruk BullMQ'da abone sayısı kadar kuyrukla sorunsuz çalışır; denenmedi; varsayım, 2026-12-21.
- Aktarıcının outbox'ı okuma sıklığı ve gecikmesi kabul edilebilir düzeydedir; ölçülmedi; varsayım: yürüyen iskelette ölçülür, 2026-12-21.
- Aynı kayda ait olayların sırası kanondaki bölüm anahtarıyla korunabilir; kural okunmadı ve denenmedi; varsayım, 2026-12-21.
- Kanondaki BullMQ örnekleri seçilecek BullMQ ana sürümüyle uyumludur; BADI 6.2 kullanır, bu depoda sürüm seçilmedi; varsayım, 2026-12-21.

## Geri dönüş
- Kuyruk aracını değiştirmek (BullMQ'dan başka bir mesaj sunucusuna): arayüzün arkası değişir, feature kodu değişmez (öngörü; denenmedi).
- Zarfı ya da sözleşme biçimini değiştirmek: olay yayan ve dinleyen her feature'a dokunur; bu karar o yüzden tek yönlüdür.
- Feature başına aktörden tek aktöre dönüş: üyelik ve yetenek satırlarının birleştirilmesidir; tersi satırların ayrıştırılmasını ister.
- Silme talebinin etkisi geri alınamaz; mekanizmayı kaldırmak ise kod silmektir.
- Yeniden bakma tetiği (öneri, ajan; eşik belirlenmedi): abone sayısı aktarıcının ürettiği iş sayısını taşınmaz kılarsa; faz 2'ye geçiş kararı.

## İstisna yolu
- Feature'ın kendi içindeki anlık tepki olay gerektirmez; aynı işlemde yazılır.
- "İkisi birlikte olmalı ya da hiç" türü feature'lar arası yazma olay değildir; aynı işlemde yapılır (KR-005 Kural 3).
- Bütün sunuculara anlık duyuru (örneğin süreç içi bir kaydı boşaltma) bu kararın kapsamı dışındadır; ihtiyaç doğarsa ayrıca kararlaştırılır.
- Bunların dışındaki sapma için yol tanımlanmadı; kullanıcıya sorulacak.
