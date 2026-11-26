---
kimlik: TS-009
tur: tasarim
durum: kabul
surum: 1
baslik: Aracın sertleştirilmesi ve işçiye yazılım yetenekleri: kapılar, skill'ler ve süreklilik
agirlik: cift-yonlu
tarih: 2026-11-26
---
Aracın (harness) kapılarındaki ölçülmüş açıklar kapatılır, kod yazan işçiye ve inceleyiciye bugün ellerinde olmayan yazılım yetenekleri proje skill'i olarak verilir ve oturum kaybında konuşmada kalan kararlar kayda bağlanır; amaç, kod tabanının düzeltme ve güçlendirme işine (2. faz) daha sıkı bir araçla ve daha yetenekli bir işçiyle girmektir.

## Sorun
Kullanıcı (2026-11-26, kendi sözleri): "harness için https://github.com/mattpocock/skills şuraya bi baksana işe yarar şeyler var burada"; "adhd skill'i de var ona da bakalım"; "obranın superpowers'a da bakalım"; "skills da bazı yazılım için yetenekler var ilk harness'i serleştirip düzeltpit sonrasında codebase tarafına geçerken de hem düzeltmeleri hemde gerekli yeni güçlendirmeleri yazmamız lazım frontta mesela ne tasarım var ne bir şey var". Ana oturumun on beş maddelik birinci faz listesine cevabı: "tamam".

Ölçülenler (2026-11-26; "doğrulandı" denenlere ana oturum koda kendisi baktı, kalanı keşif oturumlarının okumasıdır):
- İşçi oturumu yalnız projenin ayarlarını yükler (`harness/gorev.py:916`, `--setting-sources project,local`); kullanıcının kişisel eklentileri ona gitmez. Görev kartı işçiyi tek bir yazılım skill'ine yollar: `hata-ayikla` (`gorev.py:55`). Test yazımı, kod tasarımı, inceleme ve ön yüz tasarımı için proje skill'i yoktur (doğrulandı).
- İnceleme kapısı sonucu yalnız genel hükme, engel bulgusuna ve "uymuyor" kural hükmüne bakarak verir (`gorev.py:1245-1247`). İnceleme şablonundaki ölçüt alanı (`gorev.py:144`) zorunlu alanlar arasında değildir (`gorev.py:40`) ve hiçbir yerde okunmaz (doğrulandı).
- İnceleme kaydının doğrulayıcısı `kosulan` alanının liste olmasına bakar, boş olmasına bakmaz (`gorev.py:676-704`): hiçbir komut koşturmamış inceleme geçerli sayılır (doğrulandı).
- Git kapıları yalnız zincir denetimini koşturur (`harness/hook/git/pre-commit`, `pre-push`); kapıda koşan tek komut denetimi yapı denetimidir (DN-002). Lint ve tip denetimi hiçbir kapıda koşmaz, depoda sürekli tümleştirme de yoktur (doğrulandı; KU-007/AU-2 bunu açık uç olarak taşır).
- 2026-11-26'da `gorev kos` hazırlık adımında `pnpm` yolda olmadığı için Python dökümüyle çıktı; aynı gün bir inceleme Docker kapalıyken koştu ve veritabanı isteyen testleri koşturamadı (`docs/rapor/2026-11-26-yasak-kurali-yetenekte-etki-ve-oncelik-ep-012.md`, 7. ve 8. bölüm).
- Elle başlatılan iki görev aynı dosyaya dokundu; kesişim denetimi yalnız plan yürütmesinde vardır (`docs/rapor/2026-11-24-gece-raporu.md:259`; doğrulandı).
- İşi yürüten ana oturum 2026-11-26 11:16'da makine yeniden başlayınca yerelde konuşma kaydı bırakmadan kapandı. İş görev kayıtlarından devralındı ve rapor "konuşmada geçip bu kayıtlara yazılmamış bir karar varsa bu raporda yoktur" notuyla yazıldı (aynı rapor, 1. bölüm).
- `kavram` düğüm türü tanımlıdır (`harness/h.py:34`) ama hiç düğümü yoktur; kural paketi yalnız kural taşır (`h.py:1099`). Rol paketleri 1190 ile 2006 karakter arasındadır, bütçe 6000'dir (ölçüldü).
- `harness.json` içinde `gorev.onay` "yok"tur; AGENTS.md kural 7 "tek başına koşturulan görevde koşturma, alma ve atma sorulur" der (doğrulandı; TS-006'nın ajan kararı, ayar kapalıyken sorulmadığını yazar).
- Kullanıcının makinesinde süreç eklentisi (superpowers 6.3.0) kullanıcı düzeyinde kuruludur: ana oturuma her oturum başında yüklenir, işçiye gitmez. Keşif oturumu, eklentinin araçla aynı işe farklı talimat verdiği dokuz çift saydı (ana oturum saymadı).
- Ön yüzde tasarım değişkeni ve bileşen kütüphanesi yoktur: `frontend/src/app/globals.css` tek satırdır, `frontend/src/shared/ui` üç dosya ve 81 satırdır; TS-004 tasarım dili söylemez (doğrulandı).

Okunan dış kaynaklar (2026-11-26; hiçbiri çalıştırılmadı ve kurulmadı): `mattpocock/skills` (MIT), `obra/superpowers` 7.0.2 (MIT), `uditakhourii/adhd` (MIT), `anthropics/skills` içinden `frontend-design` (Apache-2.0).

- Amaç: aşağıdaki "Yapı"daki on beş davranış.
- Kapsam dışı: kod tabanının düzeltme ve güçlendirmeleri (ikinci faz; ayrı tasarım kayıtları). Ön yüzün görsel yönü ve tasarım sistemi (ikinci fazın ilk kararı; tek yönlüdür, ilk taslağını kullanıcı yazar). İskelet deposu (aracın asıl kaynağı; bu depodaki kopya değişir, taşıma kullanıcınındır). Dış depolardan kod ya da paket kurmak. adhd'nin çok ajanlı düzeneği. Süreç eklentisinin yürütme skill'leri.
- Başarının ölçüsü: araçtaki her davranışın (1, 2, 4, 5, 12, 13) aracın kendi testlerinde kırmızı ve yeşil örneği vardır ve var olan araç testleri değişmeden geçer. Her yetenek (7 … 11) için skill dosyası vardır, görev kartı ya da inceleme istemi ona yollar ve inceleme kaydında ölçülen bir alan onun sonucunu taşır.

## Kısıtlar
- Araç yalnız Python standart kitaplığını kullanır; yeni bağımlılık eklenmez.
- Aracın kodu yalnız `harness.json` içindeki geliştirme kipi açıkken düzenlenir; kip iş boyunca açık, iş bitince kapalıdır ve iki değişiklik de ayrı commit'tir.
- Kabul edilmiş kurallar değişmez (KU-001 … KU-006, KU-016): onay soruları atlatılmaz, işaret ve ölçüm kaydı elle yazılmaz, iş incelenmeden alınmaz.
- Var olan komutların çıktı biçimi ve çıkış kodları, aşağıda adı geçenler dışında değişmez. Alınmış görevlerin eski inceleme kayıtları yeniden doğrulanmaz; yeni zorunlu alan yalnız yeni incelemelerde aranır.
- İşçi yalnız proje skill'lerini görür: yetenek `.claude/skills/` altında, Türkçe ve var olan skill'lerin biçiminde (ne zaman, ne zaman değil, adımlar, yapma, sınırlar) yazılır.
- Kural paketi bütçesi 6000 karakterdir (`harness.json`, `butce.paket_karakter`); pakete giren her yeni blok bu bütçeyi paylaşır.
- Dış kaynağın metni kopyalanıp skill yapılmaz: fikir Türkçeye ve bu deponun kurallarına uyarlanır; kaynağı ve lisansı skill dosyasının sonunda anılır.

## Yapı
Davranışlar üç öbektir; numaralar kullanıcının onayladığı listedeki numaralardır.

**Kapı düzeltmeleri**

1. **Ölçüt hükmü kapıda.** İnceleme kaydında `olcut` alanı zorunlu olur: `karsilandi` (doğru ya da yanlış) ve `kanit` (dosya ve satır ya da koşturulan test). `karsilandi` yanlışsa, genel hüküm "geçti" olsa da sonuç "kaldı"dır. `karsilandi` doğru ama kanıt boşsa kayıt geçersizdir ("kanıtsız ölçüt"). Görev durumu ve inceleme özeti ölçüt hükmünü kural hükümlerinden ayrı satırda gösterir.
2. **Kanıtsız inceleme geçmez.** Hükmü "geçti" olan incelemenin `kosulan` listesi boş olamaz; boşsa kayıt geçersizdir ("hiçbir şey koşturulmadı").
3. **Lint ve tip denetimi kapıda.** Arka yüz ve ön yüz için lint ve tip denetimi, komut denetimi düğümleri olarak yazılır (DN-002 kalıbı) ve mekanik kurala bağlanır: lint denetimi KU-007'ye (KU-007/AU-2'nin cevabı: evet), tip denetimi yeni bir kural taslağına ("derleyici hatası olan dal gönderilmez"). Kabul edilince push kapısında koşarlar. Süreleri ilk koşuda ölçülür ve denetim düğümüne yazılır. Düğümleri ana oturum yazar, kabulü kullanıcı verir; araçta kod değişmez.
4. **Ortam ön kontrolü.** `gorev kos` ve `gorev incele`, oturumu başlatmadan önce ortamı sınar. Hazırlık komutunun çalıştırılabiliri yolda yoksa araç döküm vermez: neyi aradığını ve yolu söyleyip durur, koşu geçmişine "ortam" sonucuyla yazar. `harness.json` içindeki `gorev.on_kontrol` listesindeki komutlar (örnek: veritabanı kapısı açık mı) sırayla koşar; biri başarısızsa oturum başlamaz ve hangisinin kaldığı yazılır. Yola eklenecek klasörler, depoya girmeyen yerel ayar dosyasından okunur.
5. **Elle başlatılan görevde kesişim.** `gorev kos`, o anda koşan başka bir görevin yollarıyla kesişen görevi başlatmaz ve kesişen görevi adıyla söyler; denetim plan yürütmesindekiyle aynıdır (`plan.py`, `_kesisir`).
6. **Onay metni ile ayar aynı şeyi söyler.** AGENTS.md kural 7 ile `gorev.onay` ayarı çelişmez; hangisinin değişeceği kullanıcının kararıdır (AU-1).

**Yazılım yetenekleri**

7. **Test yazımı (`test-yaz` skill'i).** İçerik: önce başarısız test yazılır ve kırmızı görülür, sonra onu geçiren en az kod yazılır; test davranışı açık arayüzden sınar, iç ayrıntıdan değil (testin durduğu sınır önceden seçilir); beklenen değer kodun hesabından değil bağımsız bir kaynaktan gelir (kendini doğrulayan test yazılmaz); "tabloda ya da listede tam olarak şunlar var" sınaması yazılmaz (üç kartta sorun çıkardı: 2026-11-24 ve 2026-11-25 raporları); testlerin hepsi önce, kodun hepsi sonra yazılmaz (bir test, bir uygulama, yinele). Görev kartı işçiyi bu skill'e yollar. Bitiş kaydı yeni testleri ve kırmızının görüldüğü çıktı satırını taşır (`testler` alanı). İnceleyici yeni testi kendisi koşturur ve "test davranışı mı sınıyor" sorusuna bulguyla cevap verir.
8. **Hata ayıklama güçlenir.** `hata-ayikla` skill'ine eklenir: hatayı yakalayan tek komut (hızlı, her koşuda aynı sonucu veren, belirtinin kendisini sınayan) yazılmadan açıklama üretilmez; çalışan bir örnekle karşılaştırılır; belirtide değil kaynağında düzeltilir; düzeltmeden önce o hatayı yakalayan test yazılır ve uygun sınır yoksa bu bitiş kaydına bulgu olarak yazılır; ayıklama için eklenen geçici günlük satırları etiketlenir ve bitişte temizlenir; üç denemede durulduğunda bitiş kaydına "yaklaşım ya da yapı yanlış olabilir mi" sorusunun cevabı yazılır.
9. **İnceleme güçlenir.** İnceleme istemine eklenir: ölçüt ve kurallar iki ayrı eksendir ve ayrı hüküm alır (1. davranış); kısa bir koku listesi (tekrar eden kod, gereksiz genelleme, yalnız aktaran aracı parça, birlikte dolaşan veri öbeği, ilkel tiple taşınan alan kavramı, ne yaptığını söylemeyen ad) yalnız "öneri" bulgusu üretir, engel olmaz; `bakilmayan` alanı inceleyicinin bakmadığı ya da koşturamadığı şeyleri taşır. `gorev` skill'ine adım eklenir: ana oturum, kalan incelemenin bulgusunu işçiye iletmeden önce koda karşı doğrular.
10. **Kod tasarımı (`kod-tasarimi` skill'i) ve mimari taraması (`mimari-tara` skill'i).** `kod-tasarimi`: ortak sözlük (modül, arayüz, derinlik, dikiş, bağdaştırıcı, kaldıraç, yerellik) ve silme testi ("bu parçayı silersem karmaşıklık bir yerde toplanır mı, yalnız yer mi değiştirir"); işçi yeni parça eklerken ve inceleyici soyutlamayı değerlendirirken kullanır. `mimari-tara`: ana oturumun elle çağırdığı salt okuma taramasıdır; son dönemde sık değişen yerlere ağırlık verir, adayları (dosyalar, sorun, öneri, güç: güçlü, araştırmaya değer, spekülatif) listeler; kullanıcı seçer, seçilen aday `tasarla` ile sürer. Kabul edilmiş kararla çelişen aday ancak sürtünme gerçekse ve işaretlenerek yazılır.
11. **Ön yüz tasarımı (`on-yuz-tasarimi` skill'i).** Kaynak: `anthropics/skills` içindeki `frontend-design`. İçerik: koddan önce tasarım planı (4 ile 6 adlı renk değeri, yazı ailesi ve ölçeği, yerleşim, ilkeler); planın işin tanımına karşı gözden geçirilmesi; kalite tabanı (dar ekran, görünür klavye odağı, azaltılmış hareket, yeterli karşıtlık); boş, yükleniyor ve hata durumlarının her ekranda tasarlanması; arayüz metni (eylemin adı akış boyunca aynı kalır; hata ne olduğunu ve nasıl düzeleceğini söyler). Projenin tasarım sistemi (değişkenler ve bileşen seti) ikinci fazda kullanıcının görsel yön kararıyla yazılır; skill o belgeye yollar ve belge yokken işçi yeni görsel karar almaz, soruyla durur.
12. **Ortak sözlük.** `kavram` düğümleri yazılır: terim, bir ya da iki cümlelik tanım, kullanılmayacak eş anlamlılar; uygulama ayrıntısı yazılmaz. Rol paketine "Sözlük (bilgi)" bloğu olarak girer: yalnız kartın konusuna düşen terimler girer ve blok paket bütçesini aşamaz (aşarsa `denetle` kırmızıdır). İlk terimleri ana oturum taslak olarak yazar, kabulü kullanıcı verir; taslak terim pakete girmez.

**Süreklilik**

13. **Söz defteri.** Kullanıcının her iletisi ve soru aracına verdiği her cevap, kanca tarafından zaman damgasıyla kendiliğinden bir deftere yazılır. Defter ana çalışma ağacının `.harness/soz/` klasöründe durur (görev kayıtlarının durduğu yer): kancanın bugünkü olay defteri çalışma ağacının kendi `.harness/defter/` klasöründedir ve 2026-11-26'da çalışma ağacı silinince onunla birlikte silindi. `rapor yeni`, raporun "Kullanıcının verdiği kararlar" bölümüne bu defterden ham listeyi koyar; ana oturum ayıklar. Aynı çalışma ağacında açılan yeni oturum, önceki oturumun son kayıtlarını oturum başı özetinde görür.
14. **Soru önerilen cevapla sorulur; seçenek için bakış açıları.** Tasarım protokolünün konuşma kurallarına eklenir: her soru önerilen cevabı ve gerekçesiyle sorulur (tek soru kuralı aynen kalır); ortamdan öğrenilebilecek olgu kullanıcıya sorulmaz, karar kullanıcıya sorulur. Protokolün 7. adımına seçenek üretirken denenecek bakış açıları eklenir: tersine çevir, yük taşıyan varsayımı kaldır, sıfır bütçe ve bir saat, sınırsız bütçe ve on yıl, gece üçte nöbetçi, denetçi, sistemi kırmaya çalışan rakip, on yaşında bir çocuk, başka bir alandan bak (lojistik, biyoloji, oyun tasarımı, piyasa).
15. **Süreç eklentisinin yeri.** Eklentinin bu depoda açık kalıp kalmayacağı kullanıcının kararıdır (AU-2). Kapatılırsa yalnız bu depo için kapatılır ve skill'lerdeki "süreç eklentisi" göndermeleri kaldırılır; açık kalırsa AGENTS.md'ye "çelişkide bu deponun kuralı geçerlidir" cümlesi ve çelişen çiftlerin listesi yazılır.

### Ajan kararları
- AK-1 Hükmü "geçti" olan inceleme her işte en az bir koşturulan komut ister: yalnız belge ya da bilgi tabanı değiştiren işte de koşturulacak bir komut vardır (zincir denetimi). İstisna tanınırsa kanıtsız inceleme aynı kapıdan geri girer.
- AK-2 Koku listesi yalnız öneri üretir ve inceleme başına en çok üç koku önerisi yazılır: son raporda tek seferde 34 öneri çıktı; sınırsız liste öneri hacmini büyütür, kapıya etkisi olmaz.
- AK-3 İki eksen için ikinci inceleme oturumu açılmaz; tek oturum iki ayrı hüküm verir: son raporda bir inceleme 4,2 ile 32,3 dakika sürdü, ikinci oturum her görevde bu bedeli ikiye katlar.
- AK-4 Kesişen elle başlatılmış görev reddedilir; "yine de koştur" bayrağı eklenmez: bekleyip yeniden koşturmak yeter, bayrak kapıyı alışkanlıkla deldirir.
- AK-5 Yola eklenecek klasörler depoya girmeyen yerel ayar dosyasından okunur (`harness.yerel.json`, `.gitignore` içinde): kişinin makinesine özgü yol ortak ayara yazılmaz.
- AK-6 Devir belgesi skill'i alınmaz; yerine kancanın yazdığı söz defteri gelir: devir belgesini ajan yazar ve oturum beklenmedik kapanınca yazılmamış olur; defter ajanın hatırlamasına bağlı değildir.
- AK-7 Söz defteri kullanıcının iletisini olduğu gibi yazar ve git'e girmez (`.harness/` yok sayılır): özetlenmiş kayıt, kaybolan şeyin (kullanıcının kendi sözü) yerini tutmaz. İçinde kişisel veri ya da sır geçebileceği AU-3'te kullanıcıya sorulur.
- AK-8 adhd'nin çok ajanlı düzeneği ve paketi alınmaz; yalnız bakış açısı listesi fikir olarak alınır: varsayılan koşu 11 model çağrısıdır ve kanıtı zayıftır (6 problem, tek koşu, problemleri yazarı seçmiş, hakem aynı model ailesinden).
- AK-9 Silme testi katman sınırına uygulanmaz, katmanın içindeki parçalara uygulanır: KU-008'in katmanları zorunludur ve çoğu arayüzün tek gerçeklemesi vardır; test katmana uygulanırsa kabul edilmiş kuralla çelişir.
- AK-10 Lint ve tip denetimi komutları `pnpm` kullanmaz (TS-006'daki DN-002 kararıyla aynı gerekçe: kapı, `pnpm`'in yolda olmadığı kabukta da koşabilmelidir).
- AK-11 Okunan dış skill dosyaları, lisans dosyalarıyla birlikte `kb/_gelen/skills/` altına değiştirilmeden kopyalanır (kanon belgelerindeki yöntem): işçi ve inceleyici birincil kaynağı okuyabilsin. Yalnız bu tasarımın kullandığı dosyalar alınır.
- AK-12 Yeni skill adları Türkçedir ve var olanların biçimindedir: `test-yaz`, `kod-tasarimi`, `mimari-tara`, `on-yuz-tasarimi`.
- AK-13 `mimari-tara` çıktısını konuşmaya ve geçici bir dosyaya yazar, depoya yazmaz: seçilen aday tasarım kaydına dönüşür, seçilmeyenler depoda bayatlamaz.

## Seçenekler
### 1. Yetenek işçiye nasıl verilir
- A (seçildi; kullanıcı, 2026-11-26: "tamam") — Skill öğretir, kapı ölçer: yetenek proje skill'i olarak yazılır ve sonucu inceleme kaydında ölçülen bir alana bağlanır. Kazanç: işçi skill'i okumasa bile eksik kanıt kapıda yakalanır. Bedel: her yetenek için hem metin hem denetim yazılır, kart ve inceleme kaydı uzar.
- B — Yalnız kural: yetenek kural düğümü olarak pakete girer. Bedel: paket bütçesi (6000 karakter) dolar; kural nasıl yapılacağını öğretmez ve kanıtı yoktur.
- C — Süreç eklentisi işçiye de yüklenir. Bedel: işçi yalnız proje ayarını yükler (bilinçli seçim); eklentinin yürütme skill'leri aynı oturumda alt ajanla uygulama ve yazarın kendi incelemesini önerir, bu KU-004 ile çelişir.

### 2. Oturum kaybına karşı
- A (seçildi; ajan) — Kancanın yazdığı söz defteri. Kazanç: ajanın hatırlamasına bağlı değildir. Bedel: defter ham sözdür, rapora girerken ayıklanması gerekir.
- B — Ajanın yazdığı devir belgesi. Bedel: beklenmedik kapanışta yazılmamış olur; 2026-11-26'da yaşanan tam olarak buydu.
- C — Hiçbir şey; görev kayıtları ve rapor yeter. Bedel: konuşmada verilip kayda girmeyen karar kaybolur.

### 3. İncelemede iki eksen
- A (seçildi; ajan) — Tek oturum, iki ayrı hüküm; ölçüt hükmü kapıda ayrıca okunur. Bedel: aynı oturum iki eksene bakar, biri öbürünün dikkatini bölebilir.
- B — Her eksen için ayrı inceleme oturumu. Bedel: görev başına ikinci oturumun süresi ve parası.

## Aşamalar
Araç kodu aynı dosyalara dokunduğu için o görevler art arda koşar; skill dosyaları birbirinden bağımsızdır. Sıra: (1, 2) inceleme kapısı · (9) inceleme istemi · (4) ortam ön kontrolü · (5) kesişim · (13) söz defteri · (12) sözlüğün pakete girmesi · (7) test yazımı · (8) hata ayıklama · (10) kod tasarımı ve mimari taraması · (11) ön yüz tasarımı · (14) protokol metni. Ana oturumun işleri: dış kaynakların `kb/_gelen/skills/` altına alınması (ilk iş), (3) denetim düğümleri ve kural taslağı, (12) ilk kavram düğümleri. Kullanıcı kararını bekleyenler: (6) ve (15).

## Doğrulama
- Araç koduna dokunan her görev aracın test klasörüne kendi testini ekler; her davranışın en az bir kırmızı ve bir yeşil örneği vardır.
- Var olan araç testleri (`harness/test/` altındaki dosyalar) her görevden sonra dosya dosya koşturulur ve geçer.
- Her yeni skill için: dosya vardır, görev kartı şablonu ya da inceleme istemi adını anar, ve skill'in istediği kanıt alanı bitiş ya da inceleme kaydının zorunlu alanları arasındadır.
- Lint ve tip denetiminin süresi ilk koşuda ölçülür ve denetim düğümüne yazılır.
- Her görev alındıktan sonra ana oturum bu depoda `denetle`, `gorev durum` ve `rapor durum` komutlarını koşturur.
- Birinci fazın sonunda bir sonraki gerçek görev (ikinci fazın ilk kartı) yeni kapılardan geçer: ölçüt hükmü, koşturulan komutlar ve test alanı kayıtta görünür.

## Kapanan uçlar
- AU-1 (2026-11-26): Onay: AGENTS.md kural 7 'koşturma, alma ve atma sorulur' der, harness.json içinde gorev.onay 'yok'tur ve bugün bu komutlar sorulmadan koşuyor. Hangisi değişsin: metin mi ('ayar açıkken sorulur') yoksa ayar mı (sorular yeniden açılır)? — karar: Kullanıcı (2026-11-26): "önerdiğin gibi": AGENTS.md kural 7'nin metni ayara uydurulur ('ayar açıkken sorulur'); gorev.onay ayarı 'yok' kalır.
- AU-2 (2026-11-26): Süreç eklentisi (superpowers) bu depoda kapatılsın mı, açık mı kalsın? Kapatılırsa yalnız bu depo için kapatılır ve işe yarayan parçaları bu tasarımın 7, 8, 9 ve 14. davranışlarıyla araca taşınmış olur; açık kalırsa çelişkide bu deponun kuralının geçerli olduğu AGENTS.md'ye yazılır. — karar: Kullanıcı (2026-11-26): "önerdiğin gibi": süreç eklentisi (superpowers), işe yarayan parçaları araca taşındıktan sonra (EP-013 bitince) yalnız bu depo için kapatılır.
- AU-3 (2026-11-26): Oturum defteri kullanıcının iletilerini olduğu gibi yazar (yerelde, git dışında). İletide kişisel veri ya da sır geçebilir: iletiler olduğu gibi mi yazılsın, yoksa yalnız soru aracına verilen cevaplar mı? — karar: Kullanıcı (2026-11-26): "önerdiğin gibi": söz defteri kullanıcının iletilerini olduğu gibi yazar; defter yerelde ve git dışında durur.
- AU-4 (2026-11-26): Push kapısında koşacak lint ve tip denetiminin süresi ilk koşuda ölçülecek: kabul edilebilir üst sınır nedir ve aşılırsa denetim kapıdan çıkar mı, yoksa kapı o kadar mı uzar? — karar: Kullanıcı (2026-11-26): "önerdiğin gibi": lint ve tip denetiminin süresi önce ölçülür; 60 saniyeyi aşarsa kullanıcıya sorulur, aşmazsa denetim push kapısında kalır.
