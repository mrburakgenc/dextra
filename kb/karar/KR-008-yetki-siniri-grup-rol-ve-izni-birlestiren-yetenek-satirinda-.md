---
kimlik: KR-008
tur: karar
durum: taslak
surum: 1
baslik: Yetki sınırı grup, rol ve izni birleştiren yetenek satırında durur
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-22
baglam: TS-001
---
Yetki veri modeli için grup, rol ve izin sade tutulur ve sınır (hangi kayıtlar, hangi kolonlar) bu üçünü birleştiren bağımsız yetenek satırına yazılır; rol sayısı birim sayısıyla çoğalmaz ve her yetenek kendi kimliğiyle izlenir, karşılığında her birim kendi satırlarını taşır: yeni birim sıfır yetenekle doğar ve ortak bir yetenek her birim için ayrı yazılır.

> Ezilme notu (2026-11-25; KR-016 ve TS-008 kullanıcı tarafından kabul edildiğinde geçerlidir): Seçim 3'ün "satırlar birbirini ezmez" cümlesi yasak için geçersizdir (yasak, kendisinden yüksek öncelikli olmayan izni kapatır; izinler birbirini yine ezmez). Seçim 9 (öncelik ve etkinin ertelenmesi) ezildi: ikisi KR-016 ile eklenir. Seçim 30'daki "sistem satırı yanına yazılarak daraltılır" yolu kök yönetici rolünün sistem satırları için geçersizdir (yasaktan muaftır); Seçim 17'ye "yasak ve öncelik yazmak ayrı izin ister" eklenir. Seçim 5, 11 ve 44 ile ilişkisi TS-008 "Aşamalar" 0. adımdadır ve uygulama görevlerinde kesinleşir.

> Bu taslak kullanıcının 2026-11-21, 22 ve 23 seçimlerinden derlendi; metni ajan yazdı. Konuşmanın tamamı TS-001 "Veri modeli" bölümündedir. Seçim numaraları sabittir; başka belgeler onlara gönderme yapar. Bu karar veri modelini ve saklanan satırın anlamını bağlar; derleme, saklama, sürüm, motor ve iz KR-010'dadır (kullanıcı 2026-11-23'te ikiye bölünmesini seçti) ve oraya taşınan numaralar burada tek satırla durur.

> Durum: iki bağımsız çürütme turu koştu (2026-11-22 ve 2026-11-23); ikisi de o günkü hâli imzalamadı. İkinci turun on maddesi kullanıcıyla kapatıldı (Seçim 30–41 ve "İkinci çürütme turundan çıkan kurallar") ve belge 2026-11-23'te anlamı değiştirilmeden yeniden düzenlendi. Düzenlenmiş hâli üçüncü turda incelendi (2026-11-23) ve yine imzalanmadı: 25 bulgu, dördü ağır. Dört ağır bulgu kullanıcıyla kapatıldı (Seçim 35'teki düzeltme, Seçim 42 ve 43, KR-010'daki kilit kuralı); orta ve hafif bulgular açıktır, kural taslakları açılmadı ve çalışan bir denetim yoktur; kabule hazır değildir. Bulguların tamamı TS-001 "Çürütme" bölümündedir.

## Bağlam
- KR-007 yetkinin nerede çözüldüğünü söyler (repository'de); veri modelini bu karara bırakır.
- Kullanıcının amacı: aynı rol farklı birimde farklı izin ve farklı sınır alır; sınır satır ve kolon düzeyinde yazılır; grup, rol ve izin tabloları sade kalır; bir erişimin hangi yetenekle yapıldığı kimliğinden izlenir.
- Kullanıcı (2026-11-22): RBAC'a gidilmeyecek. Grup ve rol isteği yapanın nitelikleridir; rol, yetenek satırı olmadan tek başına izin vermez.
- Kullanıcının ilkesi (2026-11-23): önce kapatılır, sonra açılır; tanım yanlış ya da eksikse erişim kapalı kalır; erişmesi için zaman harcanabilir, erişmemesi için değil.
- BADI'den okunanlar (yalnız yapı ve ders, kod alınmadı; inceleyen oturumlar bunları ayrıca doğrulamadı):
  - Şemadan okundu: rol–izin bağı grup taşımaz; şart iki katmandır; hiçbir kapının bakmadığı bir kolon tabloda durur.
  - Koddan okundu: şart iç içe ağaçtır (derinlik en çok 4, boyut en çok 8 KB); alan kataloğu 60.983 satırlık sabit dosyasıdır; boş kolon listesinde kurala alan kısıtı yazılmaz; kurallar önceliğe göre sıralanır.
  - Koddaki yorumdan okundu (davranışa bakılmadı): öncelik sıralaması bir kez ters yazılmış; grup ayrımı için kural üyelik başına çoğaltılır.
  - Tuzak kaydından okundu (T-0324): var olmayan alana bakan şart ancak çalışma anında patlamış.

## Ölçütler
Kullanıcıdan sayısal ölçüt gelmedi; ilke ve ölçek geldi. Öneri (ajan):
1. Yeni bir grup + rol kümesine yetki tanımlamak kod değişikliği gerektirmez. Ölçü: değişen kaynak dosya sayısı. Hedef: 0.
2. Bir yeteneğin tanımı kimliğinden bulunur. Ölçü: gereken tablo sayısı. Hedef: yalnız yetenek tablosu. Sınır: o günkü kapsam ayrıca ağacın ve şemanın o günkü hâline bağlıdır.
3. Var olmayan kolona bakan şart çalışma anına kalmaz. Ölçü: yayına ulaşan bozuk şart sayısı. Hedef: 0 (tarama KR-010'dadır).
4. İki üyeliği olan kullanıcıda bir kümenin kolonu öbür kümenin kaydında görünmez. Ölçü: sızıntı testi. Hedef: geçer.
5. Yeni birim ve yeni izin maliyeti. Ölçü: yazılması gereken yetenek satırı sayısı. Hedef: yok; kullanıcı bu bedeli kabul etti (Seçim 29 ve 39). Bu ölçütte B, C ve D'den kötüdür. Yeniden bakma eşiği belirlenmedi.

## Seçenekler
### A — Gruba özgü rol
Rol bir gruba aittir; izin ve şart role bağlanır; üyelik kullanıcı + rol çiftidir. Her birim için ayrı "müdür" rolü gerekir. Ajanın 2026-11-21 önerisiydi; kullanıcı reddetti: grup, rol ve izin tek kalmalıdır.
### B — Sade tablolar ve üçünü birleştiren yetenek satırı
Grup, rol ve izin tek tek tutulur; anlam yalnız birleşince doğar ve sınır o satıra yazılır. Kullanıcının seçimi.
### C — BADI'deki yapı
Rol geneldir; şart izinde ve rol–izin bağında iki katman durur; grup ayrımı şarttaki yer tutucuyla çözülür. Politika rol başına bir kez yazılır ve yeni birim üyelik verildiği an çalışır. "Aynı izin, farklı kapsam" durumunu karşılar; "birime göre farklı izin kümesi" durumunu karşılamaz. Kullanıcı B'yi seçti.
### D — B'ye ek olarak rol geneli satır
Yetenek satırı ya belirli bir grubu taşır ya da "üyeliğin grubu" anlamına gelen boş grubu; ortak yetenek bir kez yazılır. İki çürütme turunun da en güçlü karşı görüşüdür. B'ye göre iki yükü kaldırır: yeni birim ve yeni izin için satırların elle çoğaltılması; bir yetenekteki düzeltmenin her birimde tekrarlanması. Bedeli: tek satır değişince bütün birimler etkilenir ve "yetenek satırında grup boş bırakılmaz" seçimi geri alınır. Kullanıcı iki yük kendisine sunulduktan sonra B'de kaldı (Seçim 39).

## Seçim
B. Aksi yazılmadıkça her madde kullanıcı seçimidir (1–9: 2026-11-22; 10–43: 2026-11-23; 44–45: 2026-11-24).

Satır biçimi (seçimlerin toplamı; adlar örnek, kesin adlar şema yazılırken konur):
```
Grup       kimlik · üst grup bağı · silindi
Rol        kimlik · kod (yalnız sistem rollerinde) · silindi
İzin       kaynak + eylem            (kaynak bir Prisma modelidir; eylem bir iştir: okuma, oluşturma,
                                      güncelleme, silme ya da "onayla" gibi bir niyet)
Üyelik     kullanıcı + grup + rol · silindi                         (tekillik üçlüdedir)
Yetenek    kimlik · grup · rol · izin
           kayıt sınırı : şart [ {alan, işleç, değer}, … ]   ya da   «bütün kayıtlar» işareti
           birim kapsamı: şartta birim koşulu                 ya da   «bütün birimler» işareti
                          (yalnız birim kolonu olan kaynakta ve şart taşıyan satırda; Seçim 45)
           kolon sınırı : kolonlar [ad, …]                    ya da   «bütün kolonlar» işareti
                          (silme ve niyet eylemlerinde kolon sınırı aranmaz)
           silindi · tohum anahtarı · yerine geçtiği satır · köken (göç ya da yönetici)
```

Tablolar ve üyelik:
1. Sade tablolar: Grup, Rol, İzin (kaynak + eylem). Kolon kataloğu için ayrı tablo yoktur (Seçim 20).
2. Üyelik kullanıcı + grup + rol üçlüsüdür. Her kullanıcı kök grupta temel bir rolle de üyedir; herkes için geçerli yetenek o kümeye yazılır; yetenek satırında grup ve rol boş bırakılmaz. Aynı kişi aynı grupta birden çok rolle üye olabilir (kullanıcının örneği: imar biriminde iskân raportörü rolü ve hakediş tarafındaki rol). Tekillik üçlüdedir; kişinin yetkisi bütün üyeliklerinin yetenek satırlarının toplamıdır ve "etkin rol" seçimi yoktur; rol genel katalogda tek satırdır (teyit edildi).
6. Grup ağaçtır. Kalıtım hiçbir yönde yoktur: üstteki rolün kendi satırları yazılır; ağaç yalnız şartın "bu birim ve altındakiler" kapsamını belirler. Ağacın doğruluk kaynağı üst grup bağıdır (teyit edildi).
22. Birim yalnız boşken silinir: canlı alt birimi, üyeliği ya da yeteneği olan grup silinemez. Reddedilen: zincirleme silme.
27. Birim taşınabilir: SuperAdmin başka bir üstün altına taşır; döngü engellenir; taşınan birim yeni üstünün "altındakiler" kapsamına girer, eskisinden çıkar.
41. Kapatılan birim "altındakiler" açılımında kalır; üst birim o kayıtları görmeye devam eder. Reddedilen: açılımın yalnız canlı birimleri kapsaması.
44. Kodda rol ya da grup tek başına sorulmaz; yalnız yetenek (izin) sorulur. Kişinin yetenekleri bulunurken grup ve rol her zaman aynı üyelik satırından okunur ve yetenek satırındaki grup ve rolle birlikte eşleşir; grup bir üyelikten, rol başka üyelikten toplanmaz. Kural makineyle denetlenir. Kullanıcının sorduğu durum (2026-11-24): bir birimde müdür, başka birimde personel olan kişi "o birimde mi, evet; müdür mü, evet" diye ikinci birimin müdürü sayılamaz. Açığın doğduğu düzen (grup ve rol iki ayrı bağlantı tablosunda) bu modelde yoktur: üyelik tek tablodur ve üçlüdür (Seçim 2). Öneri ajanındır; kullanıcı teyit etti.
   - Açık: makine denetiminin biçimi (rol ya da grup adına bakan karşılaştırmayı yakalayan lint kuralı) tasarlanmadı; yürüyen iskelette yazılıp sınanacak.

Yetenek satırı:
3. Yetenek satırı grup + rol + izin + kayıt sınırı + kolon sınırıdır. Her satır eşsiz kimlikli bağımsız bir yetenektir; satırlar birbirini ezmez ve birleştirilmez. Her eylem ayrı satırdır; aynı grup + rol + izin üçlüsünden birden çok satır olabilir (teyit edildi).
7. Yetenek değişmez satırdır: düzenleme eski satırı pasife çekip (yumuşak silme) yenisini eklemektir.
9. Öncelik ve etki alanı (girebilir / giremez) ilk sürümde yoktur; kapatma özelliği yazılırken birlikte eklenir.
29. Yeni birim sıfır yetenekle doğar ve yeteneklerini SuperAdmin tek tek yazar (kabul edilen bedel).
39. Satırlar bağımsız kalır; rol geneli satır (D) eklenmez. Kabul edilen iki yük: yeni bir izin onu kullanacak her birim ve rol için ayrı satır ister ve her ortamda ayrıca yazılır; bir yetenekteki düzeltme her birimin satırında tek tek tekrarlanır ve bu satırlar canlı veri olduğu için göç, test ve inceleme onları görmez. Hafifletme: SuperAdmin için toplu yazma aracı (ilk sürümde yok). Yeniden bakma eşiği: belirlenmedi.

Kayıt sınırı (şart):
4. Şart `alan + işleç + değer` üçlülerinin düz dizisidir ve hepsi "ve" ile bağlanır; "veya" ikinci satırla yazılır. Alan kaydın kendi kolonu olabilir ya da ilişki üzerinden tek adım geçebilir ("ilişkili kayıtlardan en az biri"). Değer sabit ya da yer tutucudur. Başlangıç işleçleri: eşit, eşit değil, listede, listede değil, küçük, küçük ya da eşit, büyük, büyük ya da eşit. Başlangıç yer tutucuları: isteği yapanın kimliği; yeteneğin grubu; yeteneğin grubu ve altındakiler. Kayda özel atama için ayrı yapı kurulmaz (teyit edildi).
11. Kayıt sınırı açık yazılır: satır ya «bütün kayıtlar» işaretini ya da en az bir şart taşır; ikisi de yoksa hiçbir kayıt dönmez; ikisi birlikte yazılırsa satır kaydedilirken reddedilir. Boş liste şart değeri olarak yazılamaz.
13. İlişki üzerinden bakan şartta yalnız "eşit" ve "listede" yazılır; olumsuz işleçler kaydın kendi kolonlarında serbesttir. Reddedilen: olumsuz işlecin "hiçbiri" diye okunması.
14. Aynı ilişkiye bakan yapraklar aynı ilişkili kayıtta birlikte tutar ("Bilgi İşlem'in müdürü" tek üyelikte aranır). Çok üyelikli kişi şartı tutan herhangi bir üyeliği üzerinden eşleşir; isteği yapan her üyeliğinden gelen yeteneği ayrı ayrı kullanır (teyit edildi). Silinmiş ilişkili kayıt sayılmaz: her ilişki şartına hedef kaydın silinmemiş olması koşulu eklenir.
45. Birim kapsamı açık yazılır: birim kolonu olan bir kaynakta, şart taşıyan yetenek satırı ya bir birim koşulu ("yeteneğin grubu" ya da "yeteneğin grubu ve altındakiler" yer tutucusuyla) ya da «bütün birimler» işaretini taşır; ikisi de yoksa satır kaydedilirken reddedilir. Neden: yetenek satırının bir birime bağlı olması yalnız "kim alır" sorusunu cevaplar, "hangi kayıtlar" sorusunu değil; yalnız [durum = bekliyor] şartı taşıyan bir satır bütün birimlerin kayıtlarını kapsar ve satır bir birime bağlı göründüğü için bu gözden kaçar. «Bütün kayıtlar» işaretli satır zaten açık bir seçimdir ve ayrıca işaret istemez. Birim kolonu olmayan kaynakta kural uygulanmaz. Öneri ajanındır; kullanıcı teyit etti. Reddedilen: birim koşulunu yazmayı yöneticinin dikkatine bırakmak.
   - Açık: bir kaynağın birim kolonunun hangisi olduğunun nasıl bildirileceği (kaynak tanımı) tasarlanmadı.

Kolon sınırı:
5. Kolonlar listedir. Satır ya «bütün kolonlar» işaretini taşır ya da kolonları tek tek sayar; ikisi de yoksa hiçbir kolon görünmez; ikisi birlikte yazılamaz.
12. «Bütün kolonlar» işareti yazma eylemlerinde de kullanılır; şemaya eklenen kolonun işaretli yazma yeteneklerine kendiliğinden girmesi kabul edilen bedeldir (ajanın önerisi "yalnız okumada" idi).
19. Kolonlar yetenek satırında dizi olarak durur. Reddedilen: bağlantı tablosu (ajanın önerisiydi; kullanıcı fazla mühendislik buldu). Bedel: adı değişen kolon Seçim 35'teki göç olmadan o yeteneklerde görünmez olur. Kapalı varsayılana uymayan bilinen durum: şemadan kalkan bir kolonun adıyla sonradan başka bir kolon eklenirse bayat adı taşıyan canlı satır onu kendiliğinden verir.
20. Kolon kataloğu ayrı tablo değildir; şemadan okunur. Reddedilen: şemadan üretilip göçle eşlenen tablo (kullanıcı onu `schema.prisma`'yı tabloya yeniden yazmak saydı).
21. «Bütün kolonlar» modelin bütün alanlarıdır; "verilemez alan" işareti yoktur. Sırlar (parola özeti gibi) kaynak modelinde durmaz; kaynak olmayan ayrı tabloda durur. Kişisel veri için gizleme ya da maskeleme yoktur (kullanıcı talimatı, 2026-11-17).
33. Kolon yalnız kaydın kendi alanıdır: kaynak bir Prisma modelidir ve «bütün kolonlar» o modelin ilişki olmayan alanlarıdır; yabancı anahtar alanı (atanan kişinin kimliği, grubun kimliği) kaydın kendi kolonudur ve şartta kullanılabilir. Bir kayıtla birlikte yüklenen ilişkili kayıt kendi kaynağının yeteneğiyle ayrıca süzülür ve kolonları indirilir. Reddedilen: ilişki alanının kolon sayılması.

Yazmanın anlamı:
10. Yazmada şart kaydın iki hâline de bakar: güncellemede kayıt hem değişmeden önce hem değiştikten sonra şartı tutar; oluşturmada yalnız yeni hâl, silmede yalnız var olan hâl vardır. Reddedilenler: yalnız önceki hâl; yalnız sonraki hâl. Devrin ayrı bir eylem olması ilk gerçek ihtiyaca ertelendi.
18. Kaydın iki hâlini ve yazılan kolonları aynı yetenek satırı tutar. Daha geniş sınır gerekiyorsa yetenek düzenlenir (yeni satır yazılır, eskisi pasife çekilir) ve işlem ancak o yeni yetenek o kümeye verilmişse yapılır.
34. Her niyet komutu kendi eylemidir: "onayla", "reddet" gibi işler ayrı izinlerdir; yetenek satırı şart taşır, kolon sınırı aranmaz. Düz güncellemede "yazılan kolon" istek gövdesiyle gelen ve değeri değişen alandır; sistemin kendi yazdığı kolonlar kolon denetimine girmez. Kimlik ile oluşturma, güncelleme ve silinme zamanı kolonları hiçbir isteğin gövdesinden kabul edilmez; silme yalnız silme eylemiyle olur (teyit edildi). Reddedilen: niyet komutunu güncelleme sayıp yazdığı kolonları kolon listesinde aramak.
42. Niyet eyleminde şart kaydın yalnız önceki hâline bakar (ön koşul): "durum = bekliyor" şartlı "onayla" yeteneği bekleyen kaydı onaylar ve sonraki hâl şarta sokulmaz, çünkü sonraki hâli isteğin gövdesi değil komutun kodu yazar. İki hâl kuralı (Seçim 10) düz güncellemede aynen kalır. Kaydı başka bir birime ya da kişiye taşıyan niyet komutu hedefini kendi kodunda denetler (kabul edilen bedel). Reddedilen: niyette de iki hâl (durum şartı yetenek satırına yazılamaz, kural komutun koduna gömülür ve yönetici onu göremez).

Sistem satırları ve yönetim:
15. Kodun var olduğunu varsaydığı satırlar sistem satırıdır: göçle gelir, çalışma anında silinemez, görünen adı değiştirilebilir. Kök grup yapıdan tanınır (üst grubu olmayan tek grup); temel rol ve SuperAdmin rolü değişmeyen bir kod taşır.
17. Grup, rol, üyelik ve yetenek yazımı ilk sürümde yalnız kök gruptaki SuperAdmin rolündedir (rolün adı kullanıcının); bu dört tabloya yazma izni veren yetenek yalnız o kümeye bağlanabilir. SuperAdmin'in hakları yalnız yetenek satırlarından gelir; kodda "SuperAdmin ise geç" dalı yoktur ve "god mode" da satır satır tanımlanır (teyit edildi). "Yalnız IT'den kişiler" kimin eklendiğiyle sağlanır, yapı zorlamaz. Birim yöneticisine devir tasarlanmadı.
28. İlk SuperAdmin üyeliğini projenin kendi tohum göçü yazar.
   - Ek (kullanıcı, 2026-11-24: a; TS-002 ikinci çürütme turunun 6. bulgusu): göç ilk SuperAdmin kullanıcısını da yazar ve bunu elle değil, base'in verdiği tek yardımcıyı çağırarak yapar; yardımcı kullanıcıyı, (Kök, Temel) ve (Kök, SuperAdmin) üyeliklerini ve sürüm sayılarını doğru yazar. Sistem aktörleri de aynı yardımcıyla yazılır. Parola bağlantısını göç üretmez; onu kurulum komutu üretir (KR-009 Seçim 9). Ajanın önerisi ilk SuperAdmin'i kurulum komutunun yazmasıydı (giriş bilgisi kaynak koda girmez, her ortamın yöneticisi ayrı olabilir, kilitlenince yeni sürüm gerekmez); kullanıcı göçü seçti. Kabul edilen bedel: ilk yöneticinin giriş bilgisi göç dosyasında durur; hiçbir SuperAdmin giremezse yeni bir göç yazılıp yayınlanır (aşağıdaki "Kilitlenme" satırı). Ajan önerisi (teyide sunulmadı): yardımcı giriş bilgisini parametre alır; proje onu göçte sabit yazabilir ya da ortam ayarından okuyabilir.
   - Yükümlülük 12'deki "kullanıcı tek yoldan açılır" cümlesinin adıyla sayılı istisnasıdır: ikinci yol göçün çağırdığı yardımcıdır ve o da kök üyeliği yazar.
30. (Kök, SuperAdmin) kümesinin bu dört tabloya yazma yetenekleri de sistem satırıdır: silinemez ve daraltılamaz.
31. Kök üyelik kullanıcı kaydının parçasıdır: "kullanıcı aç" komutu kullanıcıyla birlikte (Kök, Temel) üyeliğini aynı işlemde yazar ve bunun için üyelik yazma yeteneği aranmaz; kullanıcıyı kimin açabileceğini olağan "kullanıcı oluşturma" izni belirler. Seçim 17'nin adıyla ilk istisnasıdır (ikincisi Seçim 43). Sistem aktörü SuperAdmin yapılmaz ve "son SuperAdmin" sayımına girmez.
43. Kullanıcıyı pasife alma ve yeniden açma Seçim 17'nin adıyla ikinci istisnasıdır: "kullanıcıyı pasife al" komutu kişinin bütün üyeliklerini aynı işlemde kendisi kapatır ve bunun için üyelik yazma yeteneği aranmaz; kimin pasife alabileceğini olağan "kullanıcı pasife alma" izni belirler. Sistemdeki son SuperAdmin üyeliğini taşıyan kişi pasife alınamaz; önce başka biri SuperAdmin yapılır. Yeniden açılan kişi yalnız (Kök, Temel) üyeliğiyle döner; eski üyelikleri geri gelmez, yönetici yeniden verir. Reddedilen: eski üyeliklerin kendiliğinden dönmesi (açık tarafa düşer). Öneri ajanındır (üçüncü çürütme turunun 3. bulgusu); kullanıcı 2026-11-23'te teyit etti.
46. Kişinin kendi üzerindeki işler ikiye ayrılır. Uç hiçbir parametreyle kayıt seçmiyor ve hedefini yalnız oturumdan alıyorsa "yalnız kendisi" işaretini taşır ve yetenek aranmaz; tablodan kayıt seçen ya da listeleyen iş, kişinin kendi kaydı için bile, yetenek satırından geçer (şart: kaydın sahibi isteği yapandır) ve bu yetenekler herkesin (Kök, Temel) üyeliğine tohumlanır. "Yalnız kendisi" işaretini taşıyan uçlar adıyla sayılı bir listedir ve listeye ekleme makineyle denetlenir. İlk liste (TS-002): çıkış, "yetkilerim" (ekranın kuralları), parola değiştir. Yetenekle çalışanlar: "oturumlarım" ve başka cihazdaki oturumu kapatma. Kullanıcı (2026-11-24): c.
   - Neden: çıkış ve "yetkilerim" yetki verisi bozulduğunda da çalışmalıdır ve "yetkilerim" yetenekleri getiren uç olduğu için yetenekle korunamaz; kayıt seçen iş ise veri erişimi kapısından geçer ve o kapıya yeteneksiz ikinci bir yol açmak asıl deliği açar.
   - Reddedilenler: hepsinin yetenek satırıyla çalışması (en saf olanı; ama bir tohum hatası herkesi kilitler: kimse çıkış yapamaz, ekran kurallarını alamaz); hepsinin işaretle çalışması (yetki tablosunda görünmeyen beş iş ve kayıt okuyan işler için yeteneksiz ikinci okuma yolu).
   - Kabul edilen bedel: üç iş yetki tablosunda görünmez; proje bunları satır silerek kapatamaz.
   - Açık (ajan): Seçim 44'le ilişkisi (işaret rol ya da grup sormaz, yalnız oturumun varlığını sorar); "yalnız kendisi" işaretinin KU-011'deki "her uç tam bir yetki dekoratörü taşır" kuralına üçüncü tür olarak yazılması; tohumlanan "kendi kaydın" yeteneklerinin sistem satırı sayılıp sayılmayacağı (Seçim 15 ve 30).
47. SuperAdmin koruması: hedef kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyorsa, onun giriş bilgisini (kullanıcı adı, telefon) değiştirmeyi, ona parola bağlantısı üretmeyi ve onu pasife almayı yalnız canlı (Kök, SuperAdmin) üyeliği taşıyan kişi yapar; isteyenin o iş için yeteneği olsa da kural geçerlidir. Kullanıcı (2026-11-24): a. Kaynak: TS-002 birinci çürütme turunun 3. bulgusu (kullanıcı güncelleme ya da bağlantı üretme izni olan kişi, telefonu değiştirerek ya da bağlantı üreterek SuperAdmin olabiliyordu; şart dili "SuperAdmin olmayanlar" kapsamını yazamaz, Seçim 13).
   - Yeri: Seçim 44'ün ("kodda rol sorulmaz") adıyla sayılı istisnasıdır; "son SuperAdmin üyeliği silinemez" ile aynı türden bir alan kuralıdır ve komutun içinde, hedef kişinin kilidi altında denetlenir.
   - Reddedilenler: bu yeteneklerin yalnız (Kök, SuperAdmin) kümesine yazılabilmesi (en kapalısı; ama her parola sıfırlama SuperAdmin'e gider); "kimse kendisinde olmayan bir yeteneği taşıyan kişinin hesabına bu işleri yapamaz" genel kuralı (iki kişinin bütün yeteneklerini karşılaştıran denetim; ilk sürüm için fazla).
   - Kabul edilen sınır: kural yalnız SuperAdmin'i korur. Başka güçlü rollerin hesabı için proje, bağlantı üretme ve giriş bilgisi değiştirme yeteneklerini şartla daraltır (örnek: yalnız kendi birimindeki kullanıcılar).
   - Sonuçlar (ajan önerisi; teyit bekliyor): giriş bilgisini değiştirmek düz güncellemeden ayrı, kendi izni olan bir iştir (`Kullanici:giris_bilgisini_degistir`) ve giriş bilgisi değişince kişinin bütün oturumları kapanır; bir kişiye (Kök, SuperAdmin) üyeliği verilirken o kişinin kullanılmamış parola bağlantısı silinir (önceden üretilmiş bağlantıyla sonradan SuperAdmin olan hesaba girilmesin diye). Kapatılamayan durum: SuperAdmin yapılmadan önce telefonu başkasının numarasıyla değiştirilmiş hesap; üyeliği veren SuperAdmin'in dikkatine kalır.
   - Ek (kullanıcı, 2026-11-24; TS-002 ikinci çürütme turunun 1. bulgusu): bir hesaba (Kök, SuperAdmin) üyeliği verilirken giriş sıfırlanır: kişinin bütün oturumları kapanır, parolası ve bekleyen bağlantısı silinir; üyeliği veren SuperAdmin yeni bir parola bağlantısı alır ve gerçek kişiye kendisi iletir. Kapattığı yol: kullanıcıyı açan kişi parolayı önceden kendisi belirlemişse, o hesaba SuperAdmin üyeliği verilince SuperAdmin oluyordu. Reddedilenler: olduğu gibi bırakmak (hesabın kimde olduğu üyeliği verenin dikkatine kalır); SuperAdmin'in çalışma anında hiç verilememesi (her yeni SuperAdmin için sunucu erişimi gerekir). Kabul edilen bedel: SuperAdmin yapılan kişi parolasını yeniden belirler. Üstteki "kullanılmamış bağlantı silinir" cümlesi bu ekin parçası olur. Açık (kodla giriş tasarımında sorulacak): kodla giriş açıksa telefon numarasının da üyeliği veren SuperAdmin tarafından yeniden yazılması (ajan önerisi).
   - Unutma da bu korumaya girer (ajan düzeltmesi; TS-002 ikinci tur 4): unutma pasife almanın üstüne kurulduğu için aynı denetimler geçerlidir.
- Teyit edilen korumalar: sistemdeki son SuperAdmin üyeliği ve kişinin kök üyeliği silinemez. Kullanıcı pasife alınınca bütün üyelikleri kapanır (kök üyelik dahil; "kök üyelik silinemez" korumasının tek istisnası) ve yeniden açılırsa kök üyeliği yeni satır olarak yazılır (Seçim 43). Rol ve izin de yalnız boşken silinir.

Göç ve tohum:
8. Yazım yeri: kodla gelen tablolar (izin) yalnız sürümlü göçle değişir; kurum verisi (grup, rol, üyelik, yetenek) çalışma anında da yazılır ve ilk kurulum için göçle tohumlanır.
16. Göç, yöneticinin değiştirdiği yeteneği ezmez: tohum satırı değişmeyen bir tohum anahtarı taşır, her yeni satır yerine geçtiği satırı ve kökenini (göç ya da yönetici) gösterir; göç zincirin ucunda yöneticinin satırını görürse dokunmaz, durur ve bildirir. Yöneticinin yerine yenisini koymadan sildiği tohum yeteneği de "değiştirildi" sayılır. "Uç" tek satır değil, canlı torunların kümesidir. Tohum anahtarı canlı satırlar arasında tekildir. Tohum göçü yayından önce canlı veride kuru koşar; ya tümüyle uygulanır ya hiç. Reddedilenler: göçün kazanması; göçün yalnız eklemesi.
35. Kolon adı değişikliği göçü Seçim 16'nın adıyla istisnasıdır: adı değiştiren göç o adı şartında ya da kolon dizisinde taşıyan canlı yetenekleri de yeniler (yeni satır yazılır, eskisi pasife çekilir; Seçim 7 burada da geçerlidir) ve yeni satır eskisinin kökenini olduğu gibi taşır: yöneticinin değiştirdiği satır ad göçünden sonra da "yönetici" kökenlidir ve sonraki tohum göçü onda yine durur. Reddedilenler: iki adımlı geçiş; olduğu gibi bırakmak; yenilenen satırın kökenine "göç" yazmak (ilk metin buydu; üçüncü çürütme turunun 1. bulgusu üzerine düzeltme ajanın önerisidir, kullanıcı 2026-11-23'te teyit etti).

KR-010'a taşınan numaralar (metinleri oradadır): 23 (derlenmiş yetkinin saklanması), 24 ve 32 (sürüm sayıları), 25 ve 36 (sistem aktörü), 26 (yazma isteği ya hep ya hiçtir), 37 (şartı yalnız veritabanı değerlendirir), 38 (kendi çeviricimiz), 40 (değişiklik ve erişim kaydı).

Ertelenenler (kullanıcı teyidi, 2026-11-23) ve karar yeri: devir eylemi (ilk gerçek ihtiyaçta); göç durunca kararın nasıl verileceği (göç aracı tasarlanırken); projeye özgü yer tutucular (ilk projede ihtiyaç çıkınca); öncelik, etki ve kapatma (Seçim 9); devredilmiş yönetim (Seçim 17); toplu yazma aracı (Seçim 39).

Neyden vazgeçildi: tek satırda iç içe "ve / veya"; ortak yeteneği birimler için bir kez yazmak (C ve D); üst birimin alt birimin yeteneklerini kendiliğinden alması; şarttaki alan adının ve kolon adının yabancı anahtarla korunması; test ile canlı ortamın aynı yetki verisini taşıması.

## Sonuçlar
- Olumlu: rol sayısı birim sayısıyla çoğalmaz; bir kümenin yeteneği değişince başka küme etkilenmez; her "veya" dalının kendi kolonu ve kimliği olur; yetenek tek satırda kendi başına okunur; eksik ya da yanlış tanım erişimi açmaz, kapatır.
- Olumsuz: kalabalık yetenek tablosunda toplanır (üst sınır grup × rol × izin, artı "veya" dalları, artı geçmiş); yeni birim ve yeni izin elle satır ister; düzeltme birim birim tekrarlanır; "(A veya B) ve C" iki satır ister; her düzenleme yeni satır üretir; iki adım ilişki gerektiren kaynak kendi birim kolonunu taşımak zorundadır; her niyet yeni bir izindir.
- Yükümlülük (kural adayları; taslakları açılacak):
  1. Yetenek satırı yerinde düzenlenmez; düzenleme eskiyi pasife çekip kökeni ve yerine geçtiği satırı taşıyan yenisini eklemektir (Seçim 7, 16).
  2. Kayıt ve kolon sınırı açık yazılır: işaret ya da içerik; ikisi birden ya da boş liste yazılamaz; hiçbiri yoksa kayıt ya da kolon dönmez (Seçim 5, 11).
  3. Şart yazılırken alan, işleç ve değer tipi şemadan doğrulanır; ilişki üzerinden tek adım ve yalnız "eşit" ile "listede" yazılır (Seçim 4, 13).
  4. Grup, rol, üyelik ve yetenek tablolarına yalnız (Kök, SuperAdmin) yazar; adıyla iki istisna vardır: "kullanıcı aç" komutunun yazdığı kök üyelik ve pasife alma ile yeniden açma komutlarının üyelik yazımı (Seçim 17, 31, 43).
  5. Sistem satırları, son SuperAdmin üyeliği ve kök üyelik çalışma anında silinemez; SuperAdmin kümesinin yönetim yetenekleri daraltılamaz (Seçim 15, 30).
  6. Grup, rol ve izin yalnız boşken silinir; grup taşınırken döngü engellenir; kök tektir (Seçim 22, 27).
  7. Kalıtım yoktur (KU-014, var; cümlesi düzeltilecek).
  8. Kodla gelen izin verisi sürümlü göçle değişir; göç yöneticinin satırını ezmez, tek istisna ad değişikliğidir ve o göç yenilediği satırın kökenini korur; tohum göçü yayından önce canlı veride kuru koşar (KU-015, var; Seçim 16, 35).
  9. Sır alanı kaynak olarak kayıtlı modele konmaz (Seçim 21).
  10. Yazmada kaydın iki hâlini ve yazılan kolonları aynı yetenek tutar; niyet eyleminde şart yalnız önceki hâle bakar ve kaydı taşıyan niyet komutu hedefini kendisi denetler; kimlik ve zaman kolonları istek gövdesinden kabul edilmez (Seçim 10, 18, 34, 42).
  11. Her niyet komutu kendi iznini taşır (KU-011 ile birlikte; Seçim 34).
  13. Kodda rol ya da grup tek başına sorulmaz; yalnız yetenek sorulur ve grup ile rol aynı üyelik satırından eşleşir (Seçim 44).
  14. Birim kolonu olan kaynakta şart taşıyan yetenek satırı ya birim koşulu ya da «bütün birimler» işareti taşır (Seçim 45).
  12. Kullanıcı tek yoldan açılır ve o yol kök üyeliği yazar (tek istisna: tohum göçünün çağırdığı base yardımcısı; Seçim 28 eki); pasife alınan kullanıcının üyeliklerini pasife alma komutu kapatır, son SuperAdmin'i taşıyan kişi pasife alınamaz ve yeniden açılan kişi yalnız kök üyelikle döner (Seçim 31, 43).
- Ortak parça: `shared` altında şart doğrulayıcı ve yetki tablolarının yazma kapısı; adları ve sınırları tasarlanmadı. Derleyici ve çevirici KR-010'dadır.
  - Uyarlama (kullanıcı, 2026-11-24; TS-002 "Yapı"): yetki tablolarının ve yazma kurallarının sahibi `kimlik` feature'ıdır; yazma kapısı `shared`'de değil `kimlik`in içindedir. `shared`'de yalnız motor ve `kimlik`in uyguladığı arayüzler kalır. Üstteki satır kabulden önce buna göre yeniden yazılacak.

## Doğrulama
Denetim kimliği ve ölçüm tarihi henüz yok; kod yazılmadı.
Öneri (ajan). Birim: model ve çağrı.
- Değişmezlik: yetenek tablosunda sınır alanlarını (şart, kolon dizisi, işaretler) güncelleyen yazma yolu yok.
- Açık sınır: işareti ve şartı olmayan yetenek kayıt döndürmez; işareti ve kolon dizisi olmayan yetenek kolon döndürmez; ikisi birlikte ya da boş listeyle yazma reddedilir.
- Şart doğrulama: şemada olmayan alan, tipe uymayan işleç ya da değer ve ilişki üzerinden olumsuz işleç yazılırken reddedilir.
- Sızıntı: iki üyelikli kullanıcıda her kayıt yalnız kendisini tutan yeteneklerin kolonlarını döndürür; iç içe gelen ilişkili kayıt kendi kaynağının yeteneğiyle indirilir.
- Rol karışması: bir birimde Müdür, başka bir birimde Personel olan kişi ikinci birimin kayıtlarında yalnız (o birim, Personel) kümesinin yeteneklerini kullanır; Müdür rolünü bir üyelikten, birimi öbür üyelikten alarak "o birimin müdürü" sayılmaz (Seçim 2, 3 ve 14). Kullanıcı bu durumu 2026-11-24'te ayrıca sordu.
- Birim kapsamı: birim kolonu olan kaynakta, birim koşulu ve «bütün birimler» işareti taşımayan şartlı yetenek satırı kaydedilirken reddedilir; işareti taşıyan satır bütün birimlerin kayıtlarını kapsar.
- Rol sorgusu denetimi: rol ya da grup adına tek başına bakan kod lint'te hata verir.
- Taşıma: sınır dışına taşıyan ve sınır içine çeken güncelleme reddedilir; önceki hâli bir yeteneğin, sonraki hâli başka bir yeteneğin tuttuğu güncelleme de reddedilir.
- Niyet: "durum = bekliyor" şartlı onay yeteneği bekleyen kaydı onaylar; onaylanmış kaydı ve başka birimin kaydını reddeder.
- Yönetim: SuperAdmin kümesi dışındaki bir kümeye yetki tablolarına yazma yeteneği bağlanamaz; son SuperAdmin üyeliği, kök üyelik ve SuperAdmin'in yönetim yetenekleri silinemez; aynı anda gelen iki silme isteği sıfır SuperAdmin bırakamaz.
- Yaşam döngüsü: dolu grup, rol ve izin silinemez; döngü oluşturan taşıma reddedilir; kullanıcı açılışı kök üyeliği yazar; pasife alınan kullanıcının üyelikleri kapanır; son SuperAdmin üyeliğini taşıyan kişi pasife alınamaz; yeniden açılan kişi yalnız kök üyelikle döner.
- Göç: yöneticinin değiştirdiği ya da sildiği tohum yeteneğinde göç durur ve hiçbir satırı ezmez; ad değişikliği göçü şartları ve kolon dizilerini yeni satırla yeniler ve kökeni korur; yöneticinin daralttığı yetenek ad göçünden sonra koşan tohum göçünde de genişlemez; aynı tohum anahtarı iki kez yazılamaz.

## Varsayımlar
- Kaynak ile Prisma modeli bire bir eşlenir ve kaynağın kodu model adından türetilir; tasarlanmadı; varsayım, 2026-12-21.
- "Tek kök" ve "tohum anahtarı canlı satırlarda tekil" kısıtlarının Prisma şemasında nasıl yazılacağı bilinmiyor; varsayım: ham SQL göçüyle yazılır, 2026-12-21.
- Şema bilgisinin programdan okunma yolu Prisma ana sürümüne bağlıdır; Prisma 7 seçildi (KR-004, 2026-11-24) ve 8'de bu yol değişir; 7'de denenmedi; varsayım: yürüyen iskelette denenir, 2026-12-21.
- Yetenek tablosunun büyüklüğü (satır sayısı, geçmişin payı) bilinmiyor; varsayım: canlı satırlar üzerindeki dizinle sorun olmaz, 2026-12-21'e kadar yürüyen iskelette bakılacak.
- Olumsuz işleçte boş değerli kayıt eşleşmez (veritabanı davranışı beklenir); denenmedi; varsayım, 2026-12-21.
- Kişisiz çalışma için sistem aktörünün tek mi iş türü başına mı olacağı olaylar kümesinde kararlaştırılır; varsayım, 2026-12-21.

## Geri dönüş
- Saklanan satırın anlamını değiştiren (geri alması veri göçü ve her satırın yeniden yorumlanmasını isteyen) seçimler: 4, 5, 10, 11, 12, 13, 14, 18, 21, 33, 34, 42 ve "silinmiş ilişkili kayıt sayılmaz" kuralı.
- Yapıyı değiştiren ama satırın anlamına dokunmayan seçimler: 19 (diziden bağlantı tablosuna geçiş veri göçüdür), 20, 22, 27, 41.
- A'ya dönüş (gruba özgü rol): rol satırlarının birim başına çoğaltılması ve üyeliklerin göçü gerekir.
- D'nin eklenmesi var olan satırları bozmaz, ama iz ve Seçim 17'deki küme denetimi yeniden tanımlanır; bu yüzden erişim ve değişiklik kaydı bugünden üyelik kimliğini de taşır (KR-010).
- C'ye dönüş yetenek satırlarının rol başına birleştirilmesini ister; birimler arasında farklılaşmış satırlar birleştirilemez.
- Düz diziden iç içe ağaca geçiş: düz dizi ağacın tek dallı hâlidir; saklı şartların dönüştürülmeden okunabileceği öngörülür, denenmedi. Tersi veri göçü ister.
- Değişmez satırdan yerinde düzenlemeye dönüş: değişiklik ve erişim kayıtlarındaki kimliklerin anlamı değişir.
- Yeniden bakma tetiği (öneri, ajan; eşik sayıları belirlenmedi): sızıntı testi kırmızıya dönerse; yetenek satırlarının çoğu birimler arasında kopyaysa (D'yi gündeme getirir); ilk yetki devri isteği gelirse.

## İstisna yolu
- Bir kişinin bir birimde tam o rol gibi davranması gerekirse kalıtım eklenmez; kişiye o birimde o rolle ikinci üyelik verilir.
- Kilitlenme (hiçbir SuperAdmin giremiyorsa): projenin tohum göçü yeni bir SuperAdmin üyeliği yazar (Seçim 28); yönetim yetenekleri sistem satırı olduğu için yerindedir (Seçim 30).
- Kullanıcı açılışındaki kök üyelik ile pasife alma ve yeniden açmadaki üyelik yazımı Seçim 17'nin, kolon adı değişikliği göçü Seçim 16'nın adıyla istisnasıdır (Seçim 31, 43, 35); Sonradan eklenenler (2026-11-24): unutma, pasife almanın üstüne kurulduğu için yeteneksiz üyelik kapatması yapar ve Seçim 17'nin adıyla üçüncü istisnasıdır (TS-002); tohum göçünün çağırdığı yardımcı, kullanıcının tek yoldan açılması kuralının adıyla istisnasıdır (Seçim 28 eki). Başka istisna tanımlanmadı.
- Bütün yetenekleri silmeden kapatma gerekirse bu karar genişletilir: öncelik ve etki alanı birlikte eklenir (ayrı karar).
- Projeye özgü yer tutucu gerekirse `shared` altına yazılmaz; ekleme yolu tasarlanmadı, o zamana kadar kullanıcıya sorulur.
- Kimlik ve yetki gerektirmeyen uçlar için KR-007'nin istisna yolu geçerlidir.
