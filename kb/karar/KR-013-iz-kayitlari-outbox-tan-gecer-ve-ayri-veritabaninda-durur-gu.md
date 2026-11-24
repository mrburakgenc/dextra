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

## Kabulden önce kapanması gerekenler
Bağımsız inceleme (2026-11-24; çok oturumlu iş akışı, salt okuma): bu kararı bir oturum çürütmeye çalıştı, bulgularını ikinci bir oturum metne karşı tek tek sınadı. Hüküm: imzalamam: okuma kapısı ile outbox arasındaki çelişki, aktarımdan sonraki kayıp penceresi, unutmanın iz veritabanına ulaşma yolu ve hacim hesabı kapanmadan "kayıt kaybolmaz, asıl veritabanı şişmez, temizlik asıl işleri yavaşlatmaz" iddialarının hiçbiri belgeden gösterilemiyor; ilk kodlama adımını yalnız 1. bulgu bloke eder. Bulgu sayısı 12; ikinci oturumun çürütebildiği bulgu 0. "Doğrulandı" ya da "kısmen" denen bulgular aşağıdadır; ağırlıklar ikinci oturumun düzelttiği ağırlıklardır. Metinler kısaltılmıştır; hiçbir şey kodla sınanmadı. Ajan bulguları henüz tek tek işlemedi; "açık" yazan her satır bekliyor.

| # | Ağırlık | İlk kodlama adımını bekletir | Kullanıcı kararı ister | Bulgu | Önerilen düzeltme | Durum |
|---|---|---|---|---|---|---|
| 1 | ağır | evet | evet | Salt okuma `read` kapısından geçer ve işlem açmaz (KR-011 ölçüt 2: hedef 0; okuma testi), outbox'a ise yalnız `run` içinde yazılır (KR-012 Kural 2, KR-011 Yükümlülük 2); KR-013 buna rağmen her okuma isteğine bir outbox satırı yazdırır. … | KR-013'e "erişim kaydının yazımı" maddesi ekle: yazan parça (istek sonunda ortak kod), kapı (tek başına INSERT mi, `run` mı), istek kapsamlı toplayıcı ve yazılamazsa davranış (okuma reddedilir mi, kayıtsız mı döner); … | kapandı (kullanıcı, 2026-11-24; KR-011 Seçim 9): kayıt istek sonunda, cevaptan önce ortak kodca yazılır; yazılamazsa okuma reddedilir |
| 2 | orta | hayır | evet | "Kayıt kaybolmaz" ve "iş yazıldıysa değişiklik kaydı da yazılmıştır" yalnız outbox satırı için doğrudur: "aktarıldı" kuyruğa (Redis) konmak demektir ve satır 3 gün sonra, iz veritabanına yazılıp yazılmadığına bakılmadan silinir. … | İz için "aktarıldı"yı "iz veritabanına yazıldı" diye tanımla (outbox satırı tüketici onayından önce silinmez) ya da iz yolundan kuyruğu çıkar (aktarıcı iz satırlarını outbox kimliği tekil anahtarıyla doğrudan iz veritabanına … | açık |
| 3 | orta | hayır | evet | Unutmanın iz veritabanına nasıl uygulanacağı üç belgede birbirine havale edilmiş ve hiçbirinde yok: KR-012 "tasarlanmadı, projeye aittir" der, TS-002 "KR-012 ve KR-013'ün konusudur" der, KR-013 konuyu yalnız Bağlam'da anar ve açık diye bile yazmaz. … | Değişiklik kaydının biçimine şimdi bir veri sahibi kimliği alanı ekle ve unutmada değiştirilecek alanların ortak koda nasıl bildirileceğini yaz; … | açık |
| 4 | orta | hayır | evet | Kararda hacim hesabı yok; TS-001'in kendi aralığı (5000 kişi, saniyede 500–2500 istek, günde 43–216 milyon erişim kaydı; varsayım ve üst sınır) 3 gün kuralıyla çarpılınca asıl veritabanında sürekli 130–650 milyon aktarılmış outbox satırı durur ve her gün bir günlük kadarı asıl veritabanından silinir. … | Aritmetiği KR-013 "Varsayımlar"a yaz; 3 gün kuralını türe göre ayır (erişim kaydı satırı onaydan hemen sonra silinir ya da günlük bölümlenmiş ayrı tabloda durup bölüm düşürülerek temizlenir); … | açık |
| 5 | orta | hayır | hayır | TS-002'nin "KR-013'e işlenecek" dediği öneri (çekirdek yolun kaydı yetenek yerine yolun adını taşır; sır tablosu değer taşımaz) KR-013'e işlenmemiş: Yükümlülük 2–3 ve KR-010 Yükümlülük 10 hâlâ her kayıtta yetenek ve üyelik kimliği ister, oysa giriş, yenileme, çıkış ve bağlantıyla parola belirlemede yetenek yoktur. … | TS-002 satır 231'deki öneriyi KR-013 Seçim'e ve Yükümlülük 2–3'e işle; "değer taşımayan model" listesinin nerede tutulduğunu yaz; göç ve tohum yazımlarını ya iz yazan yardımcıdan geçir ya da İstisna yoluna adıyla ekle. | açık |
| 6 | orta | hayır | evet | KR-009 Kural 7–8 ve TS-002 "güvenlik olayı yazılır" der, ama güvenlik olayının ne olduğu ve nereye yazıldığı hiçbir kararda yok; KR-013 yalnız iki iz kaydı ile teknik günlüğü tanır ve kanonun üçüncü akışını (güvenlik olayı kaydı; başarısız giriş ve 403 oraya gider) ne alır ne "alınmayanlar"da sayar. … | Güvenlik olayını KR-013'te üçüncü kayıt türü olarak tanımla ya da açıkça iki izden birinin türü yap: hangi olaylar (başarısız giriş, reddedilen yazma, yeniden kullanım, adres değişti), hangi alanlar, reddedilen istekte hangi … | açık |
| 7 | orta | hayır | evet | "Değişiklik kaydını okumak kendi izni olan iştir ve yalnız SuperAdmin'e verilir" cümlesi yetki modelinde yazılamıyor: izin kaynak + eylemdir ve kaynak bir Prisma modelidir (KR-008), değişiklik kaydı ise kaynak değildir ve ona yalnız ortak altyapı kodu erişir (KR-010 Seçim 36, Yükümlülük 9); … | İznin biçimini seç ve yaz: iz kaydı iz şemasında bir kaynak mı olur (KR-010 Seçim 36 değişir), yoksa asıl şemadaki bir kaynağa bağlı niyet eylemi mi; okuma ucunun yerini ve erişim kaydı için aynı kuralı ekle. | açık |
| 8 | orta | hayır | evet | Bağlam kanonun denetim kaydını "değişmez tabloya" yazdığını söyler, ama Seçim değişmezliği ne alır ne "alınmayanlar"da sayar; kanon bunu dört katmanda zorunlu tutar ve satır silmeyi yasaklar (10 yıl, soğuk depo), KR-013 ise temizliği (satır silme) ve unutmayı (satır güncelleme) aynı tablolara getirir. … | KR-013'e değişmezlik için tek cümlelik seçim yaz: ya alınır (iz rolü yalnız ekler; temizlik ve unutma ayrı rolle yapılır) ya da alınmaz ve nedeniyle "alınmayanlar"a eklenir; … | açık |
| 9 | orta | hayır | evet | Erişim kaydının yolu için en güçlü seçenek listede yok: istek sonunda doğrudan iz veritabanına tek satır yazmak. Okumada birlikte yazılacak iş olmadığı için outbox'ın atomiklik kazancı yoktur ve kullanıcının gerekçesi ("Redis çökerse yük veritabanında kalsın") bu seçeneği seçilenden ayırmaz; … | Seçenekler'e "D — doğrudan iz veritabanına" satırını ve C'nin gerçek bedelini (yetki altında okunamaz, sorgulanamaz) ekle; günlük satırı ile erişim kaydının örtüşmesini yaz; … | açık |
| 10 | hafif | hayır | hayır | Karar bütünüyle çift yönlü sayılmış ve gerekçe yalnız yolun ortak kodda kalmasıdır; oysa neyin kayda geçtiği geri alınamaz: liste okumasında yazılmayan kayıt kimlikleri, veri sahibi alanı taşımayan değişiklik kayıtları ve günlüğe bir kez yazılmış değer sonradan üretilemez ya da silinemez, iz tabloları da veri göçü ister (TS-002 … | KR-012'deki gibi ayır: kaydın içeriği ve biçimi tek yönlü, taşıma yolu çift yönlü; "Ölçütler" bölümünü ekle (kaybolan iz sayısı 0, günlükte kişisel değer 0, okuma başına ek yazma sayısı, görünme gecikmesi eşiği). | açık |
| 11 | hafif | hayır | hayır | Kesinti testi yazıldığı gibi kurulamaz: ilk dilimde iz veritabanı asıl veritabanıyla aynı PostgreSQL kapsayıcısındadır, "iz veritabanı kapalıyken iş yazılır" durumu sunucu kapatılarak üretilemez. Bütünlük testindeki "görünür" bir süre eşiği taşımaz (gecikme ölçülmedi) ve izin testi okuma ucu ile izin tanımı olmadan yazılamaz. … | Kesinti testini "iz veritabanına bağlantı reddedilirken" diye yeniden yaz ve durumun nasıl üretileceğini belirt; bütünlük testine süre eşiği koy; sayılan yedi durumu Doğrulama'ya birer satır olarak ekle. | açık |
| 12 | hafif | hayır | hayır | "Her yazılan kayıt" ve "her okuma isteği" sınırsız yazılmış: harfiyen okunursa outbox satırı, tekrar kayıt tablosu ve iz satırının kendisi de yazılan kayıttır ve "sistem aktörünün yazmaları istisna değildir" cümlesiyle iz tüketicisinin yazması yeni bir değişiklik kaydı doğurur; … | Kapsamı adıyla yaz: kayıt üretmeyen altyapı tablolarının listesi, iz tüketicisinin ve temizlik işinin kimliği; Yükümlülük 3'ü "liste okumasında" diye daralt ve tek kayıt okumasını açıkça söyle; … | açık |

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
