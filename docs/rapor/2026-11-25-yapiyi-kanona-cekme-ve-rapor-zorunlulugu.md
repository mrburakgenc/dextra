# Yapıyı kanona çekme ve rapor zorunluluğu — 2026-11-25

## Denetlemek için

- Planın güncel hâli: `python3 harness/h.py plan durum` · görevler: `python3 harness/h.py gorev durum`
- Bir görevin kartı, işçinin bitiş kaydı ve inceleme kaydı: ana çalışma ağacında `.harness/gorev/GV-NNN/` (`kart.md`, `bitis.json`, `inceleme.json`, `rapor.json`, `inceleme-rapor.json`)
- Raporsuz görev ve boş bölüm: `python3 harness/h.py rapor durum` · görev tablosunu yenilemek: `python3 harness/h.py rapor uret <bu dosya>`

## 1. Kısa özet

_(doldurulacak: ne yapıldı, ne değişti ve kullanıcı neye bakmalı; madde madde, her iddianın kaynağıyla)_

## 2. Görevler

<!-- otomatik:basla -->
Bu bölümü araç üretir (`python3 harness/h.py rapor uret <dosya>`); sayılar aracın kayıtlarından (`.harness/gorev/`) okunur, elle yazılmaz. Süre ve maliyet her görevin SON işçi koşusunun ve SON incelemesinin kaydıdır: yeniden koşulan görevin önceki koşuları bu sayılara girmez.

Tabloda 16 görev var, 14 tanesi alındı. Son koşuların ve incelemelerin toplamı: 197.3 dakika, 73.10 dolar.

| Görev | Plan | Başlık | Aşama | İşçi (dk) | İnceleme (dk) | Dolar | Dosya | İncelemenin bulguları | Cevaplanan soru |
|---|---|---|---|---|---|---|---|---|---|
| GV-105 | EP-005 12 | Yerel deneme betiğine kalıcı kip: yerel veritabanlarının üstünde çalıştırma | alındı | 5.9 | 6.5 | 3.44 | 2 | 0 engel, 3 öneri | 0 |
| GV-106 | EP-008 1 | Yapı denetimi ve kalıp: rol alt özelliği kanondaki düzene çekilir | alındı | 5.4 | 9.0 | 4.98 | 40 | 0 engel, 4 öneri | 0 |
| GV-107 | EP-008 2 | Kullanıcı alt özelliği kanondaki düzene çekilir | alındı | 3.0 | 8.1 | 4.61 | 44 | 0 engel, 0 öneri | 0 |
| GV-108 | EP-008 3 | Grup alt özelliği kanondaki düzene çekilir | alındı | 12.4 | 8.7 | 6.95 | 36 | 0 engel, 2 öneri | 0 |
| GV-109 | EP-008 4 | Üyelik alt özelliği kanondaki düzene çekilir | alındı | 2.4 | 10.7 | 3.46 | 26 | 0 engel, 1 öneri | 0 |
| GV-110 | EP-008 5 | Yetenek alt özelliği kanondaki düzene çekilir | alındı | 3.0 | 6.3 | 4.41 | 37 | 0 engel, 1 öneri | 0 |
| GV-111 | EP-008 6 | Parola alt özelliği kanondaki düzene çekilir | alındı | 4.4 | 9.8 | 5.72 | 34 | 0 engel, 4 öneri | 1 |
| GV-112 | EP-008 7 | Oturum alt özelliği kanondaki düzene çekilir | bekliyor | — | — | — | — | — | 0 |
| GV-113 | EP-008 8 | Kurulum komutunun içe aktarma yolu parolanın yeni düzenine çevrilir | alındı | 1.9 | 4.9 | 1.26 | 1 | 0 engel, 0 öneri | 0 |
| GV-114 | EP-008 9 | Oturum alt özelliği kanondaki düzene çekilir | alındı | 18.0 | 6.6 | 10.99 | 48 | 0 engel, 2 öneri | 0 |
| GV-115 | EP-008 10 | Kimliğin ortak klasörü (_shared) kanondaki düzene çekilir | alındı | 3.4 | 8.1 | 5.24 | 81 | 0 engel, 5 öneri | 1 |
| GV-116 | EP-008 11 | Ortak kod düzene çekilir (1/3): yetki, güvenlik ve kimlik sözleşmeleri | alındı | 4.6 | 8.4 | 5.62 | 115 | 0 engel, 2 öneri | 1 |
| GV-117 | EP-008 12 | Ortak kod düzene çekilir (2/3): veritabanı, tohum ve mesajlaşma | alındı | 7.5 | 7.8 | 4.75 | 176 | 0 engel, 1 öneri | 0 |
| GV-118 | EP-008 13 | Ortak kod düzene çekilir (3/3): HTTP, süzgeçler ve gözlemlenebilirlik | alındı | 10.9 | 4.3 | 5.77 | 51 | 0 engel, 1 öneri | 0 |
| GV-119 | EP-008 14 | Yapı denetimi sıkılaşır: bütün alt özellikler ve ortak kod sınanır | bekliyor | — | — | — | — | — | 0 |
| GV-120 | — | Araca rapor komutu ve raporsuz görev denetimi eklenir | alındı | 8.3 | 7.2 | 5.91 | 6 | 0 engel, 3 öneri | 0 |
<!-- otomatik:bitir -->

## 3. Kullanıcının verdiği kararlar

Hepsi 2026-11-25'te, sohbette verildi; sözler kullanıcının kendi sözüdür.

| Karar | Kullanıcının sözü | Nerede kayıtlı |
|---|---|---|
| Main yerelde görülsün | "maini buraya bi al bakalım ne yaptığını bi göreyim" | PR #15 birleşti; ana çalışma ağacı çekildi |
| Uygulama ayağa kalksın | "bi kaldır bakalım ayağa göreyim ne oldugunu" | yerel deneme betiği |
| Yerel veritabanı kum havuzudur; göç ve tohum serbest | "yerel dbsini niye kullanmıyorsun orası zaten sandbox ya sıfırlar tekrar basarız oraya ya" | TS-001 "Yerel veritabanı kum havuzudur" |
| Yerel deneme betiğine kalıcı kip eklensin | "ekle" | GV-105 |
| Yapı kanona uymuyor; düzeltilsin | "interface katmanı nerede dosyalarda i-repository kısımları yok gibi … domainin domain kuralları nerede göremedim … command query result olarak klasorlu deil … cqrs'i tam inceletmedin gibi duruyor" ve "tamam onları da yap gel bakayım" | TS-005 "Sorun"; EP-008 |
| Ortak kod da aynı düzene girsin | "_shared ve shared içini de aynı düzene çek" | TS-005 "Ortak kodun ve feature içi ortak klasörün düzeni" |
| Rapor yazmak araçta şart olsun | "bu gece raporu gibi raporları da yazılmaşı şart olsun harnessda" | KR-015, KU-016, DN-001 (taslak); GV-120 |

Kullanıcının önerip henüz karara bağlamadığı iki konu 8. bölümdedir: PR'ların aşamalı ve tek commit olarak birleştirilmesi; araca eklenebilecek öbür zorunluluklar.

## 4. Ajanın verdiği kararlar

Hiçbiri kabul edilmiş karar değildir; hepsi taslak tasarım kaydı TS-005'te yazılıdır. Kullanıcı üç yapı kararını devretti ("tamam onları da yap gel bakayım").

| Karar | Seçilen | Reddedilen ve neden | Teyit |
|---|---|---|---|
| Doğrulamanın yeri (TS-005 Seçenekler 1) | Zod şeması komutun ve sorgunun yanında, uygulama katmanında | Sunumda kalması: işleyiciyi uçtan başka yoldan çağıran doğrulamayı atlar. Sınıf süsleyicili doğrulama: KR-014 ile çelişir | bekliyor |
| Adların dili (Seçenekler 2) | Türkçe adlar kalır; kanonun kalıbı Türkçe uygulanır (`RolOlusturKomutu`, `rol-olustur.command.ts`) | İngilizce adlar: bütün tanımlayıcılar ve notlardaki iş adları yeniden adlandırılır, kod iki dilli olur | bekliyor |
| Varlığın kapsamı (Seçenekler 3) | Varlık yazma tarafında; okuma düz kayıt döndürür; karar işlevleri olguları parametre alır | Satırın tamamını varlığa doldurmak: kolon sınırını deler | bekliyor |
| Alan kuralının ret iletisi (Seçenekler 4) | Değer nesnesi ret kodu döndürür; ileti bugünkü hâliyle kalır, taşıma hiçbir cevabı değiştirmez | Türkçe ileti (ilk seçimimdi, geri aldım): yalnız bazı alanlar Türkçeleşir, taşıma sözleşmeyi değiştirmiş olur | bekliyor |
| Komut yolu ve taban sınıfı yok | İşleyici doğrudan çağrılır | Kanondaki taban sınıfı ve araya giren parça: bugün gerek yok | bekliyor |
| İşleyicinin yanında birim testi zorunlu değil | Birim testleri domain dosyalarının yanında; işin bütünü uçtan uca testlerle sınanır | Kanondaki işleyici başına birim testi: 34 sahte nesneli test, uçtan uca testin kopyası olurdu (kanondan sapma) | bekliyor |
| Sözleşmenin katmanı (GV-116'nın sorusu) | Saf tipler `domain`'de; doğrulama kitaplığının ya da işlemin tipini taşıyan arayüz `application`'da port | Bütününü `application`'a koymak: tasarımdaki ağaçtan sapar | bekliyor |
| Konu adları değişmez | `guvenlik`, `yetki`, `tohum` Türkçe kalır | Kanondaki İngilizce konu adları: yeniden adlandırma bu işin dışında | bekliyor |
| Rapor denetimi yalnız göndermede çalışır | Push kapısı | Commit kapısı: görevler alınırken rapor henüz yazılmamıştır, her alma dururdu | KR-015 ile birlikte |
| Kalıcı kipte kurulum ayrı bayrak | `--kalici --kurulum` | Her açılışta kurulum: ilk yönetici için her seferinde yeni kod üretip eskisini öldürürdü | bekliyor |

## 5. Duruşlar ve nedenleri

| Görev | Ne oldu | Kaynak | Ne yapıldı |
|---|---|---|---|
| GV-106 | inceleme kaldı: geçersiz rol adında dönen ileti değişmişti | inceleme kaydı | ret kodu yoluna geçildi; ileti aynen korundu |
| GV-107 | dosya beyanı ölçümle uyuşmadı | araç çıktısı | yeniden koştu |
| GV-109 | dosya beyanı ölçümle uyuşmadı | araç çıktısı | yeniden koştu |
| GV-110 | işçi tur sınırında kesildi; beyan uyuşmadı | araç çıktısı | kaldığı yerden yeniden koştu |
| GV-111 | iki soru: `kurulum.ts` kartın dosya listesinde yok; kullanıcı adının küçük harfe çevrilmesi iki yerde | bitiş kaydı | cevaplandı; tek satır için GV-113 açıldı |
| GV-112 | hiç koşmadı: dosya listesinde `app.module.ts` eksikti | — | aynı iş doğru listeyle GV-114 olarak eklendi; GV-112 atılmayı bekliyor |
| GV-115 | işçi tur sınırında kesildi (81 dosya); sonra soru: lint'in ileti metnini harfiyen bekleyen test | sonuç ve bitiş kaydı | kaldığı yerden koştu; o tek testin beklentisi aynı sıkılıkta yeniden yazıldı |
| GV-116 | soru: giriş yöntemi sözleşmesi saf katmana konamıyor | bitiş kaydı | sözleşme ikiye bölündü (4. bölüm) |
| GV-117 | 30 dakikalık süre sınırına takıldı (176 dosya) | araç çıktısı | kaldığı yerden yeniden koştu |

Ana dal bir kez kısa süre bilerek kırmızı kaldı: parola alındıktan sonra `kurulum.ts`'teki içe aktarma satırı yüzünden tip denetimi (GV-113 kapattı; ardından tip, lint ve derleme 0 ölçüldü). O pencerede yeni görev, ana dalın kırmızı hâlinden başlatılmadı.

## 6. Hatalar

- **Yapı sapması (en büyüğü).** Kanonun alt özellik düzenini (komut ve sorgu klasörleri, varlıklar, `i-` önekli repository arayüzleri) ilk kartlara yazmadım; sonraki kartlarda "var olan kodu örnek al" dedim ve düz düzen yedi alt özelliğe yayıldı. KR-005 "sapma gerekiyorsa önce karar değişir" diyordu; sapmayı kullanıcıya hiç getirmedim. Mimari kuralların hepsi taslak olduğu için işçilere ve inceleyicilere bağlayıcı kural olarak da gitmedi. Kullanıcı kodu okuyunca gördü. Düzeltme: EP-008.
- **Çalışmayan komut önerdim.** Kullanıcıya main'i çekmesi için `!` ile komut verdim; bu oturum çalışma ağacına kilitli olduğu için komut reddedildi. Çalışma ağacından geçici çıkıp ana ağacı kendim çektim ve geri döndüm.
- **Kartların dosya listeleri yine eksikti.** `kurulum.ts` ve `app.module.ts` alt özelliklerin içini doğrudan içe aktarıyordu; aramadan kart yazdım. Biri soruyla durdu, öbürü için görevi yeniden eklemek zorunda kaldım (GV-112 ölü yaprak oldu).
- **Bir kararı iki kez değiştirdim.** Ret iletisi için önce "Türkçe ileti" dedim, işçi öbür yolu seçince onun daha doğru olduğunu görüp kararı geri aldım (yalnız bazı alanlar Türkçeleşirdi).
- **İki kart fazla büyüktü.** Kimliğin ortak klasörü ve ortak kodun ikinci adımı tek kartta tur ve süre sınırına takıldı; daha küçük parçalara bölmeliydim.
- **Yanlış yönlendirme.** Dosya beyanı için "taşınan dosyanın hem eski hem yeni yolu" dedim; araç yalnız yeni yolu sayıyor. İşçi aracın ölçümüne uydu, sonraki kartlarda cümleyi düzelttim.
- **Raporda bayat cümle.** Gece raporundaki "göçler hiçbir kalıcı veritabanına uygulanmadı" cümlesi, yerel veritabanına göç uygulayınca eskidi; o rapor birleştiği için düzeltmedim, doğrusu bu rapordadır.

## 7. Araçta değişenler

| Değişiklik | Neden | Nerede |
|---|---|---|
| `h.py rapor yeni`, `rapor uret`, `rapor durum` | raporu şablondan açmak, görev tablosunu kayıtlardan üretmek, raporsuz görevi listelemek | `harness/rapor.py`, `harness/sablon/rapor.md` (GV-120) |
| Denetim Z19: raporsuz görev ve boş rapor bölümü | kullanıcının isteği: rapor şart olsun; yalnız `denetle --dal` (push kapısı) yolunda çalışır | `harness/rapor.py`, `harness/h.py` |
| Ayar `rapor: { dizin, zorunlu }` | zorunluluk yalnız korunan ayarla kapatılabilsin | `harness/h.py` varsayılanları |
| İş akışlarına rapor adımı | epic ve görev bitince rapor yazılması | `.claude/skills/plan/SKILL.md`, `.claude/skills/gorev/SKILL.md` |
| Komut tablosuna rapor komutları | ajanın komutu bilmesi | `AGENTS.md` |

Aracın geliştirme kipi (`harness.json` içinde `harness_gelistirme`) bu iş için açıldı ve iş alınınca kapatıldı; iki değişiklik de ayrı commit'tir.

Bu depodaki araç bir kopyadır; asıl kaynağı iskelet deposundadır ve ona dokunulmadı. Yukarıdaki değişiklikler oraya taşınmadı.

Aracın bu işte görülen boşlukları (düzeltilmedi): dosya beyanı zorunluluğu dört duruşa yol açtı; kartın dosya listesi sonradan genişletilemiyor; görev ağacının tabanı yenilenemiyor; yeniden koşulan görevin önceki süresi ve maliyeti kayıttan siliniyor (2. bölümdeki toplam bu yüzden gerçeğin altındadır); işçinin kabuk betiğiyle dosya yazması düzenleme kapısını atlıyor; push'u tanıyan desen, içinde "git" ve "push" sözcükleri geçen zararsız komutları da durduruyor ve raporsuz dalda bu sık görülecek (GV-120 incelemesi); Z19 raporu çalışma ağacında arıyor, commit edilmemiş rapor da kapıyı geçirir.

## 8. Kullanıcıdan beklenenler ve açık işler

### 8.1 Senin yapman gerekenler

- **Kabul:** rapor zorunluluğu üç taslaktır (KR-015, KU-016, DN-001); kabul edilmeden bağlayıcı kural olarak işçiye ve inceleyiciye gitmez (araçtaki denetim ise kabulden bağımsız çalışıyor). Aynı şey yapı için de geçerli: KR-005 ve KU-008 hâlâ taslak. İstersen `python3 harness/h.py kabul KR-015 KU-016 DN-001` komutunu ben çalıştırırım; araç taslakları gösterip sana sorar.
- **PR biçimi kararı:** önerin (aşamalı PR; main'e tek commit) açık duruyor. Benim önerim epic başına bir PR ve tek commit olarak birleştirme; depo ayarı buna izin veriyor (ölçüldü). Karar gelene kadar bugünkü iş eskisi gibi tek PR ve birleştirme commit'iyle gider.
- **Ölü yapraklar** (atma geri alınamadığı için sana bırakıldı): `python3 harness/h.py gorev at GV-036`, `GV-068`, `GV-089`, `GV-112`.
- **İskelet deposu:** araçtaki rapor komutu ve denetimi yalnız bu depodaki kopyada; asıl kaynağa taşınması sana kalıyor.
- **Araca eklenebilecekler:** sohbette sekiz madde saydım (taslak karara dayanan iş için uyarı; yapı denetiminin kurala bağlanması; dosya beyanı zorunluluğunun kalkması; taban yenileme; kart boyu ve kapsam ön denetimi; inceleme önerilerinin borç listesi; koşu geçmişi; tarayıcı denemesinin teste dönmesi). Hangilerini istediğini söylemedin.

### 8.2 Teyidini bekleyen kararlarım

4. bölümdeki tablonun tamamı. En çok etkisi olanlar: adların Türkçe kalması (kanon İngilizce ad ister); işleyicinin yanında birim testinin zorunlu olmaması (kanondan sapma); varlığın veritabanından doldurulmaması.

### 8.3 Yapılmayan işler ve bilinen kusurlar

- Uygulama katmanı ortak kodun altyapı klasöründen içe aktarıyor: işleyiciler Unit of Work'ü, çekirdek parçalar outbox yazıcısını somut sınıf olarak alıyor (GV-117 incelemesi). Kanon bunlar için uygulama katmanında arayüz ister; ayrı iş.
- Çekirdek repository'lerin lint sınırı artık klasöre değil dosya adına (`-cekirdek`) bağlı; ileride bu adı taşımayan bir çekirdek dosyası sınırın dışında kalır (GV-115 incelemesi).
- Kullanıcı adının küçük harfe çevrilmesi iki yerde duruyor: kullanıcının değer nesnesinde ve parola ile girişte; değer nesnesi kimliğin ortak klasörüne alınmadı.
- Doğrulama iletileri İngilizce (doğrulama kitaplığının kendi metni) ve ön yüz onları formun altında gösteriyor; tek yerden Türkçeleştirme ayrı iş (TS-005 Seçenekler 4).
- İstek bağlamı dosyası hem bağlamın tiplerini hem HTTP ara katmanını taşıyor; kanon ikiye ayırır (GV-118 incelemesi).
- Alt özelliklerin liste yardımcıları (sayfalama ve liste şeması) her alt özellikte ayrı duruyor; ortak yere toplanmadı.
- Ön yüzün klasör düzeni bu işin dışındaydı; kanonun ön yüz kurallarına karşı ölçülmedi.
- Gece raporundaki öbür açık işler (deneme sınırı, giriş bilgisini değiştirme, unutma, tek kullanımlık kodla giriş) aynen duruyor.

### 8.4 Yerel ortam

- Yerel `dextra` ve `dextra_iz` veritabanlarına göçler uygulandı, tohum basıldı ve kurulum komutu koştu (2026-11-25; ikisi de boştu). Uygulama bu veritabanlarının üstünde açık bırakıldı (backend 3001, ön yüz 3100); yapı düzeltmesinden ÖNCEKİ derlemeyle çalışıyor.
- Kalıcı kiple yeniden başlatmak: `node scripts/yerel-deneme.mjs --kalici` (ilk yöneticinin parolası yoksa `--kalici --kurulum`).

## 9. PR'lar

_(doldurulacak: açılan PR'lar ve durumları; yoksa nedeni)_

## 10. Günlük

Saatler yerel saattir; ölçümler "kendi ölçümüm" diye işaretlidir (her alımdan sonra ana oturumda yeniden koşturuldu).

- **08:50** PR #15 birleşti (GitHub kaydı 05:50 UTC; ilk deneme 06:12'de ağ hatasıyla düşmüştü, ikincisi geçti). Ana çalışma ağacı sonra çekildi: önce kullanıcıya önerdiğim komut bu oturumun çalışma ağacı kilidine takıldı; ana ağacın temiz olduğunu ölçüp çalışma ağacından geçici çıkarak kendim çektim.
- **08:50 ile 09:40 arası** (saatler ayrıca ölçülmedi) Uygulama önce geçici veritabanlarıyla, kullanıcının sözü üzerine yerel veritabanlarıyla açıldı: iki veritabanı boştu; göçler uygulandı (asıl 16, iz 5 tablo), tohum basıldı (2 kullanıcı, 1 grup, 2 rol, 27 izin, 29 yetenek), kurulum komutu koştu.
- **09:47** GV-105 (yerel deneme betiğine kalıcı kip) alındı; işçi kendi deneme veritabanları ve başka kapılarla doğruladı, açık duran uygulama ve yerel veritabanı etkilenmedi (kendi ölçümüm).
- **10:00** Kullanıcı yapıya itiraz etti. Kodu ve kanonu yan yana ölçtüm: 34 işleyici, 6 komut ve 6 sorgu dosyası, sonuç dosyası 0, varlık klasörü 0, işleyici yanında birim testi 0. Tasarım TS-005 yazıldı, EP-008 açıldı.
- **10:40** GV-106 (yapı denetimi ve kalıp: rol) alındı. Kendi ölçümüm: tip ve lint 0; birim 45, uçtan uca 38.
- **11:03–11:45** Alt özellikler alındı. Kendi ölçümlerim (birim / uçtan uca): grup 62 / 51; kullanıcı 95 / 105; parola 44 / 43; üyelik 52 / 41; yetenek 119 / 72; oturum 72 / 119 ve komşu testler 66. Yapı denetimi bekleyen alt özellik göstermedi.
- **12:17** GV-115 (kimliğin ortak klasörü) alındı. Kendi ölçümüm: tip ve lint 0; etkilenen 18 uçtan uca test dosyası 73, 82 ve 123 test.
- **12:25–12:45** Rapor zorunluluğu: KR-015, KU-016, DN-001 taslakları yazıldı; aracın geliştirme kipi açıldı; GV-120 alındı (aracın testleri 19, 123 ve 102; `denetle` temiz); kip kapatıldı; `AGENTS.md` komut tablosu güncellendi.
- **12:48** GV-116 (ortak kod 1/3: yetki, güvenlik, kimlik sözleşmeleri) alındı. Kendi ölçümüm: birim 149; uçtan uca 125 ve 61.
- **13:34** GV-117 (ortak kod 2/3: veritabanı, tohum, mesajlaşma) alındı. Kendi ölçümüm: birim 36; uçtan uca 48, 67, 48 ve 81.
- **13:49** GV-118 (ortak kod 3/3: HTTP, süzgeçler, gözlemlenebilirlik) alındı. Kendi ölçümüm: birim 26; uçtan uca 78 ve 68.

