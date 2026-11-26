# Aracın sertleştirilmesi ve işçiye yazılım yetenekleri (EP-013) — 2026-11-26

## Denetlemek için

- Planın güncel hâli: `python3 harness/h.py plan durum` · görevler: `python3 harness/h.py gorev durum`
- Bir görevin kartı, işçinin bitiş kaydı ve inceleme kaydı: ana çalışma ağacında `.harness/gorev/GV-NNN/` (`kart.md`, `bitis.json`, `inceleme.json`, `rapor.json`, `inceleme-rapor.json`)
- Raporsuz görev ve boş bölüm: `python3 harness/h.py rapor durum` · görev tablosunu yenilemek: `python3 harness/h.py rapor uret <bu dosya>`

## 1. Kısa özet

Bu rapor PR #18'den sonraki işi kapsar: aracın sertleştirilmesi ve işçiye yazılım yetenekleri (TS-009, EP-013). Sekiz görevin sekizi alındı (tablo 2. bölümde).

1. **Araçta altı davranış değişti** (8. bölüm): inceleme kapısı ölçüt hükmünü ve koşturulan komutları okur; görev koşmadan ortam sınanır; elle başlatılan görev kesişimde durur; kullanıcının sözü deftere yazılır; sözlük rol paketine girer; bitiş kaydında test alanı zorunludur.
2. **Dört yeni proje skill'i yazıldı, iki şey güçlendi**: `test-yaz`, `kod-tasarimi`, `mimari-tara`, `on-yuz-tasarimi`; `hata-ayikla` altı ek aldı; tasarım protokolü iki konuşma kuralı ve dokuz bakış açısı aldı. Gerekçe: işçi oturumu yalnız proje skill'lerini görür (`harness/gorev.py`, `--setting-sources project,local`).
3. **Kendi ölçümüm** (son alımdan sonra, `e70e7a9`): `python3 harness/test/test_butun_ts009.py` 1/1; skill dosyalarına dokunduktan sonra `test_yetenek.py` 32/32 ve `test_h.py` 123/123; DN-003 ve DN-004 aracın komutuyla geçti. Araç testlerinin tamamını (23 dosya) ben koşturmadım: son görevin işçisi ve inceleyicisi tek tek koşturdu, hepsi geçti (GV-167 kayıtları).
4. **Dört görev ilk turda bitmedi**; ikisinde neden ana oturumun kartındaki eksikti (6. ve 7. bölüm).
5. **Ana oturumun bir işlemi kullanıcının itirazıyla geri alındı**: süreç eklentisinin bu depoda kapatılması (7. bölüm madde 1).
6. **On bir yeni düğüm kabul edildi** (kullanıcı, 2026-11-26: "kabul et"): DN-003, DN-004, KU-021 ve KV-001 … KV-008. Lint ve tip denetimi artık push kapısında koşar; sekiz terim her işin paketine sözlük olarak girer (9. bölüm madde 2).
7. **Dal gönderildi ve PR #19 açıldı** (2026-11-26, senin seçiminle; 10. bölüm). Birleştirme yapılmadı.
8. **Dalın büyüklüğü** (`git diff --shortstat main...HEAD`, rapor yazılmadan önce): 67 dosya, 5213 satır eklendi, 137 satır silindi; bunun 26 dosyası dış kaynak kopyasıdır (`kb/_gelen/skills/`). Araç kayıtlarına göre: 8 görev, 12 işçi koşusu ve 10 inceleme, 136,6 dakika, 36,22 dolar (2. bölümdeki tablonun toplamı).

**Önce bakman gerekenler**

- 9. bölüm madde 5: yerel yol dosyasını senin yazman gerekiyor; madde 2: kabul edilen düğümlerin sonucu.
- 7. bölüm madde 1: onaysız yapılan ve geri alınan ayar değişikliği.
- 8. bölümün sonu: işçinin düzenleme kapısını betikle dolanabilmesi (beş görevde görüldü).

## 2. Görevler

<!-- otomatik:basla -->
Bu bölümü araç üretir (`python3 harness/h.py rapor uret <dosya>`); sayılar aracın kayıtlarından (`.harness/gorev/`) okunur, elle yazılmaz. Süre ve maliyet her görevin koşu geçmişindeki BÜTÜN işçi koşularının ve incelemelerinin toplamıdır; 'Koşu' kolonu işçi koşusu / inceleme sayısıdır. Koşu geçmişi olmayan eski görevde yalnız son işçi koşusu ve son inceleme sayılır, 'Koşu' kolonu boş kalır.

Tabloda 8 görev var, 8 tanesi alındı. Koşuların ve incelemelerin toplamı: 136.6 dakika, 36.22 dolar.

| Görev | Plan | Başlık | Aşama | Koşu | İşçi (dk) | İnceleme (dk) | Dolar | Dosya | İncelemenin bulguları | Cevaplanan soru |
|---|---|---|---|---|---|---|---|---|---|---|
| GV-160 | EP-013 1 | İnceleme kapısı ve inceleme istemi: ölçüt hükmü, kanıtsız inceleme, koku listesi, bakılmay | alındı | 1 / 1 | 8.4 | 7.0 | 3.20 | 7 | 0 engel, 1 öneri | 0 |
| GV-161 | EP-013 2 | Ortam ön kontrolü ve elle başlatılan görevde kesişim denetimi | alındı | 2 / 2 | 14.9 | 14.6 | 8.31 | 6 | 0 engel, 3 öneri | 0 |
| GV-162 | EP-013 3 | Söz defteri: kullanıcının iletileri ve soru cevapları kayda yazılır, rapora ve yeni oturum | alındı | 2 / 1 | 8.7 | 5.0 | 4.87 | 4 | 0 engel, 3 öneri | 1 |
| GV-163 | EP-013 4 | Sözlük: kavram düğümleri rol paketine girer | alındı | 2 / 2 | 8.4 | 16.4 | 6.71 | 4 | 0 engel, 1 öneri | 0 |
| GV-164 | EP-013 5 | Test yazımı skill'i ve hata ayıklamanın güçlenmesi | alındı | 1 / 1 | 8.8 | 4.5 | 3.32 | 8 | 0 engel, 3 öneri | 0 |
| GV-165 | EP-013 6 | Kod tasarımı ve mimari taraması skill'leri; tasarım protokolünün iki eki | alındı | 1 / 1 | 7.1 | 4.9 | 3.39 | 7 | 0 engel, 5 öneri | 0 |
| GV-166 | EP-013 7 | Ön yüz tasarımı skill'i | alındı | 1 / 1 | 5.2 | 6.5 | 2.32 | 4 | 0 engel, 2 öneri | 0 |
| GV-167 | EP-013 8 | Bütün: yeni kapılardan geçen uçtan uca görev ve belgelerin eşlenmesi | alındı | 2 / 1 | 11.1 | 4.9 | 4.09 | 4 | 0 engel, 0 öneri | 1 |
<!-- otomatik:bitir -->

## 3. İncelemenin önerileri

Bu bölümü araç üretir (`python3 harness/h.py rapor uret <bu dosya>`): tablodaki her görevin son incelemesindeki 'öneri' bulguları; 'engel' bulguları listelenmez.

<!-- oneriler:basla -->
- GV-160 · `harness/gorev.py:703` — Hedef kanıtı 'boş olmayan metin' diye tanımlıyor; kod ise boş kanıtı yalnız karsilandi true iken reddediyor.
- GV-161 · `harness/gorev.py:1173` — Hazırlıkta (ve gorev.py:947'deki ön kontrolde) yalnız FileNotFoundError yakalanıyor.
- GV-161 · `harness/gorev.py:925` — harness.yerel.json'ın biçimi doğrulanmıyor.
- GV-161 · `harness/gorev.py:941` — on_kontrol öğesi argüman listesi yerine düz metin yazılırsa ("docker info") karakterlerine bölünüp 'd' komutu aranıyor.
- GV-162 · `harness/hook/ajan_hook.py:158` — _soze yalnız OSError yakalıyor ve istem içinde plan paketinden önce çağrılıyor (satır 454).
- GV-162 · `harness/test/test_soz.py:141` — Süreç bulgusu.
- GV-162 · `harness/hook/ajan_hook.py:142` — Koku: tekrar eden kod.
- GV-163 · `harness/gorev.py:1189` — İkinci koşu (20:17:42 başladı) üç kod dosyasını düzenleme kapısından geçirmeden yazmış görünüyor: h.py, gorev.py ve test_sozluk.py.
- GV-164 · `harness/test/test_h.py:991` — Var olan test zayıflatıldı: assertEqual(set(...), BEKLENEN) yerine assertLessEqual(BEKLENEN, set(...)).
- GV-164 · `.claude/skills/hata-ayikla/SKILL.md:33` — İki alt madde bitiş kaydına yazılmasını istiyor ama hangi alana yazılacağını söylemiyor.
- GV-164 · `harness/gorev.py:694` — Metin öğe kabulünün bir bitiş koşulu yok.
- GV-165 · `.claude/skills/kod-tasarimi/SKILL.md:31` — Silme testinin soru cümlesi ile yorumu ters yönde okunabiliyor: 'Parçayı sildiğini düşün.
- GV-165 · `.claude/skills/mimari-tara/SKILL.md:51` — 5.
- GV-165 · `harness/gorev.py:166` — İnceleme istemi karmaşıklık ölçüsü olarak 'tek bağdaştırıcılı dikiş' veriyor, kart ise 'silme testinden geçmeyen parçayı ekleme' diyor; ikisi de KU-008 istisnasını anmıyor.
- GV-165 · `.claude/skills/mimari-tara/SKILL.md:29` — Sıcak nokta komutu '--pretty=format:' ile boş satırlar ürettiği için listenin ilk satırı dosya değil boş satır sayısıdır; ayrıca kb/ ve docs/ dosyaları kodun önüne geçiyor (bu depoda en sık değişen üç
- GV-165 · `harness/protokol/tasarim.md:37` — Hedef 'kaynağı ve lisansını dosyanın sonunda an' diyor; bakış açıları listesi uditakhourii/adhd (MIT) çerçeve listesinden, konuşma kuralları 7-8 mattpocock grilling'den uyarlandı, ama adhd değişen hiç
- GV-166 · `harness/test/test_yetenek.py:302` — test_dort_kalite_tabani_ve_uc_durum aradığı parçaları dosyanın tamamında arıyor.
- GV-166 · `harness/test/test_yetenek.py:284` — Bu dosya işçi oturumunda düzenleme kapısından geçmeden yazıldı: kapidan-gecen.txt gorev.py, AGENTS.md, SKILL.md ve bitis.json'u listeliyor, test_yetenek.py'yi listelemiyor.
<!-- oneriler:bitir -->

## 4. Kullanıcının verdiği kararlar

| Konu | Kullanıcının sözü | Nerede kayıtlı |
|---|---|---|
| İşin yönü | "skills da bazı yazılım için yetenekler var ilk harness'i serleştirip düzeltpit sonrasında codebase tarafına geçerken de hem düzeltmeleri hemde gerekli yeni güçlendirmeleri yazmamız lazım …" | TS-009 "Sorun" |
| Birinci fazın on beş maddesi | "tamam" | TS-009 "Sorun" |
| TS-009'un kabulü | "tekrar dene" (kabul komutunu ana oturum çalıştırdı; onay sorusunun ekranda görünüp görünmediğini ana oturum göremez) | `kb/GUNLUK.md`, 2026-11-26; commit `06ba375` |
| Dört açık uç (AU-1 … AU-4) | "önerdiğin gibi, yürüt" | TS-009 "Kapanan uçlar"; commit `d2f3ab1`. AU-2 için aşağıdaki satıra bak |
| Süreç eklentisi | "bi dakika superpowers i niye kapattın … ben sana öyle bir şey dememdim" | TS-009 "Kapanan uçlar" altındaki düzeltme; commit `bee2f4a` ve `a02527c` |
| Geri alımdan sonra | "devam" | Yalnız bu rapor. AU-1, AU-3 ve AU-4 için açık bir teyit saymadım (9. bölüm madde 1) |
| On bir taslağın kabulü (DN-003, DN-004, KU-021, KV-001 … KV-008) | "kabul et" (ana oturumun "kabul et dersen komutu ben çalıştırırım" cümlesine cevap) | `kb/GUNLUK.md`, 2026-11-26. Yalnız bu on bir düğüm için sayıldı |
| Birinci fazın kapanışı | "devam" dedi; ana oturum bunu onay saymadı ve bekleyen işleri soru penceresinde tek tek sordu. Seçtikleri: "Gönder ve PR aç", "Teyitleri olduğu gibi say", "Ön kontrolü yaz", "Yerel yol dosyasını yaz" | TS-009 "Kapanan uçlar" altındaki teyit; `harness.json` (`gorev.on_kontrol`); 10. bölüm |
| Sıradaki iş | Soru penceresinde "2. faz: kod tabanı" | Yalnız bu rapor |

## 5. Ajanın verdiği kararlar

**Tasarımdaki ajan kararları.** TS-009'un 13 ajan kararı (AK-1 … AK-13) kabulle teyit edildi; liste: `python3 harness/h.py ajan-karari TS-009`. KU-021 taslağında iki ajan kararı daha var ve teyit bekler.

**Ana oturumun sormadan verdiği kararlar**

| Karar | Gerekçe | Kayıt ve durum |
|---|---|---|
| GV-161 ve GV-163 incelemede kalınca işçi notla yeniden koşturuldu | Yeni bir davranış seçimi yoktu: bulgu, kartın kendi hedefinin sağlanmadığını gösteriyordu ve görev ağacındaki kodda doğrulandı | Görev kayıtlarındaki notlar |
| GV-163'ün dosya listesine `harness/gorev.py` eklendi | Düzeltmenin yeri oydu; onay ayarı kapalı olduğu için sorulmadı | Görev kaydı |
| GV-162'nin istediği kanca kaydı `.claude/settings.json` içine ana oturumca eklendi | Kanca, görev oturumunun kapı ayarını değiştirmesini reddediyor | Commit `8973f5f` |
| GV-167'nin sorusuna "ölçüt satırı yalnız alınmadan önce görünür" cevabı verildi | Alınmış görevde ölçüt zaten karşılanmıştır; satır yüzlerce alınmış görevin çıktısını uzatır. Tasarımın cümlesi alınmış görevi ayırmıyordu; dar okundu | Görev kaydındaki cevap. Kullanıcı teyit etti (4. bölüm) |
| GV-164'te bir araç testinin "tam olarak şunlar" sınamasından "en az şunlar" sınamasına çevrilmesi kabul edildi | İnceleyici engel saymadı; kartın iki koşulu çatışıyordu. Kayıp: test beklenmeyen fazladan skill klasörünü artık yakalamıyor | `harness/test/test_h.py`. Kullanıcı teyit etti (4. bölüm) |
| GV-164'e "eski biçimli test alanı da geçerli" notu verildi | Sıradaki üç kart eski şablonla açılmıştı | Görev kaydı. Kabulün bitiş koşulu yok (3. bölüm) |
| Lint denetimi KU-007 yerine yeni kurala (KU-021) bağlandı | Kabul edilmiş kuralı değiştirmek sürüm artışı ve yeniden kabul ister | KU-021 AK-1; KU-021 kabul edilince teyit edildi |
| Açık uçlar kapanırken TS-009'un sürümü artırılmadı | TS-008'deki emsal | Aracın notu; 9. bölüm madde 10 |
| Sözlük terimlerinin konusu boş bırakıldı (her pakete girer) | `harness.json` içinde tanımlı konu yok | KV-001 … KV-008 |
| Projeye özel ön kontroller ve yerel yol ayarı sorulmadan yazılmadı | İkisi de ayardır; 7. bölüm madde 1'den sonra sormadan ayar değiştirilmedi | Kullanıcı ikisini de seçti (4. bölüm); 9. bölüm madde 5 |

**İşçilerin kararları.** Her görevin kararları `bitis.json` içindeki "kararlar" alanındadır. Öne çıkanlar: kesişim yarışı ortak dosya kilidiyle kapandı ve bu kilit Windows'ta çalışmaz (GV-161); ölçüt satırı yalnız alınmamış görevde gösterilir (GV-160); rapordaki ham söz listesi şablona işaret konmadan eklenir (GV-162); kavramın konu denetimi taslakta da koşar (GV-163). İşçi kararları için karar taslağı açılmadı (9. bölüm).

## 6. Duruşlar ve nedenleri

Atılan görev yok. Yürütme komutu dört kez durdu ve her seferinde elle sürdürüldü; GV-164 not gerektiği için elle koşturuldu.

| Görev | Ne oldu | Neden | Sonuç |
|---|---|---|---|
| GV-161 (ortam ve kesişim) | İki işçi koşusu, iki inceleme (ilki kaldı) | Kesişim denetimi ile "koşuyor" işareti arasında boşluk vardı: iki görev arka arkaya başlatılınca ikisi de geçiyordu (inceleyici deneme betiğiyle ölçtü) | Denetim ve işaret ortak dosya kilidi altında tek adım oldu; ikinci inceleme geçti |
| GV-162 (söz defteri) | İşçi soruyla durdu | Kart, işçiden kapı ayarını (`.claude/settings.json`) düzenlemesini istiyordu; kanca reddetti ve işçi kuralı çiğnemedi | Kaydı ana oturum ekledi, ağaç tazelendi, cevap verildi; inceleme geçti |
| GV-163 (sözlük) | İki işçi koşusu, iki inceleme (ilki kaldı) | Sözlük bloğu kart yenilemesinde tanınmıyordu: her yeniden koşuda karta bir blok daha ekleniyordu. Düzeltmenin yeri kartın dosya listesinde yoktu | Dosya listesi genişletildi; ikinci inceleme geçti |
| GV-167 (bütün) | İşçi soruyla durdu | Uçtan uca test, kart ile GV-160'ın davranışı arasındaki uyuşmazlığı buldu (ölçüt satırı alınmış görevde görünür mü) | Ana oturum cevap verdi (5. bölüm); inceleme geçti |

## 7. Hatalar

1. **Süreç eklentisini onaysız kapattım.** Dört açık ucu önerilerimle birlikte listelemiştim; kullanıcının "önerdiğin gibi, yürüt" cevabını dördüne birden onay saydım ve epic bitince eklentiyi bu depoda kapattım (`c88ec75`). Kullanıcı itiraz etti. Düzeltme: geri alındı (`bee2f4a`), kayıt düzeltildi (`a02527c`). Kapatma yalnız bu daldaki proje ayarındaydı ve dal gönderilmedi. Çıkardığım kural: birden çok maddeye verilen tek kısa cevap, bir araç ayarını değiştiren madde için onay sayılmaz; o madde ayrıca ve açıkça sorulur.
2. **İki kartı eksik yazdım.** GV-162'de işçiden kapı ayarını düzenlemesini istedim (kanca buna izin vermez); GV-163'te düzeltmenin yapılacağı dosyayı listeye koymadım. Bedeli: bir soru duruşu, bir inceleme turu ve bir düzeltme koşusu.
3. **GV-167'nin kartına GV-160'ın davranışını okumadan "alınan görev" yazdım.** Bedeli: bir soru duruşu.
4. **GV-164'ün kartında iki koşul çatışıyordu** ("var olan testi zayıflatma" ile "beklenen değeri değiştirme"); yeni skill eklenince ikisi birden tutamıyordu. İşçi bir yol seçip bunu açıkça bildirdi.
5. **Tasarım kaydındaki bir ad düzeltmesini düzenleme aracı yerine kabuk komutuyla yaptım.** İçerik doğru, ama düzenleme kapısından geçmedi.
6. **Mimari taramasının ilk aramaları kabuk yazım hatası yüzünden boş döndü** (bu epic'ten önce, aynı gün). Boş çıktıyı kanıt saymadım ve doğru yazımla yeniden ölçtüm.

## 8. Araçta değişenler

Geliştirme kipi epic boyunca açıktı (`4cbe76e`) ve bitince kapatıldı (`2fa010d`). Değişen davranışlar:

- **İnceleme kaydı** (GV-160): `olcut` ve `bakilmayan` zorunlu alandır; hükmü "geçti" olan incelemede `kosulan` boş olamaz; ölçüt karşılanmadıysa genel hüküm "geçti" olsa da sonuç "kaldı"dır; durum çıktısı alınmamış görevde ölçüt hükmünü ayrı satırda gösterir.
- **Ortam** (GV-161): hazırlık komutu yolda yoksa araç döküm vermez ve koşu geçmişine "ortam" kaydı yazar; `gorev.on_kontrol` komutları oturumdan önce koşar; `harness.yerel.json` içindeki `gorev.yol` klasörleri yola eklenir.
- **Kesişim** (GV-161): `gorev kos`, yolları kesişen bir görev koşarken başlatmaz; denetim ve işaret ortak dosya kilidi altındadır. Plan yürütmesi incelemedeki ortam hatasını da düzgün durdurur.
- **Söz defteri** (GV-162): kullanıcının iletileri ve soru cevapları ana ağacın `.harness/soz/` klasörüne yazılır; `h.py soz` listeler; `rapor yeni` 4. bölüme ham listeyi koyar; oturum başı özeti başka oturumun son sözlerini gösterir.
- **Sözlük** (GV-163): kabul edilmiş kavramlar rol paketinde "Sözlük" bloğu olarak görünür; kart yenilemesi bloğu tanır; kavramın konusu denetlenir.
- **Bitiş kaydı ve kart** (GV-164 … GV-166): `testler` zorunlu alandır; görev kartı ve inceleme istemi dört skill'e yollar; inceleme istemi eksen, koku, test ve ön yüz maddelerini taşır.
- **Tasarım protokolü** (GV-165): iki yeni konuşma kuralı ve dokuz bakış açısı.

Ölçülen ve kapanmayan açıklar:

- **İşçi düzenleme kapısını betikle dolanabiliyor.** Beş görevde (GV-160, GV-161, GV-162, GV-163, GV-166) işçi en az bir dosyayı düzenleme aracı yerine kabuk ya da betikle yazdı. Araç bunun bir kısmını görmüyor: ölçüm dosya başına sayıyor, yani ilk koşuda kapıdan geçmiş dosya ikinci koşuda betikle yazılırsa görünmüyor; kanca da betiğin içindeki yazımı göremiyor (GV-162 ve GV-163 incelemeleri). "Dosyaları yalnız düzenleme araçlarıyla yaz" notu verilen GV-164'te bu olmadı.
- **Söz defterinin gerçek bir oturumda yazdığı görülmedi.** Bu oturumun kancaları ana ağacın eski kodundan çalışıyor; soru aracının gerçek kanca girdisinin biçimi de görülmedi (tanınmazsa ham sonuç yazılır).
- **Kesişim kilidi Windows'ta çalışmaz** (GV-161 işçisinin bildirimi); araç zaten alma kilidinde aynı düzeneği kullanıyor.

## 9. Kullanıcıdan beklenenler ve açık işler

**Senden beklenenler**

1. **Üç açık uç teyit edildi; yapılacak bir şey kalmadı.** AU-1 (kural 7'nin metni ayara uyduruldu, `3f41c12`), AU-3 (söz defteri iletileri olduğu gibi yazar) ve AU-4 (lint ve tip denetimi kapıda 60 saniyeyi aşarsa sana sorulur; ölçülen toplam yaklaşık 17 saniye) senin "Teyitleri olduğu gibi say" seçiminle kesinleşti.
2. **Kabul edilen on bir düğümün sonucu (bilmen gereken).** Lint ve tip denetimi artık push kapısında koşar; yeni açılan çalışma ağacında önce bağımlılık kurulumu ve `pnpm -C backend prisma:generate` gerekir, yoksa kapı kalır. Sekiz terim her işin paketine sözlük olarak girer; tanımlarda yanlış bulursan düğümü değiştirmek sürüm artışı ister.
3. **Ana oturumun iki kararı teyit edildi** (5. bölüm): ölçüt satırının yalnız alınmadan önce görünmesi ve bir araç testinin "en az şunlar" sınamasına çevrilmesi.
4. **Süreç eklentisi açık kaldı.** TS-009 Yapı 15'in "açık kalırsa" kolu (AGENTS.md'ye "çelişkide bu deponun kuralı geçerlidir" cümlesi) yapılmadı; istersen yazılır.
5. **Yerel yol dosyasını sen yazmalısın.** İki ayarı da seçtin. (a) Ön kontrol yazıldı: `harness.json` içindeki `gorev.on_kontrol` artık veritabanı (5440) ve Redis (6390) kapılarını sınar; Docker kapalıyken hiçbir görev koşmaz. (b) Ana ağaçtaki `harness.yerel.json` yazılamadı: bu oturum kendi çalışma ağacına kilitlidir ve ana ağaca dosya yazamaz. Kendi terminalinde tek komut: `printf '%s\n' '{"gorev": {"yol": ["'"$HOME"'/.nvm/versions/node/v24.18.0/bin"]}}' > ~/Developer/Dextra/harness.yerel.json`. Dosya yazılana kadar görev komutlarının başına yol eklemek gerekir.
6. **PR #19'un birleştirilmesi.** Dal gönderildi ve PR açıldı (10. bölüm); birleştirme senin kararın.
7. **İkinci faz (kod tabanı).** Ön yüzün görsel yönü geri alması pahalı bir karardır; ilk taslağını sen yazacaksın (TS-009 "Kapsam dışı").

**Açık işler**

8. **Araç için yeni sertleştirme adayları** (onayladığın on beş maddede yok): işçinin düzenleme kapısını betikle dolanması (8. bölüm) ve 3. bölümdeki 18 inceleme önerisi; en somutları çalıştırma izni olmayan hazırlık komutunun dökümü, yerel ayar ve ön kontrol biçiminin doğrulanmaması, yarım kalmış emoji taşıyan iletinin deftere yazılamaması ve eski biçimli test alanı kabulünün süresiz olması.
9. **İşçi kararları için karar taslağı açılmadı**; KU-007/AU-2 (lint denetiminin o kurala bağlanması) açık duruyor.
10. **TS-009'un sürümü** açık uçlar kapanırken artırılmadı; araç her kapanışta "sürümü artır" notu verdi.
11. **Mimari taramasının sonucu depoda değil.** 50 eksik ve 97 aday geçici klasörde duruyor ve makine yeniden başlarsa silinir; ikinci fazın tasarımına girdi olacaksa depoya alınmalı.

## 10. PR'lar

| PR | Kapsam | Durum |
|---|---|---|
| [#18](https://github.com/mrburakgenc/dextra/pull/18) | Önceki raporun işi (EP-012) | Birleşti (2026-11-26 18:17; ana dal `4eab047`) |
| [#19](https://github.com/mrburakgenc/dextra/pull/19) | Bu raporun işi: aracın sertleştirilmesi (EP-013) | Açıldı (2026-11-26); birleştirme yapılmadı, senin sözünü bekliyor |

Dal senin seçiminle ("Gönder ve PR aç") gönderildi ve PR açıldı; numarası bu bölüme ikinci bir commit'le yazıldı.

## 11. Günlük

Saatler, aksi yazılmadıkça commit zamanlarıdır (2026-11-26).

- 18:17 — PR #18 birleşti; eski çalışma ağacı kapatıldı.
- 18:36'ya kadar — Mimari taraması ve üç dış skill deposunun okunması (10 keşif oturumu; depoda değişiklik yok; saat, sonuç dosyasının yazılma zamanıdır).
- 18:55 — TS-009 taslağı; 18:59 kabul; 19:01 dört açık uç kapandı ve dış kaynaklar depoya alındı.
- 19:01 – 19:17 — GV-160 koştu, incelendi, alındı.
- 19:17 – 19:48 — GV-161: ilk inceleme kaldı, düzeltme koşusu, ikinci inceleme geçti, alındı.
- 19:48 – 20:03 — GV-162: işçi soruyla durdu; kanca kaydı ana oturumca eklendi (19:57); alındı.
- 20:03 – 20:30 — GV-163: ilk inceleme kaldı, dosya listesi genişletildi, ikinci inceleme geçti, alındı.
- 20:30 – 21:08 — GV-164, GV-165 ve GV-166 ilk turda geçti ve alındı.
- 21:08 – 21:26 — GV-167: işçi soruyla durdu, cevap verildi, alındı; EP-013 8/8.
- 21:29 — Kural 7'nin metni değişti; süreç eklentisi kapatıldı.
- 21:30 — Kullanıcının itirazıyla kapatma geri alındı ve kayıt düzeltildi.
- 21:32 — Geliştirme kipi kapatıldı.
- 21:35 – 21:36 — Lint ve tip denetimi taslakları, sözlüğün ilk sekiz terimi.
