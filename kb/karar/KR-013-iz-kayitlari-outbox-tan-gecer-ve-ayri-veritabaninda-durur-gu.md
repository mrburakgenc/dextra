---
kimlik: KR-013
tur: karar
durum: taslak
surum: 1
baslik: İz kayıtları outbox'tan geçer ve ayrı veritabanında durur; günlük kişisel veri taşımaz
agirlik: cift-yonlu
tip: mimari
tarih: 2026-11-24
baglam: TS-001
---
İz için değişiklik ve erişim kayıtları outbox'a yazılır ve bir tüketici onları ayrı bir iz veritabanına taşır, teknik günlük ise kişisel verinin değerini taşımaz; kayıt kaybolmaz, geçmiş asıl veritabanını şişirmez ve temizlik asıl işleri yavaşlatmaz, karşılığında her okuma asıl veritabanına bir outbox satırı yazar, kayıt gecikmeyle görünür ve ikinci bir veritabanı işletilir.

> Bu taslak kullanıcının 2026-11-24 seçimlerinden derlendi; metni ajan yazdı. Konuşma TS-001 "Çürütme" bölümünün sonundaki kapanış satırlarındadır. Ağırlık çift yönlüdür: izin yolu ortak kodun içinde kalır, feature'lar onu görmez. Bağımsız inceleme yapılmadı ve kod yoktur.

## Bağlam
- KR-010 Seçim 40: iz iki kayıttır — yazmada her yazılan kayıt için değişiklik kaydı (kim, hangi üyelik ve yetenekle, hangi kayıt; değişen kolonların eski ve yeni değeri), okumada istek başına tek erişim kaydı. Kayıtların nereye yazılacağı ve ne kadar saklanacağı bu kümeye ertelenmişti.
- Kullanıcının 2026-11-17 talimatı: uygulamada maskeleme ve gizleme yoktur; ajan bunu kendiliğinden eklemez, sorar.
- Kanon günlükte ve cevapta kişisel verinin maskelenmesini ister (TS-001 "Kanon harmanı" Ç6) ve denetim kaydını ayrı bir kuyruk üzerinden değişmez bir tabloya yazar (`ARCHITECTURE.md` satır 541).
- Kullanıcı (2026-11-24): amaç günlüklerde ne yapıldığını ve hangi veriye dokunulduğunu görmektir; kişisel veri gerekiyorsa kullanıcı kimliğinden gidilir. Kayıt defteri asıl veritabanını şişirmemeli ve sistemi anlık yormamalıdır.
- Bağlı kararlar: kuyruğa giden her şey outbox'tan geçer ve her tüketicinin kendi kuyruğu vardır (KR-012); silme talebi değişiklik kayıtlarına da uygulanır (KR-012 Seçim 4); altyapı tabloları kaynak değildir (KR-010 Seçim 36); Redis yokken istekler çalışmaya devam eder ve kuyruğa gidecekler outbox'ta bekler (KR-009 Seçim 5).

## Seçenekler
### Teknik günlükte kişisel veri
- A — Değeri hiç yazılmaz, yalnız kimlikler yazılır (seçildi).
- B — Ham veri yazılır: günlükler kişisel veri deposuna dönüşür ve silme talebi onlara ulaşamaz.
- C — Maskelenerek yazılır (kanon): hangi alanın nasıl kapatılacağı tek tek yazılır.
### Liste okumasında erişim kaydı
- A — Dönen kayıtların kimlikleri de yazılır (ajanın önerisiydi): "bu kaydı kim gördü" sorusu doğrudan cevaplanır; kayıt büyür.
- B — Yalnız erişilen yer ve kayıt sayısı yazılır (seçildi).
### Değişiklik kaydının yolu
- A — İşle aynı işlemde doğrudan kendi tablosuna: en az parça; asıl veritabanı geçmişle büyür.
- B — İşle aynı işlemde outbox'a, oradan ayrı depoya (seçildi; kanondaki denetim kuyruğu).
- C — Diske: iş geri alınsa da satır kalır ya da iş yazılır ama satır yazılamaz; yetki altında okunamaz.
### Erişim kaydının yolu
- A — Doğrudan kuyruğa (ajanın önerisiydi): asıl veritabanına yük binmez; "kuyruğa doğrudan yazılmaz" kuralına istisna ister ve kayıt nadiren kaybolabilir.
- B — Outbox üzerinden (seçildi).
- C — Diske: asıl veritabanına yük binmez; kayıtlar dosyada kalır.

## Seçim
Kullanıcı seçimleri (2026-11-24):
1. Teknik günlüğe kişisel verinin değeri ve istek gövdesi yazılmaz; maskeleme kodu da yazılmaz. Günlük satırı zamanı, istek kimliğini, kullanıcı ve oturum kimliğini, işin adını, kaynağı ve kayıt kimliğini, sonucu ve süreyi taşır. Alanın değerini görmek isteyen istek kimliğinden değişiklik kaydına gider. Parola, token ve gizli anahtar hiçbir yere yazılmaz.
2. Okumada hangi kayıtların döndüğü yazılmaz; nereye erişildiği ve kaç kayıt okunduğu yazılır. Dışa aktarma gibi bir işlem tetiklenirse o işlem ayrıca kayda alınır. Kullanıcının gerekçesi: kişinin hangi kayıtları okuyabildiği erişim kaydındaki yeteneğin ayrıntısından bulunabilir.
3. Değişiklik kaydı işle aynı işlemde outbox'a yazılır ve bir tüketici onu ayrı bir veritabanına (iz veritabanı) taşır. Ayrı veritabanı kullanıcının fikridir: istenmeyen tarihler orada temizlenir ve temizlik asıl işleri yavaşlatmaz.
4. Erişim kaydı da outbox üzerinden gider ve son durağı iz veritabanıdır. Kullanıcının gerekçesi: Redis çökerse yük veritabanı ve outbox üzerinde kalsın.
5. Aktarılan outbox satırı 3 gün sonra silinir. Ajanın önerisi hemen silmekti; kanonda süre 30 gündür.

Ajan önerileri — kullanıcı teyit etti (2026-11-24):
- İz veritabanı ilk dilimde aynı PostgreSQL sunucusunda ayrı bir veritabanı olarak kurulur; ayrı sunucuya taşımak sonradan ayar işidir.
- İz kayıtlarının saklama süresi base'de sabit bir sayı değildir; proje ayarıdır ve ayar verilmemişse temizlik yapılmaz.
- Değişiklik kaydını okumak kendi izni olan ayrı bir iştir ve başlangıçta yalnız SuperAdmin'e verilir; kalıcı cevabı kullanıcı verecektir.

Kanondan alınmayanlar (kullanıcı talimatı ve bugünkü seçimler gereği): cevapta ve ekranda maskeleme (veri olduğu gibi gösterilir, görünürlüğü yalnız kolon sınırı belirler; KR-008 Seçim 21); günlükte maskeleme.

Bilinen sınırlar:
- Yetenekten çıkarılan şey kişinin o gün görebileceği kayıtlardır, gerçekten açtığı sayfa değil; veri sonradan değiştiyse çıkarım yaklaşık kalır.
- "Günlüğe istek gövdesi yazılmaz" kuralı makineyle tam denetlenemez; incelemeye kalır.
- Bekleyen kayıtlar çoğunlukla outbox'ta değil kuyrukta birikir; iz veritabanı uzun süre kapalı kalırsa kuyruk büyür.

Neyden vazgeçildi: hata ayıklarken değeri günlükte görmek; "bu kaydı kim gördü" sorusunun doğrudan cevabı; değişiklik kaydının yazıldığı anda görünmesi; okumaların asıl veritabanına hiç yazmaması.

## Sonuçlar
- Olumlu: iş yazıldıysa değişiklik kaydı da yazılmıştır; geçmiş asıl veritabanında birikmez; temizlik ve bakım asıl işleri yavaşlatmaz; günlük dosyaları kişisel veri taşımaz ve silme talebinin onlara ulaşması gerekmez; iz yolu olaylarla aynı altyapıyı kullanır.
- Olumsuz: her okuma isteği asıl veritabanına bir outbox satırı yazar ve o satır 3 gün durur (ölçülmedi); kayıt kısa bir gecikmeyle görünür; ikinci bir veritabanının şeması ve göçleri olur; liste okumasında hangi kayıtların görüldüğü yalnız çıkarımla bulunur.
- Yükümlülük (kural adayları; taslakları açılacak):
  1. Teknik günlüğe istek gövdesi ve kişisel alanın değeri yazılmaz; parola, token ve gizli anahtar hiçbir yere yazılmaz.
  2. Her yazılan kayıt için değişiklik kaydı, işle aynı işlemde outbox'a yazılır.
  3. Her okuma isteği için bir erişim kaydı outbox'a yazılır; erişilen yeri, kayıt sayısını ve kullanılan yetenek ile üyelik kimliklerini taşır, kayıt kimliklerini taşımaz.
  4. Dışa aktarma kendi kaydını yazar.
  5. İz veritabanına yalnız ortak altyapı kodu yazar; değişiklik kaydını okumak kendi iznini ister.
  6. Aktarılan outbox satırı 3 gün sonra silinir; aktarılmamış satır silinmez.
- Ortak parça: `shared/observability` altında günlük yazıcı, iz kaydı kurucu ve iz tüketicisi; adları ve sınırları tasarlanmadı.

## Doğrulama
Denetim kimliği ve ölçüm tarihi henüz yok; kod yazılmadı.
Öneri (ajan). Birim: çağrı.
- Günlük testi: kişisel alan taşıyan bir istekten sonra günlük çıktısında o alanların değeri yoktur, istek ve kayıt kimlikleri vardır.
- Bütünlük testi: iş geri alınırsa değişiklik kaydı oluşmaz; iş yazılırsa kayıt iz veritabanında görünür.
- Erişim testi: liste isteğinden sonra erişilen yeri, sayıyı ve yetenek kimliğini taşıyan bir kayıt oluşur ve kayıt kimliği taşımaz.
- Temizlik testi: 3 günden eski aktarılmış outbox satırı silinir; aktarılmamış satır yaşına bakılmadan kalır.
- İzin testi: değişiklik kaydını okuma izni olmayan kişi okuyamaz.
- Kesinti testi: iz veritabanı kapalıyken iş yazılır ve kayıtlar bekler; açılınca yerine ulaşır.

## Varsayımlar
- Okuma başına bir outbox satırı yazmanın yükü taşınabilir; saniyedeki istek sayısı bilinmiyor; varsayım: yürüyen iskelette yük sınamasıyla ölçülür, 2026-12-21.
- Tek uygulama iki veritabanını (asıl ve iz) Prisma 7 ile yönetebilir; denenmedi; varsayım, 2026-12-21.
- Kaydın görünme gecikmesi kabul edilebilir düzeydedir; ölçülmedi; varsayım, 2026-12-21.

## Geri dönüş
- İz yolunu değiştirmek (doğrudan tabloya, doğrudan kuyruğa ya da diske) ortak kodun içinde kalır; feature kodu değişmez (öngörü; denenmedi).
- Günlük kuralını gevşetmek kolaydır; sıkılaştırmak yazılmış günlük çağrılarının taranmasını ister.
- Yeniden bakma tetiği (öneri, ajan; eşik belirlenmedi): okuma başına outbox yazması yük sınamasında taşınamazsa; "bu kaydı kim gördü" sorusu gerçek bir ihtiyaç olarak gelirse.

## İstisna yolu
- Kimlik gerektirmeyen uçlar (örneğin sağlık denetimi) erişim kaydı yazmaz.
- Sistem aktörünün okumaları ve yazmaları da kayda geçer; istisna değildir (KR-010 Seçim 25).
- Bunların dışındaki sapma için yol tanımlanmadı; kullanıcıya sorulacak.
