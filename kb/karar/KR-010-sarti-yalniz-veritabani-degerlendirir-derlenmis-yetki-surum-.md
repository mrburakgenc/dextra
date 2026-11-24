---
kimlik: KR-010
tur: karar
durum: taslak
surum: 1
baslik: Veri kararını veritabanı verir, ekran CASL ile sorar; derlenmiş yetki sürüm damgasıyla saklanır
agirlik: cift-yonlu
tip: mimari
tarih: 2026-11-23
baglam: TS-001
---
Yetkinin çalışma anı için yetenek satırları kendi derleyicimizle CASL kurallarına derlenir; veri kararını sunucuda yalnız veritabanı verir, ekran aynı kuralları CASL ile değerlendirir ve derlenmiş yetki sürüm damgasıyla saklanır; silinen yetki bir sonraki istekte etkisizdir, karşılığında iki hesabın eşliği testle kanıtlanır ve her istek veritabanında küçük bir okuma yapar.

> Düzeltme (2026-11-24): Seçim 37 ve 38 değişti. İlk hâlleri "şartı yalnız veritabanı değerlendirir, bellekte ikinci değerlendirici yazılmaz" ve "yetki motoru kendi çeviricimizdir, CASL kullanılmaz" idi. Kullanıcı BADI'deki yapının korunmasını seçti: CASL kütüphanesi altta kap olarak kalır, üstünde bu deponun derleyicisi, dekoratörleri ve yetenek tabloları durur; ekran kuralları CASL ile değerlendirir. Dosya adı ilk başlıktan kalmadır. Aşağıda "ilk hâl" diye anılan satırlar bu düzeltmeden öncesine aittir.

> Bu taslak KR-008'den ayrıldı (kullanıcı, 2026-11-23): KR-008 veri modelini ve saklanan satırın anlamını bağlar, bu karar o modelin çalışma anında nasıl uygulandığını bağlar. Buradaki seçimler saklı veriyi değiştirmeden değişebilir; ağırlığı bu yüzden çift yönlüdür. Numaralar KR-008'in seçim numaralarıdır ve değişmez. Metni ajan yazdı; her madde kullanıcının 2026-11-23 seçimidir. İki çürütme turunun bulguları TS-001 "Çürütme" bölümündedir; bu belge ayrı hâliyle henüz bağımsız incelenmedi.

## Bağlam
- Kullanıcının ilkesi: önce kapatılır, sonra açılır; erişmesi için zaman harcanabilir, erişmemesi için değil.
- Kullanıcının ölçeği: tasarım büyük sistemlere uygun olmalıdır; aynı anda 1000, 2000, 5000 kişi performans denetimlerinin ve karmaşıklık değerlendirmesinin ölçüsüdür (ölçüm değil; saniyedeki istek sayısı bilinmiyor).
- Kullanıcı: Redis yığında zaten olacak (kuyruk); olay güdümlü tasarım ileride gelecek.
- BADI'de yetki önbelleği (koddan okundu, yalnız yapı): tek satırlı genel sürüm sayacı veritabanında durur ve 5 dosyada işlem içinde artırılır; önbelleği boşaltan olay 34 ayrı dosyadan yayılır; önbellek iki katmandır (süreç içi 5 dakika, Redis 15 dakika) ve saklanan kayıt bütünlük imzası taşır. Önbellek servisinin dosyasında sayaç geçmez; okuma anında karşılaştırıldığı görülmedi, bu yüzden oradaki yapı bu kararın emsali sayılmaz.
- Kütüphane belgeleri (okundu; bu depoda çalıştırılmadı): CASL'de izin kuralları "veya" ile birleşir ve alan izni tür adıyla sorulursa şarta bakılmaz; Prisma'da sorgu koşulunda değeri tanımsız olan anahtar atlanır; Prisma ORM 8'de şema bilgisi üretilen `contract.json` dosyasından okunur ve istemci API'si değişmiştir.
- Kanon (`kb/_gelen/IRON_RULES_BACKEND.md`): yetki motoru CASL'dir; repository `AbilityFactory` alır ve `accessibleBy` ile koşul ekler. Kanondaki uygun örnek (satır 285–301, okundu) kullanıcı süzgecini yetki koşulunun üstüne yayar, kolon listesini tür adıyla sorar, yetki koşulu yoksa boş koşula düşer ve sayım sorgusu süzgeci taşımaz.

## Ölçütler
Öneri (ajan); eşik sayıları belirlenmedi, ilk ölçüm taban çizgisi olur.
1. Geri alınan yetkinin etkisizleşmesi. Ölçü: üyelik ya da yetenek silindikten sonra erişimin sürdüğü iş birimi sayısı. Hedef: 0.
2. İstek başına yetki maliyeti. Ölçü: saklanan kayıt geçerliyken yetki için yapılan veritabanı okuması. Hedef: 1 (iki sürüm sayısı tek sorguda).
3. Veri kararının tek yerde verilmesi ve ekranın onunla eşliği. Ölçü: backend'de şartı bellekte değerlendiren kod; eşlik testi geçen işleç sayısının işleç sayısına oranı. Hedef: kod yok; oran 1.
4. Bozuk yeteneğin yayına ulaşmaması. Ölçü: yayın öncesi taramadan geçen, şemayla uyumsuz yetenek sayısı. Hedef: 0.
5. Yük. Ölçü: 1000, 2000 ve 5000 bağlı kişide yanıt süresi ve yetki yazımından sonraki derleme dalgası. Hedef: belirlenmedi.

## Seçenekler
### Derlenmiş yetkinin yeri
- A — Redis'te sürüm damgasıyla (seçildi).
- B — Her istekte veritabanından derleme: ajanın ilk önerisiydi; kullanıcı yük nedeniyle karşı çıktı ve ajan önerisini değiştirdi.
- C — Belirteç (token) içinde ve karalisteyle: kullanıcı sordu; reddedildi (belirtecin boyutu; bir yetenek değişince etkilenen herkesin belirtecini bulma gereği; karalisteye her istekte bakmanın zaten bir okuma olması).
- D — Süreç içinde (kişi, sürüm) anahtarlı kayıt: ikinci çürütme turunun eksik bulduğu seçenek; Redis yokken ve eşzamanlı isteklerde derlemeyi azaltır. Kararlaştırılmadı; ölçüme bırakıldı.
### Sürümün okunduğu yer
- A — Her iş biriminde veritabanından (seçildi): bayatlayabilecek kopya yoktur.
- B — Redis'teki kopyasından: veritabanına gidilmez; kopya güncellenemezse silinmiş yetki saklama süresi kadar yaşar. Geçiş saklı veriyi değiştirmez.
### Şartı değerlendiren
- C — Sunucuda yalnız veritabanı, ekranda CASL (seçildi, 2026-11-24): veri kararı tek yerde kalır; ekran düğmeyi sunucuya sormadan gösterir; iki hesabın eşliği testle kanıtlanır. Ayrışırsa düğme yanlış görünür ya da gizlenir, ama veri sızmaz, çünkü son sözü sunucu söyler.
- A — Yalnız veritabanı (ilk seçimdi, bırakıldı): ekran kayda özel izni sunucudan gelen listeden okur; liste sorgusuna iş başına ek sorgu ister.
- B — Sunucuda da veritabanı ve bellek: ayrışırsa yetkili kişi boş kayıt görür ya da kolon sızar.
### Motor
- B — CASL kap olarak, üstünde kendi derleyicimiz (seçildi, 2026-11-24; BADI'deki yapı): yetenek satırlarını kurala derleyen, yer tutucuları çözen ve şartı sorgu koşuluna çeviren katman bu deponundur; kuralları taşıyan ve ekranda soran parça kütüphanedir. Seçilen Prisma sürümüyle uyumu bu depoda denenmedi.
- A — Yalnız kendi çeviricimiz, kütüphane yok (ilk seçimdi, bırakıldı).
### Kişisiz iş ve sınır dışı okuma
- A — Sistem aktörü (seçildi).
- B — Yetki uygulamayan ayrı repository metotları: yanlışlıkla bir istekten çağrılırsa her şey açılır ve iz kalmaz.
### İz
- A — Yazmada kayıt başına değişiklik kaydı, okumada istek başına erişim kaydı (seçildi).
- B — Okumada da kayıt kayıt yetenek bilgisi: erişim kaydı sayfa boyutu kadar büyür ve yetenek başına ek sorgu her istekte atılır.

## Seçim
Hepsi kullanıcı seçimidir (2026-11-23; Seçim 37 ve 38 2026-11-24'te değişti).

Saklama ve sürüm:
23. Derlenmiş yetki Redis'te sürüm damgasıyla saklanır; belirteç yalnız kimliği taşır. Kullanıcı BADI'de benzerini kullandığını söyledi ("policycounter"). Oturumun geçerliliği (beyaz liste) ve yenileme düzeni oturum tasarımına aittir (KR-009).
24. Sürüm veritabanında durur, yetki yazmasıyla aynı işlemde artar ve her iş biriminde oradan okunur; Redis'teki bir kopyadan okunmaz (açıkça teyit edildi). Kullanıcının sözü: sürüme bakılırsa geçersiz kılındığı anda yetki değişimi hemen oturur. İsteğin bu okumasında oturum satırı da okunur; oturumun açık olup olmadığı, IP ve tarayıcı bilgisi oradan denetlenir (KR-009 Seçim 1 ve 8, 2026-11-23; okumanın biçimi tasarlanmadı).
32. Sürüm iki sayıdır: yetenek, rol, grup ağacı ve izin kataloğu değişimi genel sayacı; üyelik yazımı yalnız o kişinin sayısını artırır. Saklanan kayıt ikisi de aynıysa geçerlidir. Neden: kullanıcı açılışı seyrek değildir ve genel sayacı artırırsa her yeni kullanıcı herkesi yeniden derletir.

Değerlendirme ve motor:
37. Veri kararını sunucuda yalnız veritabanı verir: hangi kaydın okunacağı ve yazılacağı sorgunun içindeki şartla belirlenir ve backend'de şartı bellekte değerlendiren kod yazılmaz. Ekran aynı kuralları CASL ile değerlendirir ve yalnız neyin gösterileceğine karar verir (`<Can>`: tür, kayıt ve alan düzeyi); son sözü her zaman sunucu söyler. Kullanıcı (2026-11-24): "orası da BADI'deki yapı gibi olsun". İlk hâli "bellekte ikinci bir değerlendirici yazılmaz" idi ve ekranı da kapsıyordu. Yazmada sorgu şartı taşır (kaydın eski hâli tutmuyorsa hiçbir satır değişmez) ve aynı işlem içinde kayıt şartla yeniden okunur (yeni hâli tutmuyorsa Unit of Work geri alır). Niyet eyleminde yeniden okuma adımı yoktur; şart yalnız önceki hâle bakar (KR-008 Seçim 42). Listede eşleşen yeteneklerin kolon kümeleri aynıysa ek iş yoktur; farklıysa sayfadaki kayıtların hangisini hangi yeteneğin tuttuğu yetenek başına bir sorguyla sorulur.
38. Yetki motoru iki katmandır (BADI'deki yapı): altta CASL kütüphanesi kuralları taşır, sunucuda sorguya koşul ekler ve ekranda `<Can>` bileşenini verir; üstte bu deponun katmanı durur — yetenek satırlarını CASL kuralına derleyen derleyici, yer tutucuları gerçek kimliklere çeviren adım, şartı sorgu koşuluna ve ekranın biçimine çeviren çevirici, dekoratörler ve guard. Kullanıcı (2026-11-23): "BADI'de de dekoratörleri buna göre yazmıştık"; ajan bunu o gün "kütüphane de çıkar" diye kaydetmişti, kullanıcı 2026-11-24'te düzeltti: "CASL bizde nasıl yok; direkt kütüphane değil de yapı benzerdi; orası da BADI'deki yapı gibi olsun".
   - Bu depoya özgü kurallar kütüphanenin üstünde korunur: yetenek satırları birleştirilmez (KR-008 Seçim 3); alan izni tür adıyla değil kayıt örneğiyle sorulur, aksi hâlde bir üyeliğin kolonu öbürünün kaydında görünür; yazma yetenek yetenek denetlenir.
   - Eşlik: şartın sekiz işleci için aynı şart ve aynı kayıt, veritabanında ve ekranda aynı cevabı vermek zorundadır; bu bir sözleşme testiyle kanıtlanır (BADI'de karşılığı: Prisma koşulunu CASL biçimine çeviren çevirici ve dondurulmuş işleç sözleşmesi).
   - Açık (tasarlanmadı): şartın baktığı alan kullanıcının göremediği bir kolonsa ekranın ne yapacağı; ilişki üzerinden bakan şartın ekranda nasıl değerlendirileceği; yetki sürümü değişince ekrandaki kuralların nasıl yenileneceği; kolon indiriminin sunucuda kütüphaneyle mi yoksa yetenek başına sorguyla mı yapılacağı; kütüphanenin Prisma 7 ve ESM ile uyumu.
26. Yazma isteği ya hep ya hiçtir: yetki herhangi bir adımda tutmazsa Unit of Work bütün isteği geri alır, kısmi yazma olmaz. Liste okumada istek reddedilmez; şart kayıtları, kolon sınırı kolonları süzer (teyit edildi).

Kişisiz çalışma:
25. İsteği yapan kişi olmadan çalışan iş (zamanlanmış iş, olay tüketicisi) sistem aktörüyle çalışır: aktör sistem satırı olan özel bir kullanıcıdır, üyeliği ve yetenek satırları vardır, erişimi öbür kullanıcılar gibi izlenir. Kodda yetkiyi atlayan dal olmaz; yeteneği unutulan iş çalışmaz.
36. İş kuralı denetimi isteği yapanın sınırının dışını okumak zorundaysa o okuma adıyla sistem aktörü olarak yapılır; okunan veri kullanıcıya döndürülmez. Tekillik için veritabanı kısıtı son güvence olarak kalır. Altyapı tabloları (outbox, erişim kaydı, değişiklik kaydı, oturum, sürüm sayıları) kaynak değildir; onlara yalnız ortak altyapı kodu erişir (teyit edildi).

İz:
40. İz iki kayıttır. Yazmada her yazılan kayıt için bir değişiklik kaydı tutulur: kim, hangi üyelik ve yetenekle, hangi iş, hangi kayıt; güncellemede değişen kolonların eski ve yeni değeri, oluşturmada yeni hâlin tamamı, silmede eski hâlin tamamı. Okumada istek başına tek erişim kaydı tutulur ve o istekte kullanılan yeteneklerin ve üyeliklerin kimliklerini taşır; liste içinde "şu tek kaydı hangi yetenek getirdi" bilgisi tutulmaz. Kullanıcının sözü: "x satırının önceki hâli bu, sonraki hâli bu". Açık (kullanıcının kararı; ajan gizleme önermedi): değişiklik kaydı kişisel veri içerir; saklama süresi ve onu kimin okuyabileceği belirlenmedi.

İkinci çürütme turundan çıkan kurallar (ajan önerisi; kullanıcı 2026-11-23'te teyit etti; hiçbiri denenmedi, her biri kodda bir sınamayla gösterilecek):
- Saklanan yetki kaydı şemanın sürümünü de taşır; şemayı değiştiren yayından sonra eski kayıtlar kendiliğinden geçersiz olur.
- Derlemede sürüm ve yetki verisi tek anlık görüntüde okunur.
- Yetki tablolarına yazan her işlem önce genel sayaç satırını kilitler; son SuperAdmin, döngü, tek kök ve boş birim denetimleri ile üyelik ve yetenek yazımında grubun ve rolün canlı olduğu denetimi o kilit altında yapılır. Kişinin sayısı kilit olarak kullanılmaz: üyelik yazımı genel sayaç satırını kilitler ama artırmaz, kişinin sayısını artırır (Seçim 32). Pasife alma komutu da bu kilidi alır. "Kullanıcı aç" ve yeniden açma komutlarının kök üyelik yazımı kilit almaz; kök grup ve temel rol sistem satırıdır ve korunacak bir değişmez yoktur. Bedel: yetki yazımları sırayla işlenir (ölçülmedi). Reddedilen: veritabanının çakışmayı yakalayıp işlemi geri çevirmesi (her yazma yolu yeniden deneme kodu ister). Bu ayrıntı üçüncü çürütme turunun 2. bulgusu üzerine ajanın önerisidir; kullanıcı 2026-11-23'te teyit etti.
- Sürümü artırmadan yetki tablosuna yazan yol yoktur; tohum göçü ve izin kataloğu değişikliği de artırır; birim taşıma da artırır.
- İstek içindeki yetki belleği "kim adına" ve "hangi sürüm" bilgisiyle anahtarlanır.
- Sürüm iş birimi başına okunur; uzun süren iş her iş biriminde yeniden bakar.
- Veritabanı yedekten geri yüklenirse Redis'teki yetki kayıtları temizlenir (geri yükleme yordamı).
- Tarama yayın öncesi kapıdır: yeni sürümün şeması canlı yetenek verisiyle karşılaştırılır.
- Derleme ve tarama adın yanında işleç, tip ve sabit değer uyumunu da denetler; uymayan yetenek derlenmez ve bildirilir. Kolon dizisindeki bilinmeyen ad atlanır (sınır daralır); şarttaki bilinmeyen ad yeteneği derlenmez kılar (yaprağı atmak sınırı genişletir). Yer tutucu çözülemez ya da boş çözülürse yetenek derlenmez.
- Yazma denetimi yetenek yetenek yapılır; yazma sorgusu yalnız seçilen tek yeteneğin şartını taşır.
- Toplu yazmada etkilenen satır sayısı beklenenden azsa bütün işlem geri alınır.
- Türetilmiş alan ancak kaynak kolonlarının hepsi görünüyorsa döner; feature içinde ham SQL ile okuma yapılmaz.
- Kullanıcının süzgeci ya da sıralaması ilişki üzerinden başka kaynağın kolonuna bakıyorsa o kaynağın yeteneğiyle sınanır; süzme, sıralama ve sayım görünmeyen kolonu ele vermez ve kullanıcı süzgeci yetki koşuluyla "ve" ile birleşir.

Ertelenenler (kullanıcı teyidi) ve karar yeri: saklanan kaydın bütünlük imzası ve sürümün kodda artırılacağı tek yer (uygulama planı); sistem aktörünün tek mi iş türü başına mı olacağı ve olay tüketicisinin kimin adına çalışacağı (olaylar kümesi); iz kayıtlarının nerede tutulacağı ve saklama süresi (gözlemlenebilirlik kümesi); süreç içi kayıt (yürüyen iskelette ölçümden sonra).

Kabul edilen risk (kullanıcı): yetenek, rol ya da ağaç değişince bağlı herkes bir kez yeniden derler (derleme dalgası); bu değişim her zaman olan bir şey değildir, süreç gerekirse sonradan iyileştirilir.

## Sonuçlar
- Olumlu: silinen yetki bir sonraki istekte etkisizdir; veri kararı tek yerde verilir; ekran sunucuya sormadan yalnız yapılabilecek işi gösterir; yapı BADI ile aynıdır ve kanondaki frontend kuralları alınabilir; kodda yetkiyi atlayan yol yoktur; her yazma tek bir yeteneğe bağlı olarak kayda geçer.
- Olumsuz: şart iki yerde hesaplanır ve eşliği testle kanıtlanmak zorundadır; her istek veritabanına küçük bir okuma yapar; farklı kolon kümeli çok üyelikli kişinin listesinde yetenek başına ek sorgu atılır; üst katmanın bakımı ve testi bu depodadır; kütüphanenin sürümü Prisma ve derleme düzeniyle uyumlu kalmak zorundadır; her feature'ın sistem aktörüne yetenek tohumlanır; okuma başına bir erişim kaydı yazılır.
- Yükümlülük (kural adayları; taslakları açılacak):
  1. Sunucuda veri kararını yalnız veritabanı verir; backend'de şartı bellekte değerlendiren kod yazılmaz. Ekran kuralları CASL ile değerlendirir ve yalnız gösterime karar verir.
  13. Aynı şart ve aynı kayıt veritabanında ve ekranda aynı cevabı verir; her işleç için sözleşme testi vardır.
  14. Alan izni kayıt örneğiyle sorulur; tür adıyla sorulan alan izni veri kararında kullanılmaz.
  2. Yetki tablosuna yazan her işlem doğru sürümü aynı işlemde artırır ve önce genel sayaç satırını kilitler; tek istisna "kullanıcı aç" ve yeniden açma komutlarının kök üyelik yazımıdır.
  3. Sürüm her iş biriminde veritabanından okunur; saklanan kayıt şema sürümünü taşır.
  4. Şemayla uyumsuz ya da yer tutucusu çözülemeyen yetenek derlenmez ve bildirilir.
  5. Kullanıcı süzgeci yetki koşuluyla "ve" ile birleşir; süzme, sıralama ve sayım görünmeyen kolonu ele vermez.
  6. Yazma yetenek yetenek denetlenir, şartlı yazılır, aynı işlemde yeniden okunur; etkilenen satır eksikse geri alınır.
  7. Kişisiz iş ve sınır dışı kural okuması sistem aktörüyle yapılır; yetkiyi atlayan repository yolu yoktur.
  8. İstek içindeki yetki belleği "kim adına" ve "hangi sürüm" ile anahtarlanır.
  9. Altyapı tabloları kaynak değildir; yalnız ortak altyapı kodu erişir.
  10. Her yazılan kayıt için değişiklik kaydı, her okuma isteği için erişim kaydı tutulur; ikisi de yetenek ve üyelik kimliğini taşır.
  11. Feature içinde ham SQL ile okuma yapılmaz; türetilmiş alan kaynak kolonlarının hepsi görünürse döner.
  12. Yayından önce yeni sürümün şeması canlı yetenek verisiyle taranır.
- Ortak parça: `shared` altında yetenek derleyici, şart çevirici, repository'nin okuma ve yazma kapısı; adları ve sınırları tasarlanmadı.

## Doğrulama
Denetim kimliği ve ölçüm tarihi henüz yok; kod yazılmadı.
Öneri (ajan). Birim: uç ve çağrı.
- Geri alma: üyelik ya da yetenek silindikten sonraki ilk iş birimi yeni yetkiyle çalışır.
- Sorgu sayısı: saklanan kayıt geçerliyken liste isteğinde yetki için tek veritabanı okuması yapılır; kayıt sayısı artınca artmaz.
- Sürüm: yetki tablosuna yazan her yol doğru sayıyı artırır; artırmadan yazan yol yoktur.
- Yayın: şeması değişen sürümde eski saklanan kayıt kullanılmaz; uyumsuz yetenek tarama kapısında yakalanır.
- Yazma: önceki hâli bir yeteneğin, sonraki hâli başka bir yeteneğin tuttuğu güncelleme reddedilir; toplu yazmada araya giren değişiklik bütün işlemi geri aldırır.
- Sistem aktörü: yeteneği olmayan iş çalışmaz; bir istek içinde başka aktör adına yapılan okuma ilk aktörün yetkisiyle koşmaz.
- İz: her yazma bir değişiklik kaydı, her okuma isteği bir erişim kaydı üretir.
- Eşlik: sekiz işlecin her biri için aynı şart ve aynı kayıt, veritabanı sorgusunda ve ekrandaki CASL değerlendirmesinde aynı sonucu verir.
- Ekran ile sunucu ayrışması: ekran bir düğmeyi yanlışlıkla gösterse bile sunucu yetkisiz işi reddeder.
- Yük: TS-001 "Performans mantığı"ndaki derleme ve yük sınamaları.

## Varsayımlar
- Redis yığında bulunur; kullanıcı beyanı, kurulumda kesinleşecek; varsayım, 2026-12-21.
- Çeviricinin boyutu küçüktür (sekiz işleç, üç yer tutucu, tek adım ilişki); yazılmadı; varsayım, 2026-12-21.
- CASL kütüphanesi (çekirdeği, Prisma ve React paketleri) Prisma 7, ESM ve seçilen Next.js sürümüyle çalışır; BADI'de Prisma 7 ile kullanıldığı görüldü, bu depoda denenmedi; varsayım: yürüyen iskelette denenir, 2026-12-21.
- İki sürüm sayısı tek sorguda okunabilir ve bu okumanın maliyeti kabul edilebilir; denenmedi; varsayım, 2026-12-21'e kadar yürüyen iskelette bakılacak.
- Derleme iki ya da üç sorgudur (üyelikler, canlı yetenekler, ağaç açılımı); denenmedi; varsayım, 2026-12-21.
- Prisma ana sürümü seçilmedi (KR-004); şema bilgisinin okunma yolu ve özyinelemeli sorgunun yazılışı sürüme bağlıdır; varsayım: sürüm seçilirken denenir, 2026-12-21.
- Saklanan kaydın boyutu kişinin yetenek sayısı ve alt ağaç listeleriyle büyür; alt ağaç listesinin kayıtta bir kez durması öngörülür; tasarlanmadı; varsayım, 2026-12-21.
- İz kayıtlarının hacmi (okuma isteği başına bir kayıt) taşınabilir bir yerde tutulur; yeri kararlaştırılmadı; varsayım: gözlemlenebilirlik kümesinde çözülür, 2026-12-21.

## Geri dönüş
- Her seçim saklı yetki verisini değiştirmeden geri alınabilir: Redis'ten her istekte derlemeye; veritabanındaki sürümden Redis kopyasına; ekrandaki CASL değerlendirmesinden sunucunun söylediği listeye (ekran bileşeninin içi ve liste sorguları değişir); kütüphaneden yalnız kendi çeviricimize (repository kapısının ve ekran bileşeninin arkası değişir).
- İzin biçimini değiştirmek geçmiş kayıtları etkilemez; yeni kayıtlar yeni biçimde yazılır.
- Yeniden bakma tetiği (eşik sayıları belirlenmedi): tek satırlık sürüm okuması ya da derleme dalgası yürüyen iskelette sorun çıkarırsa; erişim kaydının hacmi taşınamazsa.

## İstisna yolu
- Redis'e ulaşılamazsa yetki veritabanından derlenir (doğruluk kaynağı veritabanıdır); bu yol kişili istekler için de geçerlidir ve derlenen yetki sunucunun belleğinde kısa süre tutulur; bellekteki kayıt da sürüm damgasıyla doğrulanır (KR-009 Seçim 5; kullanıcı, 2026-11-24). Sunucu belleğindeki yetki kaydı yalnız Redis yokken değil, her zaman ilk bakılan yerdir; Redis ikinci, veritabanı üçüncü sıradadır (öneri ajan; kullanıcı teyidi, 2026-11-24). Neden: yalnız arıza anında çalışan yol nadiren denenir; her zaman çalışan yol her gün sınanır. Bedel: her sunucu etkin kullanıcıların yetki kaydını belleğinde tutar (boyutu ölçülmedi).
- İz kayıtlarının yeri 2026-11-24'te kararlaştırıldı: değişiklik ve erişim kayıtları outbox üzerinden ayrı bir iz veritabanına yazılır ve liste okumasında kayıt kimlikleri yazılmaz (KR-013). Sistem aktörünün sayısı ve tüketicinin kimliği de kapandı (KR-012 Seçim 2 ve 3).
- Yetki tablosuna elle SQL ile yazıldıysa ilgili sürüm elle artırılır; yordamı yazılacak.
- Veritabanı yedekten geri yüklenirse Redis'teki yetki kayıtları temizlenir.
- Feature içinde ham SQL ile okuma gerekiyorsa izinli kimlikler önce yetki kapısından alınır; başka yol tanımlanmadı, kullanıcıya sorulur.
