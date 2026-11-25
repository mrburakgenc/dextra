---
kimlik: TS-006
tur: tasarim
durum: taslak
surum: 1
baslik: Aracın boşluklarının kapatılması: uyarılar, denetimler, görev yaşam döngüsü ve rapor
agirlik: cift-yonlu
tarih: 2026-11-25
---
Aracın (harness) iki günde ölçülen boşlukları ve ajanın raporlara yazdığı hata sınıfları tek tek kapatılır; amaç, aynı sapmanın ve aynı zaman kaybının bir daha araç tarafından durdurulması ya da görünür kılınmasıdır.

## Sorun
Kullanıcı (2026-11-25, kendi sözü): "hepsini ekle sırayla ve hatalar raporda da yazdığın hepsini de ekle buraya aslında harness boşlukları da kapansın". "Hepsi", ajanın sohbette saydığı sekiz madde, iki raporun "Hatalar" bölümlerindeki hata sınıfları ve raporlardaki araç boşluklarıdır.

Ölçülenler (kaynak: `docs/rapor/2026-11-24-gece-raporu.md` ve `docs/rapor/2026-11-25-yapiyi-kanona-cekme-ve-rapor-zorunlulugu.md`):
- Mimari kuralların hepsi taslak kaldığı için işçilere ve inceleyicilere gitmedi; yapı kanondan saptı ve kullanıcı kodu okuyana kadar fark edilmedi.
- Dosya beyanı ölçümle uyuşmadığı için gece 5, gündüz 4 görev durdu; araç değişen dosyaları zaten ölçüyor.
- Görev ağacının tabanı yenilenemediği ve kartın dosya listesi genişletilemediği için dört görev ölü yaprak oldu (GV-036, GV-068, GV-089, GV-112).
- Büyük kartlar tur ve süre sınırına takıldı (gündüz dört kez); ana oturum her seferinde elle "kaldığı yerden koştur" dedi.
- Kartların dosya listesi eksikti: liste dışındaki dosyalar kapsamın içini içe aktarıyordu (dört duruş).
- Yeniden koşulan görevin önceki süresi ve maliyeti kayıttan silindiği için rapor toplamı gerçeğin altında kaldı.
- İnceleyicilerin "öneri" bulguları kayıtlarda kaldı; rapora ana oturum elle taşıdı.
- Alma çakışmayla yarıda kalınca görev ağacı değişmiş sayıldı ve iş yeniden koşmak zorunda kaldı; yan yana iki alma git kilidine takılabildi.
- İnceleme kaldığında ana oturum işçiye karar iletemedi (cevap yalnız işçi sorarsa verilebiliyor); işçi bir kez yanlış yolu seçti.
- İşçiler dosyayı düzenleme aracı yerine kabuk betiğiyle yazdı; düzenleme kapısı (kural gösterimi) atlandı ve bu yalnız işçi kendisi bildirince görüldü.
- Push'u tanıyan desen, içinde "git" ve "push" sözcükleri geçen zararsız komutları da durduruyor; rapor denetimi raporu çalışma ağacında arıyor (commit edilmemiş rapor kapıyı geçirir).
- Koşan görev durum çıktısında "bekliyor" görünüyor.
- Uçtan uca tarayıcı denemesi iki gün elle yapıldı; kayıtlı bir test değil.

- Amaç: aşağıdaki "Yapı"daki on dört davranış.
- Kapsam dışı: iskelet deposu (aracın asıl kaynağı; bu depodaki kopya değişir, taşıma kullanıcınındır); Claude Code'un kendi çalışma ağacı kilidi; kullanıcının kişisel genel ayarları.
- Başarının ölçüsü: her davranışın aracın kendi testlerinde kırmızı ve yeşil örneği vardır; var olan araç testleri değişmeden geçer.

## Kısıtlar
- Araç yalnız Python standart kitaplığını kullanır; yeni bağımlılık eklenmez.
- Aracın kodu yalnız `harness.json` içindeki geliştirme kipi açıkken düzenlenir; kip iş boyunca açık, iş bitince kapalıdır ve iki değişiklik de ayrı commit'tir.
- Kabul edilmiş kurallar değişmez (KU-001…KU-006): onay soruları atlatılmaz, işaret ve ölçüm kaydı elle yazılmaz, iş incelenmeden alınmaz.
- Kullanıcıya soran yerler (koşturma, alma, atma, kabul) aynen kalır; yeni yıkıcı ya da kapsam genişleten komutlar da kullanıcıya sorar.
- Var olan komutların çıktı biçimi ve çıkış kodları, aşağıda adı geçenler dışında değişmez.

## Yapı
Davranışlar, eklenecekleri sırayla:

1. **Taslak kural uyarısı.** Kart açılırken (`plan task`, `plan subtask`, `gorev yeni`) ve görev koşturulurken, kartın yollarına ya da konularına düşen taslak kural ve kararlar sayılır ve adlarıyla uyarı olarak yazılır ("bu işe düşen N taslak var; kabul edilmeden bağlayıcı gitmez"). Kural paketine ayrı bir "Taslak (bağlayıcı değil; bilgi)" bloğu eklenir; işçi ve inceleyici onu görür, taslağa aykırılık inceleme için engel değil öneridir.
2. **Denetim düğümleri koşar.** `h.py denetim kos [DN-NNN]` denetim düğümünün "Nasıl koşar" bölümündeki komutu çalıştırır ve sonucu bildirir. Push kapısı (`denetle --dal`) kabul edilmiş ve mekanik bir kurala bağlı denetimlerin komutlarını da koşturur; taslak denetimin komutu kapıda koşmaz. Yapı denetimi (TS-005) DN-002 olarak KU-008'e bağlanır.
3. **Dosya beyanı zorunlu değildir.** Bitiş kaydındaki "dokunulan" listesi isteğe bağlıdır ve ölçümle karşılaştırılmaz; değişen dosyaların tek kaynağı aracın ölçümüdür. Kapsam dışı dosya denetimi (ölçülen fark kartın yollarına uymalı) aynen kalır.
4. **Koşu geçmişi.** Her işçi koşusu ve her inceleme ayrı kayıt olarak saklanır (zaman, süre, tur, maliyet, sonuç); rapor tablosu son koşuyu değil toplamı ve koşu sayısını gösterir.
5. **Koşan görev "koşuyor" görünür.** Durum çıktıları koşan işçiyi ve süren incelemeyi adıyla gösterir.
6. **Taban yenileme.** `gorev tazele GV-NNN`: görev ağacında değişiklik yoksa ağaç oturum dalının ucuna alınır; değişiklik varsa oturum dalı görev dalına birleştirilir, çakışma olursa hiçbir şey değişmeden bildirilir.
7. **Dosya listesini genişletme.** `gorev genislet GV-NNN --yol <desen>`: kartın ve kaydın yol listesine desen ekler; kullanıcıya sorulur (kapsam genişletmek karardır) ve karta kimin ne zaman eklediği yazılır.
8. **Orkestratör notu.** `gorev kos GV-NNN --not "…"`: yeniden koşan işçiye, soru sormamış olsa da ana oturumun notu verilir (kalan incelemeden sonra karar iletmek için); notlar kayıtta saklanır.
9. **Kendiliğinden devam.** İşçi tur ya da süre sınırında kesilirse ve ağaçta değişiklik varsa araç görevi bir kez kendiliğinden kaldığı yerden sürdürür (ayar; varsayılan bir kez); ikinci kesilmede durur ve bildirir.
10. **Alma sağlamlığı.** Alma çakışmayla yarıda kalırsa görev ağacı ve oturum dalı alma öncesi hâline döner ve görevin imzası değişmez; yan yana gelen iki alma sıraya girer.
11. **Kart ön denetimi.** Kart açılırken üç uyarı: yol desenleri çok dosyaya düşüyorsa (eşik ayarda) "kapsam geniş"; hedef ve ölçüt metni uzunsa (eşik ayarda) "kart büyük, bölmeyi düşün"; kartın yolları dışında kalıp yolların içindeki dosyaları içe aktaran dosyalar varsa adlarıyla "liste dışı içe aktaranlar". Uyarılar karta "Kapsam notu" olarak da yazılır; engel değildir.
12. **Kapılar.** Push deseni yalnız gerçekten gönderen komutu tanır (komutun sözcükleri "git … push" ya da "gh pr create|merge" biçimindeyse); rapor denetimi raporu commit edilmiş hâlde arar; düzenleme kapısından geçmeden değişen dosyalar (kabuk betiğiyle yazılanlar) koşu sonunda ölçülür, kayda "kapı dışı yazım" diye geçer ve o dosyalara düşen kurallar inceleyiciye verilir.
13. **İnceleme önerileri raporda.** Raporun ikinci otomatik bloğu, tablodaki görevlerin inceleme önerilerini (görev, dosya ve satır, ilk cümle) listeler; `rapor durum` açık öneri sayısını da söyler.
14. **Tarayıcı senaryosu testi.** Bugün elle yapılan uçtan uca tarayıcı denemesi kayıtlı bir teste döner ve yerel deneme betiğinin üstünde koşar. Araç dışı, projeye ait iştir (yeni paket ister; ana oturum kurar) ve ayrı epic'tir.
15. **Kapanmamış görev raporlanmış sayılmaz** (iş sürerken ölçüldü, 2026-11-25): rapor tablosu henüz koşmamış görevleri "bekliyor" diye aldığı için o görevler sonradan alınınca raporsuz sayılmıyor ve yeni raporun tablosuna girmiyordu (EP-009'un görevleri bir önceki raporun tablosuna böyle girdi). Görev bir raporda ancak tablosundaki satırı "alındı" ya da "atıldı" ise kapanmış sayılır; hiç koşmamış görev tabloya girmez.
16. **Denetim koşumunun sertleştirilmesi** (2. davranışın incelemesinden, GV-122): denetimin komutu normatif içeriktir (kabul edilmiş düğümde sürüm artmadan değişemez); ajanın push kancası komut koşturmaz, komutlar yalnız git'in push kapısında koşar; bir denetimin komutu aracı çağırırsa iç içe koşum olmaz; kapı süreci kesilirse komut geride kalmaz; geçersiz komut "komutu yok" diye gizlenmez.
17. **Atılan yaprağın yerine geçen görev** (kullanıcı, 2026-11-25: "at oradaki işaretleri de tamamla"): işi başka bir görevle yapılmış atılmış yaprak planda işaretsiz kalıyordu (GV-036 → GV-038, GV-068 → GV-082, GV-089 → GV-090, GV-112 → GV-114; dördü kullanıcının onayıyla atıldı, epic'ler kapandı ama kutular boş kaldı). İşaret elle konmaz; araç atılmış görevin "yerine geçen" görevini kaydeder (`gorev yerine GV-ESKİ GV-YENİ`, ya da atarken `gorev at GV-ESKİ --yerine GV-YENİ`) ve yerine geçen alınmışsa yaprağı işaretli gösterir.
18. **Taslak engeli** (kullanıcı, 2026-11-25; Seçenekler 1-B): kabul edilmemiş karara dayanan iş koşmaz. Bir işe düşen taslaklar iki yoldan bulunur: kartın yollarına ve konusuna düşen taslak kurallar ile onların taslak kararları (1. davranışın seçimi) ve işin açıkça dayandığı düğümler (epic ve görev "dayanak" taşır: tasarım kaydı, karar ya da kural kimliği; epic'in dayanağı görevlerine geçer). İşe düşen taslak varsa `gorev kos` ve `plan yurut` koşturmaz ve hangi taslakların beklediğini söyler. İki çıkış vardır: kullanıcı taslakları kabul eder, ya da kullanıcı o koşuya özel izin verir (`--taslakla`); izin sorusu onay ayarından bağımsız olarak HER ZAMAN kullanıcıya sorulur, soruda taslakların kimliği, başlığı ve açık uçları görünür ve izin kayda yazılır.
19. **Açık uç** (kullanıcı, 2026-11-25): bir düğüm, karara bağlanmamış noktalarını adlı ve sayılı "açık uç" olarak taşır. İşe düşen düğümlerin açık uçları işçiye ve inceleyiciye pakette verilir: işçi o noktada seçim yapmaz, soruyla durur ve sorusunda açık ucun kimliğini yazar. Açık uca dayanan soruyu ana oturum kendisi cevaplayamaz: cevap komutu onay ayarından bağımsız olarak HER ZAMAN kullanıcıya sorulur (soru ve verilecek cevap gösterilir). Açık ucu kapatmak ya da bir düğümden silmek de kullanıcıya sorulur. İnceleyici, açık uçta sorulmadan seçim yapılmış işi engel sayar.
20. **Ajan kararlarının görünürlüğü** (kullanıcı, 2026-11-25): tasarım kayıtlarının içindeki ajan kararları (bugün TS-002'de 52 tane) sayılır ve gösterilir: durum çıktısında ve oturum başı özetinde düğüm başına sayı, kabul sorusunda o düğümdeki ajan kararlarının listesi. Böylece kullanıcı kabul ederken neyi teyit ettiğini görür; taslak engeliyle birlikte, teyit edilmemiş ajan kararının üstüne kod yazılamaz.

### Ajan kararları (kullanıcı teyidi bekler)
- **DN-002'nin komutu `pnpm` kullanmaz** (2026-11-25): `node backend/node_modules/vitest/vitest.mjs run --root backend <dosya>`. Gerekçe: push kapısı, `pnpm`'in yolda olmadığı kabuklarda da (bu oturumun kabuğu böyle; ölçüldü) koşabilmeli. Bedel: komut vitest'in paket içindeki dosya adına bağlıdır.
- **KU-008 taslağının denetim düzeyi "mekanik" yapıldı ve DN-002'ye bağlandı** (2026-11-25): kural da denetim de taslak olduğu için kapıda koşmaz; kullanıcı ikisini kabul edince koşar. KU-008'in kapsamı (`backend/src/features/**`) değişmedi; denetim ortak kodu da sınar.
- **DN-001 "yerleşik" olarak işaretlendi**: aracın kendi denetimidir (`denetle --dal` içinde koşar), komut taşımaz.
- **Almada kesinleşme noktası başarılı birleştirmedir** (2026-11-25; GV-125'in iki incelemesinden): almanın birleştireceği commit görev ağacına dokunmadan üretilir (geçici hazırlık alanı; tazelemedeki yöntem), böylece birleştirme bitene kadar görev ağacında geri alınacak bir şey olmaz ve süreç öldürülse de imza değişmez. Birleştirme başarılı olunca "alındı" kaydı ve plan işareti temizlikten önce yazılır; ağacın ve dalın silinmesi hata verirse alma başarılı sayılır, hata uyarıdır ve aynı komut yeniden çalışınca kalan temizlik yapılır. Oturum ağacında alma başlamadan önce süren bir birleştirme varsa alma hiçbir şeye dokunmadan durur (ilk inceleme: araç kullanıcının yarım birleştirmesini iptal ediyordu). Reddedilen: her adımı ayrı ayrı geri almak (geri alma adımının kendisi de yarıda kalabilir).
- **Push tanıyıcısı komutun konumuna değil sözcük dizisine bakar** (2026-11-25; GV-127'nin iki incelemesinden): 12. davranışın ilk yazımı yalnız parçanın ilk sözcüğüne baktığı için sarmalayıcıyla, `sh -c` ile ya da çift tırnaktaki komut yerine koymayla çağrılan gönderme ve PR birleştirme kırmızı zincirde geçebiliyordu (PR birleştirme için git'in kendi kapısı yoktur). Kural: bir parçanın herhangi bir sözcüğü git ise genel seçenekleri atlanır ve alt komutu push ise push'tur; gh için pr ve ardından create ya da merge aranır; komut yerine koyma gövdeleri, kabuğun `-c` değeri ve `eval` özyinelemeli sınanır; tek tırnaklı metin komut sayılmaz; çözümlenemeyen komutta eski geniş desen geçerlidir. Reddedilen: bilinen sarmalayıcıların listesi (her zaman eksik kalır).
- **`gorev genislet` ve `gorev tazele` onay ayarına uyar** (2026-11-25; GV-124 incelemesi çelişkiyi gösterdi): 7. davranış ve "Kısıtlar" bu komutların kullanıcıya sorulacağını söylüyordu; yazılan davranış koşturma ve alma ile aynıdır, yani `harness.json` içindeki `gorev.onay` ayarına bakar. Bu depoda ayar "yok" olduğu için (kullanıcı onay sorularını kapattı) sorulmaz; ayar açıkken sorulur. Gerekçe: kapsam genişletme, koşturma ve almadan daha ağır bir karar değildir ve tek ayar tek davranış verir. Bedel: ayarı kapalı depoda ajan kartın dosya listesini sormadan genişletebilir; kartta tarihli "Kapsam değişikliği" satırı iz bırakır.

## Seçenekler
### 1. Taslak kural: uyarı mı, engel mi
- A (ilk seçim, ajan; 2026-11-25'te kullanıcı tarafından EZİLDİ) — Uyarı ve bilgi bloğu: iş durmaz; taslak, kullanıcı kabul edene kadar bağlayıcı değildir, ama işçi ve inceleyici onu görür. Bedel: uyarı görmezden gelinebilir. Bu bedel aynı gün ölçüldü: yetkinin kayıt katmanı, taslak kalan kanon kuralının (KU-012) tersine ve açık bırakılmış bir sınırın (KR-010: "adları ve sınırları tasarlanmadı") üstüne ajan kararıyla (AK-19) kodlandı.
- B (seçildi; kullanıcı, 2026-11-25) — Engel: taslağa dayanan iş koşmaz; taslak bilgi bloğu olarak gitmeye devam eder. Kullanıcının sözü: "aracın net sorunu bu ve işlerde onaylanmadan da başlamamasını sağlayacak yapıyı da eklettir burada karar net değil taslak ise kodlama başlamasın veya taslaksa ucu açık durumdaysa o durum gerçeklestiği zaman ne olursa olsun bana sorsun". Bedel: taslak yazmak işi durdurur; kabul ya da kullanıcının o koşuya özel izni gerekir. Ayrıntısı Yapı 18, 19 ve 20'dedir.

### 2. Dosya beyanı
- A (seçildi) — Zorunluluk kalkar; ölçüm tek kaynaktır. Bedel: işçinin "neye dokunduğunu biliyor mu" sınaması kaybolur.
- B — Uyuşmazlık uyarıya çevrilir: görev durmaz ama gürültü kalır; ölçümden fazlasını söylemez.

### 3. Denetim komutlarının kapıda koşması
- A (seçildi) — Yalnız kabul edilmiş, mekanik kurala bağlı denetimler kapıda koşar. Bedel: push birkaç saniye uzar.
- B — Her denetim düğümü koşar: taslak bir düğüme yazılan komut onaysız çalışmış olur.

## Aşamalar
Sıra davranışların numarasıdır; hepsi aynı dosyalara dokunduğu için görevler art arda koşar: (1) taslak uyarısı · (2) denetim düğümleri · (3, 4, 5) beyan, koşu geçmişi ve durum · (6, 7, 8, 9) taban yenileme, genişletme, not ve kendiliğinden devam · (10) alma sağlamlığı · (11) kart ön denetimi · (12) kapılar · (13) rapordaki öneriler · (17) yerine geçen görev · (18) taslak engeli · (19) açık uç · (20) ajan kararlarının görünürlüğü · (13) rapordaki öneriler · (15) kapanmamış görev · (16) denetim sertleştirmesi · (14) tarayıcı senaryosu (ayrı epic). Kullanıcının 2026-11-25 kararıyla 18, 19 ve 20 sıranın önüne alındı.

## Doğrulama
- Her görev aracın test klasörüne kendi test dosyasını ekler; her davranışın en az bir kırmızı ve bir yeşil örneği vardır.
- Var olan araç testleri (`harness/test/test_h.py`, `test_gorev.py`, `test_plan.py`, `test_hook.py`, `test_graf.py`, `test_rapor.py`) her görevden sonra ayrı ayrı koşturulur ve geçer.
- Her görev alındıktan sonra ana oturum bu depoda `denetle`, `gorev durum` ve `rapor durum` komutlarını koşturur.
