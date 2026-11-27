# Denetim raporunun bulguları: sunucu tarafı kapı ve aracın sertleştirilmesi (EP-014) — 2026-11-27

## Denetlemek için

- Planın güncel hâli: `python3 harness/h.py plan durum` · görevler: `python3 harness/h.py gorev durum`
- Bir görevin kartı, işçinin bitiş kaydı ve inceleme kaydı: ana çalışma ağacında `.harness/gorev/GV-NNN/` (`kart.md`, `bitis.json`, `inceleme.json`, `rapor.json`, `inceleme-rapor.json`)
- Raporsuz görev ve boş bölüm: `python3 harness/h.py rapor durum` · görev tablosunu yenilemek: `python3 harness/h.py rapor uret <bu dosya>`

## 1. Kısa özet

Bu rapor PR #19'dan sonraki işi kapsar: 2026-11-27 tarihli dış denetim raporunun (denetlenen commit `fdbceef`) bulguları için açılan EP-014. 6 görevin 6'sı alındı (tablo 2. bölümde); epic bitti.

1. **Altı bulgunun beşi bu dalda kapandı, biri başka işte.** Bulgu 1 ve 2: GitHub'da koşan iki iş akışı (`.github/workflows/kapi.yml`, `ozet.yml`; GV-171) ve `h.py ozet` komutu (GV-170). Bulgu 3: kanca, kapı atlatan bayrağın kısaltmalarını ve commit'in kısa `-n` seçeneğini reddediyor (GV-168). Bulgu 5: işçiye yalnız izin listesindeki ortam değişkenleri geçiyor, MCP yalnız ayarda sayılan role veriliyor (GV-169). Bulgu 6: yapı denetimine dört sınama eklendi (GV-172). Bulgu 4 (deneme sınırı ve yayın şartı) plana alınmadı: `arac-sertlestirme` ağacındaki TS-010 taslağı aynı işi tasarlıyor (Yapı A.7).
2. **Sunucu tarafı kapı henüz hiç koşmadı.** İş akışları yalnız yazıldı ve metin olarak sınandı (`harness/test/test_is_akisi.py`, 13 test); GitHub'daki ilk gerçek koşu dal gönderilip PR açılınca görülecek. `ozet.yml` `pull_request_target` ile koştuğu için bu dalın PR'ında koşmaz: ilk özet yorumu, bu dal `main`'e girdikten sonra açılan ilk PR'da görülür (GV-171 incelemesinin notu).
3. **Bulgu 2'nin asıl kısmı kodla kapanmaz.** `main` dalı korumasız, depo herkese açık ve bu makinedeki `gh` deponun sahibinin hesabıyla açık (2026-11-27'de `gh api` ile ölçüldü); zorunlu kontrol ve ajanın ayrı kimliği senin GitHub ayarın (9. bölüm madde 2).
4. **Kendi ölçümüm** (son alımdan sonra, birleşmiş dalda, `f3f42e0`): bu epic'te eklenen ya da değişen dokuz araç test dosyası tek tek koştu ve geçti (`test_hook`, `test_ortam`, `test_gorev`, `test_acikuc`, `test_kapi`, `test_butun_ts009`, `test_ozet`, `test_is_akisi`, `test_butun_denetim_raporu`); yapı denetimi spec'i 110/110 (38 uç sınandı, 0,5 saniye); `h.py denetle` temiz. Arka yüz ve ön yüz test kümelerinin tamamını koşturmadım; onları ilk kez GitHub koşturacak.
5. **Dört yaprak ilk seferde geçmedi** (6. bölüm): üçü benim yazdığım karttaki çelişki ya da dar dosya listesi yüzünden (7. bölüm madde 1 … 3), biri işçinin kırılgan testi yüzünden. İncelemeler iki gerçek gerilemeyi alınmadan yakaladı (GV-168: satır devamı; GV-170: çalışma ağacından okunan taban).
6. **Dalın büyüklüğü** (`git diff --shortstat fdbceef..ec733fc`): 18 dosya, 1.448 satır eklendi, 32 satır silindi. Araç kayıtlarına göre: 6 görev, 11 işçi koşusu ve 10 inceleme, 127,2 dakika, 33,45 dolar (2. bölümdeki tablonun toplamı). Başta 12 oturum demiştim; 21 oldu.

**Önce bakman gerekenler**

- 9. bölüm madde 1 ve 2: dalın gönderilmesi ve `main` dalının korunması.
- 8. bölüm: işçilerin ortamı ve inceleyicinin MCP'si bu dalla değişti.
- 7. bölüm madde 4: bu oturumda verdiğin iki cevap söz defterine yazılmadı.

## 2. Görevler

<!-- otomatik:basla -->
Bu bölümü araç üretir (`python3 harness/h.py rapor uret <dosya>`); sayılar aracın kayıtlarından (`.harness/gorev/`) okunur, elle yazılmaz. Süre ve maliyet her görevin koşu geçmişindeki BÜTÜN işçi koşularının ve incelemelerinin toplamıdır; 'Koşu' kolonu işçi koşusu / inceleme sayısıdır. Koşu geçmişi olmayan eski görevde yalnız son işçi koşusu ve son inceleme sayılır, 'Koşu' kolonu boş kalır.

Tabloda 6 görev var, 6 tanesi alındı. Koşuların ve incelemelerin toplamı: 127.2 dakika, 33.45 dolar.

| Görev | Plan | Başlık | Aşama | Koşu | İşçi (dk) | İnceleme (dk) | Dolar | Dosya | İncelemenin bulguları | Cevaplanan soru |
|---|---|---|---|---|---|---|---|---|---|---|
| GV-168 | EP-014 1 | Kanca: kapı atlatan bayrağın kısaltmaları ve commit'in kısa seçeneği reddedilir | alındı | 3 / 3 | 7.5 | 20.3 | 7.94 | 2 | 0 engel, 3 öneri | 0 |
| GV-169 | EP-014 2 | İşçi ortamı: ortam değişkenleri izin listesi ve role göre MCP | alındı | 2 / 1 | 11.7 | 6.8 | 4.71 | 7 | 0 engel, 2 öneri | 0 |
| GV-170 | EP-014 3 | PR özeti komutu: kabule geçen düğümler ve kapı dosyalarındaki değişiklik | alındı | 2 / 2 | 5.3 | 9.6 | 4.71 | 2 | 0 engel, 5 öneri | 0 |
| GV-171 | EP-014 4 | Sunucu tarafı kapı: sunucuda koşan iki iş akışı (kapı ve PR özeti) | alındı | 2 / 2 | 12.2 | 26.3 | 7.51 | 3 | 0 engel, 3 öneri | 0 |
| GV-172 | EP-014 5 | Yapı denetimine dört sınama: guard sırası, uç işaretleri, isteği yapanı gösteren alan, fea | alındı | 1 / 1 | 5.8 | 9.6 | 4.57 | 2 | 0 engel, 3 öneri | 0 |
| GV-173 | EP-014 6 | Bütün: denetim raporunun bulguları uçtan uca sınanır ve belgeler eşlenir | alındı | 1 / 1 | 6.9 | 5.3 | 4.01 | 3 | 0 engel, 2 öneri | 0 |
<!-- otomatik:bitir -->

## 3. İncelemenin önerileri

Bu bölümü araç üretir (`python3 harness/h.py rapor uret <bu dosya>`): tablodaki her görevin son incelemesindeki 'öneri' bulguları; 'engel' bulguları listelenmez.

<!-- oneriler:basla -->
- GV-168 · `harness/hook/ajan_hook.py:287` — Satır devamı silme, yorumun içinde de uygulanıyor.
- GV-168 · `harness/test/test_hook.py:192` — test_tek_basina_sozcuk_olan_bayraga_benzer_deger_reddedilir, `git commit -m "--no-veri"` ve `git commit -m -n` komutlarının reddedildiğini sınıyor.
- GV-168 · `harness/hook/ajan_hook.py:270` — Tanıyıcı alt komutu sözcüğün kendisinden okuyor.
- GV-169 · `harness/gorev.py:1301` — İnceleme ön kontrolüne verilen ortamın süzüldüğünü sınayan test yok.
- GV-169 · `harness/test/test_gorev.py:98` — Ortak gorev_deposu, başka test dosyalarının sahte oturumlarının kip değişkenlerini adıyla sayıyor: YASAM_MOD (test_yasam), KAYIT_MOD (test_kayit), INCELEME_* (test_inceleme_kapisi).
- GV-170 · `harness/h.py:1918` — --taban verilmezse taban_dal uçtaki harness.json'dan okunuyor; uç taban_dal'ı kendine çevirirse özet boş çıkıyor.
- GV-170 · `harness/h.py:1930` — Önceki turun önerisi duruyor: tabandaki harness.json bozuk JSON ise (ValueError) korunan_ayar sessizce [] oluyor; 3.
- GV-170 · `harness/h.py:1966` — Okunamayan uç düğümleri her zaman 1.
- GV-170 · `harness/h.py:1925` — Git deposu olmayan dizinde ileti 'başvuru bulunamadı: HEAD' oluyor; çıkış kodu doğru (2) ama neden yanlış söyleniyor.
- GV-170 · `harness/test/test_ozet.py:208` — Zayıf iddia: 'yok' alt dizgisi çıktının herhangi bir yerinde geçse test geçer; HEAD main'deyken farkın boş olduğunu sınamıyor.
- GV-171 · `harness/test/test_is_akisi.py:76` — Hedef 'Denetim gevşetilmez: || true, continue-on-error ve test atlama yoktur' diyor.
- GV-171 · `harness/test/test_is_akisi.py:49` — run_satirlari blok başlığı olarak yalnız `|`, `>`, `|-` ve `>-` biçimlerini tanıyor.
- GV-171 · `harness/test/test_is_akisi.py:57` — Hedefteki 'yerel main başvurusunun kurulması' adımı (kapi.yml:28-30) testte sınanmıyor.
- GV-172 · `backend/src/shared/yapi/infrastructure/yapi-denetimi.ts:702` — yorumsuz önce blok yorumları siliyor, sonra satır yorumlarını.
- GV-172 · `backend/src/shared/yapi/infrastructure/yapi-denetimi.ts:849` — Hedefte ihlal tanımı 'yasak adlar alan adı olarak geçerse'.
- GV-172 · `backend/src/shared/yapi/infrastructure/yapi-denetimi.spec.ts:1006` — Spec taban commit'te (6972f32) deponun .prettierrc ayarına göre biçimliydi, şimdi değil.
- GV-173 · `harness/test/test_butun_denetim_raporu.py:41` — Tekrar eden kod: bolum() (:41-43) ve H (:37) harness/test/test_ozet.py:71-73 ve :18 ile birebir aynı.
- GV-173 · `docs/yerel-deneme.md:34` — 'Aynı komutlar yerelde' bloğu, kapi.yml'in zincir ve arka-yuz işlerinin kapı komutundan önce koşturduğu `pnpm install --frozen-lockfile` ve `pnpm -C backend prisma:generate` adımlarını yazmıyor.
<!-- oneriler:bitir -->

## 4. Kullanıcının verdiği kararlar

Üçünün de tek kaydı bu oturumun konuşması ve aşağıda sayılan görev notudur; söz defterinde yoktur (7. bölüm madde 4).

1. **İşin kendisi** (2026-11-27, ileti): "/Users/burak.genc/Downloads/Dextra denetim raporu.md gerekenleri yap planı çıkart". Plan sunulduktan sonra: "yürüt".
2. **GV-168, değer olarak geçen bayrak** (soru penceresi): "Kapalı kalsın". Bayrağa benzeyen ve tek başına ayrı sözcük olan değer (`-m -n`, `-m "--no-veri"`) reddedilir. Kayıt: `.harness/gorev/GV-168/notlar.json` (14:32:26). Kartın hedef metni eski kısıtı taşımaya devam ediyor (7. bölüm madde 1).
3. **GV-168, önceden var olan iki atlatma** (soru penceresi): "Evet, aynı yaprakta". Satır devamıyla bölünen komut ve `--attr-source` seçeneğinden sonra gelen alt komut aynı yaprakta kapandı. Kayıt: aynı not.

## 5. Ajanın verdiği kararlar

Hepsi teyidini bekler; bu iş için tasarım kaydı ya da karar düğümü açılmadı (9. bölüm madde 4).

**Ana oturumun kararları**

1. Tek epic, altı yaprak; bulgu 4 plan dışı. Gerekçe: TS-010 taslağı (başka oturum, `arac-sertlestirme` ağacı) aynı işi "işaret yoksa uygulama açılmaz" biçiminde tasarlıyor.
2. PR özeti `pull_request_target` ile, taban dalın koduyla üretilir (teknik: güvenilen tabandan çalıştırma). Kazanç: PR kendi özetini susturamaz. Bedel: yazma yetkili belirteçle koşar, PR kodu orada hiç çalıştırılmamalıdır. Alternatif: özeti kapı iş akışının içinde üretmek.
3. İşçi ortamı izin listesiyle süzülür; varsayılan liste PATH, HOME, USER, LOGNAME, SHELL, TMPDIR, LANG, LC_*, TERM, TZ. Kazanç: yeni eklenen bir belirteç kendiliğinden sızmaz. Bedel: gereken değişken unutulursa oturum açılmaz. Alternatif: ret listesi. Bu makinede gerçek oturumlar varsayılan listeyle açıldı (GV-169 alındıktan sonraki 12 koşu).
4. MCP varsayılan olarak yalnız işçiye verilir (`mcp_roller: ["uygulayici"]`); inceleyici artık context7 almaz.
5. Dört kural sınaması yeni denetim düğümü açılmadan DN-002'nin koşturduğu yapı denetimine eklendi. Kazanç: kapıya yeni komut ve süre girmez. Bedel: tek dosya büyüdü (689 satırdan 886'ya). Alternatif: kural başına ayrı denetim düğümü.
6. GitHub eylemleri commit özetine sabitlendi (2026-11-27'de `gh api` ile okunan sürümler: checkout v7.0.1, setup-node v7.1.0, pnpm/action-setup v6.1.1, setup-python v7.1.0).
7. Kapı iş akışı e2e testlerini de koşturur. Gerekçe: KU-011'in açılış denetimi yalnız orada çalışıyor.
8. GV-170'in düzeltme yönü: `--taban` verilmezse taban dal ucun git nesnesinden okunur; iş akışı `--taban`'ı açıkça verir. İncelemenin önerdiği yoldur.
9. GV-171'in ikinci koşusunda özet iş akışının güvenlik testi iki yerde sıkılaştırıldı (iş düzeyinde izin, PR'ın deposunu çeken adım). İncelemenin önerisiydi, engel değildi.
10. Üç atlatma bilerek kapatılmadı ve izleyen işe bırakıldı: bash'in `$'...'` tırnağı, git takma adı, yorum satırındaki satır devamı (3. bölüm, GV-168).
11. Yürütme için Docker Desktop'ı ve durmuş iki kapsayıcıyı (`dextra-postgres`, `dextra-redis`) ben başlattım; `harness.json`'da araç geliştirme kipini açtım (`6972f32`) ve epic bitince kapattım (`ec733fc`).

**İşçilerin kararları** (tamamı: her görevin `bitis.json` dosyasında, `kararlar` alanı)

- GV-168: push tanıyıcısının sözcük yolu `_komutta` işlevine çıkarıldı, iki tanıyıcı onu paylaşıyor; `--no-v` ön eki alt komuttan bağımsız aranıyor; tam yazımın metin deseni korundu.
- GV-169: süzme tek yerde (`_ortam`) yapıldı; yerel liste ayardakine eklenir, daraltamaz; testlerin ortak deposu sahte oturumların kip değişkenlerini adıyla sayıyor.
- GV-170: komut yalnız git nesnelerini okur; başvuru adları `rev-parse --verify` ile sınanır.
- GV-171: PR özeti işaretli tek yoruma yazılır ve yenilenir; araç testleri için koşucuda git kimliği ortam değişkeniyle verilir.
- GV-172: uç işaretleri kaynak metninden okunur (denetleyiciler içe aktarılmaz); gerçek depoda uç sayısı bağımsız sayımla karşılaştırılır (sabit sayı yazılmadı); yasak ad, alan olarak değil sözcük olarak aranır (3. bölümdeki yanlış alarm önerisine bak).

## 6. Duruşlar ve nedenleri

Atılan görev yok. Dört görev yeniden koştu:

1. **GV-169, işçi "kısmi" bitirdi.** Ortam süzgeci, kartın dosya listesinde olmayan üç test dosyasını kırdı (`test_acikuc.py`, `test_kapi.py`, `test_butun_ts009.py`: sahte işçilerine kipi ortam değişkeniyle veriyorlar). İşçi onlara dokunmadı ve durdu. Dosya listesi genişletildi, ikinci koşu ve inceleme geçti.
2. **GV-168, iki kez incelemede kaldı.** Birinci: kod, değer olarak geçen tek başına sözcüğü de reddediyordu ve kartın kısıtı bunu yasaklıyordu; seçimi sen yaptın (4. bölüm madde 2). İkinci: satır devamını silen satır, kaçışlı ters bölüden sonraki satır sonunu da siliyor ve iki komutu birleştiriyordu; push kapısına yeni bir atlatma ekliyordu. Üçüncü koşuda yalnız tek sayıda ters bölü birleştiriliyor; üçüncü inceleme geçti.
3. **GV-170, bir kez incelemede kaldı.** `--taban` verilmeyince taban dal çalışma ağacındaki `harness.json`'dan okunuyordu; commit edilmemiş tek satır özeti susturabiliyordu. İkinci koşuda yalnız git nesneleri okunuyor; ikinci inceleme geçti.
4. **GV-171, bir kez incelemede kaldı.** İşçinin testi iş listesinin tam olarak dört iş olmasını ve sırasını istiyordu (kırılgan tam liste sınaması). Kapsama sınamasına çevrildi; ikinci inceleme geçti.
5. **`plan yurut` elle yeniden koşturulan yaprağı incelemedi.** 14:35'teki çağrı "0 yaprak alındı" deyip çıktı; GV-168, GV-169, GV-170 ve GV-171 için `gorev incele` ve `gorev al` ayrı ayrı çağrıldı.

## 7. Hatalar

1. **GV-168 kartında hedef ile ölçüt çelişiyordu.** Hedefin kısıtı `-m "--no-veri"` örneğini reddedilmeyenler arasında sayıyor, ölçüt ise `-m "--no-veri hakkında"` örneğini sınatıyordu; kancanın bugün de tam yazımı ileti içinde reddettiğini kartı yazarken hesaba katmadım. Sonuç iki fazladan koşu. Karar sana soruldu ve görev notuna yazıldı; kartın metnini düzeltemedim (madde 4).
2. **GV-169 kartının dosya listesi dardı.** Kendi `harness.json`'unu yazan test dosyalarını aramadan yalnız iki test dosyası saydım. `gorev genislet` ile düzeltildi.
3. **GV-170 kartı kendi içinde çelişiyordu.** "Çalışma ağacını okumaz" ile "`--taban` verilmezse ayardaki taban dal" yan yana duruyordu ve ayarın nereden okunacağını yazmadım.
4. **Verdiğin iki soru cevabı söz defterine yazılmadı.** Ölçülenler: söz defteri bugün için boş (GV-168'in inceleyicisi `h.py soz --gun 2026-11-27` ile ölçtü: 0 kayıt); oturum ana ağaçta açıldı ve yerel `main` o sırada GitHub'ın 37 commit gerisindeydi (PR #19 çekilmemişti); ana ağaçtaki `.claude/settings.json`, soru cevabını deftere yazan kanca kaydını taşımıyor (kayıt o 37 commit'in içinde). Çıkarımım: oturumun kancaları ana ağaçtaki eski ayardan ve eski araç kodundan koştu. Sonucu: inceleyiciler kararın senden geldiğini bağımsız doğrulayamadı (GV-168'in iki incelemesinde öneri olarak duruyor). Oturum yalıtımı ana ağaçtaki dosyayı yazdırmadığı için GV-168 kartının kısıt cümlesi de eski hâliyle kaldı. Yerel `main`'in geride olduğunu başta fark edip sana yazdım, ama yürütmeden önce çözmedim.
5. **Oturum sayısını yanlış tahmin ettim.** 12 dedim, 21 oldu (33,45 dolar).
6. **Denetim raporunun 3. bulgusundaki git denemesini yineleyemedim.** Kanca, deneme komutunu metnindeki bayrak yüzünden reddetti; işçi ve inceleyiciler de gerçek git ile ölçemedi. Bulgu, raporun kendi ölçümüne (git 2.43) ve inceleyicinin `git rev-parse --parseopt` ölçümüne dayanıyor.
7. **Üç işçi dosyayı komutla yazdı ve kanca yakalamadı.** GV-168 ve GV-171 işçileri bir düzeltmeyi kabuktan python ile yazdıklarını kendileri bildirdi; GV-172'de yürütme "kapı dışı yazım" uyarısı verdi (`yapi-denetimi.spec.ts`, biçim sapmasıyla). Hata benim değil ama aracın boşluğu: görev oturumundaki "dosyayı komutla yazmaz" yasağı python ile yazmayı görmüyor (9. bölüm madde 6).

## 8. Araçta değişenler

1. **Kanca daha çok komutu reddediyor** (`harness/hook/ajan_hook.py`; GV-168). Kapı atlatan bayrağın `--no-v` ile başlayan her kısaltması, commit'in kısa `-n` seçeneği (birleşik kümede de), satır devamıyla bölünen çağrı ve `--attr-source` seçeneğinden sonra gelen alt komut artık tanınıyor. Yan etki: iletisi tek başına `-n` ya da `--no-v…` olan commit reddedilir (senin kararın).
2. **İşçi ve inceleyici oturumlarının ortamı süzülüyor** (`harness/gorev.py`; GV-169). Yeni ayar `gorev.ortam_izinli`; varsayılan liste koddadır (PATH, HOME, USER, LOGNAME, SHELL, TMPDIR, LANG, LC_*, TERM, TZ). Listede olmayan değişken (örnek: `SSH_AUTH_SOCK`) görev oturumuna, hazırlık komutuna ve ön kontrol komutlarına geçmez. Makineye özel ad `harness.yerel.json` içindeki `gorev.ortam_izinli` ile eklenir.
3. **MCP yalnız ayarda sayılan role verilir** (GV-169). Yeni ayar `gorev.mcp_roller`; varsayılan `["uygulayici"]`. İnceleyici artık context7 almaz.
4. **Yeni komut** `python3 harness/h.py ozet [--taban <başvuru>] [--uc <başvuru>]` (GV-170): kabule geçen düğümler, kabul edilmiş düğümdeki değişiklik ve kapı dosyalarındaki değişiklik; yalnız git nesnelerini okur.
5. **Depoda iki GitHub iş akışı var** (`.github/workflows/`; GV-171). Araç kodu değil ama kapıdır: `kapi.yml` zincir denetimini ve bütün testleri, `ozet.yml` PR özetini koşturur.
6. **Yapı denetimi dört madde daha sınıyor** (q, r, s, t; GV-172). Push kapısındaki DN-002 artık guard sırasını, uç işaretlerini, isteği yapanı gösteren adı ve feature'daki guard ya da süzgeç kopyasını da yakalar.
7. `harness.json` değişmedi: geliştirme kipi açıldı (`6972f32`) ve kapatıldı (`ec733fc`). Yeni iki ayarın değeri dosyaya yazılmadı; koddaki varsayılan geçerli.

## 9. Kullanıcıdan beklenenler ve açık işler

1. **Dalın gönderilmesi ve PR.** Dal gönderilmedi; senin sözünü bekliyor. Sunucu tarafı kapının ilk gerçek koşusu o PR'da görülecek. Koşucuda `postgres:19-alpine` imajının çekilebildiği, `node-version: 24`'ün 24.15 ve üstünü verdiği ve PR'ın birleştirme commit'inde `denetle --dal`'ın çalıştığı ölçülmedi; ilk koşu kırmızı çıkabilir.
2. **`main` dalının korunması ve ajanın kimliği (bulgu 2).** Senin GitHub ayarın. Önerim: `main` için "PR zorunlu, dört kontrol (zincir, arac-testleri, arka-yuz, on-yuz) geçmeden birleşmez, 1 onay zorunlu" kuralı ve ajan için ayrı bir hesap. Aynı hesabın belirteciyle açılan PR'ı sen onaylayamazsın; tek hesapla "onay zorunlu" kurulmuyor.
3. **`harness.json` için üç değer.** `orkestrasyon` kapansın mı (denetim raporunun küçük notu: işçinin alt ajanları araç sınırını aşıyor); MCP hangi rollerde açık kalsın (bugün koddaki varsayılan: yalnız işçi); lint, derleyici ve iş akışı dosyaları `korunan_ayar`'a girsin mi (girerse ajan onları düzenlerken kanca sana sorar).
4. **Bilgi tabanı.** Bu dalda hiçbir düğüm yazılmadı. Yazılması gerekenler, hepsi senin kabulünle: KU-009, KU-010, KU-011 ve KU-013'ün DN-002'ye, KU-007'nin DN-003'e bağlanması (denetim düzeyi mekanik; sürüm artar); DN-002'nin metninin dört yeni maddeyi sayması; "kapılar sunucuda da koşar" kararı ve kuralı. Bunların kapattığı açık uçlar: KU-007/AU-2, KU-010/AU-2, KU-011/AU-2, KU-013/AU-1.
5. **Yerel `main`.** GitHub'ın 37 commit gerisinde; ana ağaçta `git pull --ff-only` gerekli. Yapılmadan açılan her oturum eski kanca ayarıyla koşar (7. bölüm madde 4).
6. **İzleyen iş önerileri** (hiçbiri yapılmadı; ayrıntı 3. bölümde):
   - Kanca: bash'in `$'...'` tırnağı, git takma adı ve yorum satırındaki satır devamı ile kapı hâlâ atlatılabiliyor (GV-168).
   - Kanca: görev oturumunda python ile dosya yazma görülmüyor (7. bölüm madde 7).
   - Yapı denetimi: `isteyenId` adı yerel değişken olarak da ihlal sayılıyor; KU-013'ün kendi uygun örneği kırmızıya düşebilir. Yorum silici, dizge içindeki `/*` yüzünden kod atlayabiliyor (GV-172).
   - `h.py ozet`: tabandaki `harness.json` bozuksa korunan ayar listesi sessizce boşalıyor (GV-170).
   - İş akışı testi: `|| exit 0` ve `if: false` ile gevşetmeyi ve "yerel main" adımının silinmesini yakalamıyor (GV-171).
   - `yapi-denetimi.spec.ts` beş yerde depo biçiminden sapıyor (GV-172).
7. **Bulgu 4.** TS-010 taslağı `arac-sertlestirme` ağacında, kabul bekliyor ve 3 commit'i gönderilmedi; bu dalla ilgisi yok.

## 10. PR'lar

Yok. Dal (`worktree-denetim-raporu-bulgulari`) gönderilmedi: gönderme ve PR senin sözünü bekliyor (9. bölüm madde 1).

## 11. Günlük

Saatler görevlerin koşu geçmişinden (`kosular.jsonl`) ve commit'lerden okundu; hepsi 2026-11-27.

- 13:59 — Oturum ana ağaçta açıldı; denetim raporu okundu. Yerel `main`'in denetlenen commit'in gerisinde olduğu görüldü; bulgular `origin/main` üzerinde doğrulandı.
- 14:03 — Oturum `denetim-raporu-bulgulari` ağacına geçti ve dal `fdbceef`'e ileri sarıldı. EP-014 ve altı görev kartı yazıldı (GV-168 … GV-173).
- 14:13 — "yürüt". Geliştirme kipi açıldı (`6972f32`); Docker ve iki kapsayıcı başlatıldı.
- 14:14 — Yürütme başladı: GV-168, GV-169 ve GV-172 yan yana koştu.
- 14:30 — GV-172 alındı. Yürütme durdu: GV-168 incelemede kaldı, GV-169 kısmi bitti.
- 14:31 — GV-169'un dosya listesi genişletildi ve yeniden koştu. 14:32 — İki soru cevaplandı; GV-168 notla yeniden koştu.
- 14:42 — GV-169 alındı. GV-168'in ikinci incelemesi satır devamı gerilemesini buldu; 14:43'te üçüncü koşu.
- 14:50 — GV-168 alındı. GV-170'in 14:46'da başlayan incelemesi kaldı; 14:51'de yeniden koştu, 14:58'de alındı.
- 14:58 — GV-171 koştu; 15:06'da başlayan incelemesi kaldı; 15:22'de yeniden koştu; 15:37'de alındı.
- 15:38 — GV-173 koştu, incelendi ve 15:50'de alındı; epic bitti.
- 15:51 — Birleşmiş dalda dokuz araç test dosyası ve yapı denetimi spec'i koşturuldu; geliştirme kipi kapatıldı (`ec733fc`); bu rapor yazıldı.
