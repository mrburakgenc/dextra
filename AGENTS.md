# İskelet

Bu depoda kurallar ve kararlar `kb/` altında, birbirine ve koda bağlı düğümler olarak tutulur.
`harness/h.py` zinciri denetler; hook'lar kuralları doğru anda ajanın önüne koyar.
Tasarımın tamamı: `docs/tasarim/2026-11-20-iskelet-harness-tasarimi.md` (bu depoda yoksa iskelet deposundadır).

## Ajan için dokuz kural

1. Kurallar hakkındaki her cevap bir komut çıktısına ve bir kimliğe dayanır; tahmin edilmez.
2. Karar ve kural taslak olarak yazılır (`python3 harness/h.py yeni <tür> "<başlık>"`); kabulü yalnız kullanıcı verir. Kullanıcı isteyince `python3 harness/h.py kabul <KİMLİK> ...` komutunu sen çalıştırırsın, hook taslağı kullanıcıya gösterip sorar; dosyada durum elle çevrilmez, soru atlatılmaz.
3. Üretilen dosyalar (`.claude/rules/`, `.claude/agents/`, bu dosyadaki işaretli blok) elle düzenlenmez; `kb/` değişir, sonra `python3 harness/h.py uret` koşulur.
4. Bir dosyayı düzenlerken hook o dosyaya düşen kuralları gösterip ilk denemeyi reddeder; kuralları oku, sonra yeniden dene.
5. Alt ajan başlatırken görev metninin başına `[gorev] rol=<rol>` satırı ve `python3 harness/h.py paket --rol <rol>` çıktısı konur; eksikse hook reddeder ve doğru paketi verir.
6. **Her oturum kendi çalışma ağacında (worktree) çalışır.** Bu projede worktree kullanmak zorunludur: ana çalışma ağacındaysan düzenlemeden önce `EnterWorktree` aracıyla kendi ağacına geç; ana ağaçta düzenlemeyi hook reddeder.
7. Ayrı oturumda koşacak iş görev kartıyla verilir; her görev kendi çalışma ağacında ve kendi dalında, kum havuzunda koşar. Onay ayarı (`harness.json`, `gorev.onay`) açıkken kullanıcıya epic başına bir kez (`plan yurut`), tek başına koşturulan görevde de koşturma, alma ve atmada sorulur; bu depoda ayar kapalıdır (kullanıcının seçimi) ve bu komutlar sorulmadan koşar. Kabul, açık uç kapatma, açık uca dayanan sorunun cevabı ve taslağa rağmen koşturma ayardan bağımsız olarak her zaman sorulur. Onayı atlatmak için komutu bir betiğe sarmak yasaktır.
8. Bir iş, onu yapmayan ikinci bir oturum incelemeden alınmaz; işçinin "bitti" demesi kanıt değildir, ölçüm ve inceleme raporu okunur.
9. İş planı dört düzeylidir: **space** (özellik) → **epic** (geliştirilecek konu) → **task** → **subtask**. Koşturulan birim yapraktır (subtask ya da bölünmemiş task). İşaret elle konmaz: yaprak, görevi alınınca işaretlenir; task, epic ve space ondan türer. Görevin ölçüm kayıtları da elle yazılmaz.

## Komutlar

| Komut | Ne için |
|---|---|
| `python3 harness/h.py denetle` | Zincir sağlam mı |
| `python3 harness/h.py sor <yol \| KİMLİK>` | Bir dosyaya ne uygulanır; bir düğüm nereden gelir |
| `python3 harness/h.py paket --rol <rol> [--yol ...] [--konu ...]` | Bir ajana verilecek kural paketi |
| `python3 harness/h.py yeni <tür> "<başlık>"` | Taslak düğüm: karar, kural, yapi, tasarim, kavram, denetim |
| `python3 harness/h.py kabul <KİMLİK> [<KİMLİK> ...]` | Taslağı kabul et; hook kullanıcıya sorar. Karar ile kuralları tek komutta verilir |
| `python3 harness/h.py uret` | Üretilen dosyaları yenile |
| `python3 harness/h.py durum` | Kaç düğüm, hangi hâlde, ne bekliyor |
| `python3 harness/h.py etki <KİMLİK>` | Bu düğüm değişirse ne etkilenir: bağlı düğümler (adım adım), dosyalar, denetimler |
| `python3 harness/h.py sorgu "<SELECT>"` | Zinciri SQL ile sor (yalnız okur); argümansız çağrı tabloları ve örnekleri gösterir |
| `python3 harness/h.py graf [--html]` | Zincirin çizimi (Mermaid); `--html` tarayıcıda açılan sayfayı `.harness/graf.html` olarak yazar |
| `python3 harness/h.py dizin` | Zinciri `.harness/dizin.db` dosyasına dök (SQLite); görünümdür, kapılar ona bakmaz |
| `python3 harness/h.py plan space "<özellik>" --amac "..." --yol <desen>` | Bir özellik için space aç |
| `python3 harness/h.py plan epic <space> "<başlık>" --hedef "..."` | Space'in altında epic aç |
| `python3 harness/h.py plan task EP-NNN "<başlık>" [--once 1,2] [--hedef "..." --olcut "..."]` | Task ekle: hedef ve ölçütle yaprak (görev kartı açılır), onlarsız kapsayıcı |
| `python3 harness/h.py plan subtask EP-NNN <task-no> "<başlık>" --hedef "..." --olcut "..." [--once 1,2]` | Task'ın altına subtask ekle; görev kartı açılır |
| `python3 harness/h.py plan yurut EP-NNN [--en-cok N]` | Epic'i tek onayla yürüt: hazır yapraklar sırayla koşar, incelenir, alınır; ilk sorunda durur |
| `python3 harness/h.py plan durum [<space> \| EP-NNN]` | Ağaç, türetilmiş işaretler, şimdi ne koşturulabilir |
| `python3 harness/h.py gorev yeni "<başlık>" --rol <rol> --yol <desen> --hedef "..." --olcut "..."` | Plansız tek görev kartı |
| `python3 harness/h.py gorev kos GV-NNN` | Görevi kendi çalışma ağacında `claude -p` ile koştur; kullanıcıya sorulur. Ortam ön kontrolü (`gorev.on_kontrol`; yola eklenecek klasörler depoya girmeyen `harness.yerel.json` dosyasında) kalırsa oturum başlamaz; bitiş kaydında `testler` alanı zorunludur |
| `python3 harness/h.py gorev incele GV-NNN` | İşi yapmayan ikinci bir oturuma incelet |
| `python3 harness/h.py gorev al GV-NNN` | Temiz ve incelenmiş işi bu oturumun dalına birleştir; kullanıcıya sorulur. İnceleme kaydı ölçüt hükmü (`olcut`) taşımalı, "geçti" hükmü koşturulmuş komut (`kosulan`) istemeli; ölçüt karşılanmadıysa alınmaz |
| `python3 harness/h.py gorev at GV-NNN` | Görevin ağacını ve dalını sil; kullanıcıya sorulur |
| `python3 harness/h.py gorev durum` | Bütün görevler ve aşamaları |
| `python3 harness/h.py rapor yeni "<konu>"` | İşin raporunu şablondan aç; görev tablosunu araç üretir, kısa özet ve kullanıcıdan beklenenler elle yazılır |
| `python3 harness/h.py rapor uret <dosya>` | Raporun görev tablosunu kayıtlardan yenile |
| `python3 harness/h.py rapor durum` | Raporsuz görevler ve boş bölümler; push kapısı aynı şeyi arar ve raporsuz dalı göndermez |
| `python3 harness/h.py soz [--gun YYYY-AA-GG] [--agac AD]` | Söz defteri: kullanıcının iletileri ve soru cevapları, zaman sırasıyla; `rapor yeni` bu ağacın sözlerini raporun 4. bölümüne koyar |
| `python3 harness/h.py ozet [--taban <başvuru>] [--uc <başvuru>]` | PR özeti: ortak atadan uca kabule geçen düğümler, kabul edilmiş düğümde değişiklik ve kapı dosyalarındaki değişiklik; yalnız git nesnelerinden okur, karar vermez. `--taban` verilmezse taban dal uçtaki `harness.json`'dan okunur; güvenilmeyen uçta açıkça verilir |

Plan ve mimari işlerinde: `harness/protokol/tasarim.md`.

## İş akışları (skill)

`.claude/skills/<ad>/SKILL.md` altında durur; `/ad` ile çağrılır, uygun durumda kendiliğinden de yüklenir.

| Skill | Ne zaman |
|---|---|
| `tasarla` | Mimari, veri modeli, yeni özellik ya da geri alması pahalı bir karar konuşulurken |
| `karar` | Bir seçenek sabitlenecekken; çıktı taslak karar düğümüdür |
| `kural` | Bir kararın yükümlülüğü bağlayıcı hâle getirilecekken |
| `plan` | Çok adımlı iş space → epic → task → subtask ağacına dökülecek ve yürütülecekken |
| `gorev` | Tek adımlık iş ayrı oturumda koşturulacakken |
| `hata-ayikla` | Bir test ya da komut beklenmedik biçimde başarısız olduğunda |
| `test-yaz` | Yeni davranış eklenirken ya da bir hata düzeltilmeden önce test yazılacakken |
| `kb-ice-al` | Var olan bir belge taslak düğümlere dökülecekken |
| `kb-tara` | Kurallar arası çelişki, bayat karar ve boşluk aranacakken |
| `kod-tasarimi` | Yeni parça ya da soyutlama eklenirken, bir arayüz biçimlenirken ya da karmaşıklık incelenirken; ortak sözlük ve silme testi |
| `mimari-tara` | Kodda mimari sürtünme ve derinleştirme adayları aranacakken; ana oturum elle çağırır, salt okur |
| `on-yuz-tasarimi` | Ekran ya da arayüz parçası yazılırken ya da görünümü değişirken; tasarım sistemi belgesi, kalite tabanı, boş/yükleniyor/hata durumları |

Bilgi tabanının günlüğü (`kb/GUNLUK.md`) elle yazılmaz; taslak açılınca ve kabul verilince araç ekler.

<!-- harness:uretilen-basla -->
<!-- ÜRETİLDİ: harness/h.py uret — elle düzenlenmez; kaynağı kb/ -->

### Çekirdek kurallar

- KU-001@1 [gözden geçirme] Ajan bir karar ya da kural düğümünü taslak olarak yazar; düğümü kabul durumuna yalnız kullanıcı getirir. (KR-001)
- KU-002@1 [gözden geçirme] Commit ve push kapıları atlanmaz: kapıyı devre dışı bırakan bayrak kullanılmaz, hook yolu değiştirilmez; kapı kırmızıysa nedeni düzeltilir. (KR-001)
- KU-003@1 [gözden geçirme] Ana çalışma ağacında dosya düzenlenmez: oturum işe başlamadan kendi çalışma ağacına geçer, ayrı oturuma verilen her görev de kendi ağacında ve kendi dalında koşar. (KR-002)
- KU-004@1 [gözden geçirme] Bir görevin işi, onu yapmayan bir oturum inceleyip geçirmeden birleştirilmez; plan adımının işareti ve görevin ölçüm kayıtları elle yazılmaz, onları araç üretir. (KR-002)
- KU-005@1 [gözden geçirme] İstenen işi karşılayan en az kod yazılır: istenmemiş özellik, tek yerde kullanılan soyutlama, istenmemiş ayar ya da esneklik ve olamayacak durum için hata yönetimi eklenmez. (KR-003)
- KU-006@1 [gözden geçirme] Yalnız işin gerektirdiği satırlar değiştirilir: komşu kod, yorum ve biçim "iyileştirilmez", çalışan kod yeniden düzenlenmez; değişen her satır hedefe bağlanabilmelidir. (KR-003)
- KU-016@1 [mekanik DN-001] Bu dalda alınan her görev, dal gönderilmeden önce `docs/rapor/` altındaki bir raporda yer alır; raporun görev tablosunu araç üretir, kısa özet ile kullanıcıdan beklenenler elle yazılır ve boş bırakılmaz. (KR-015)

### Yapı haritası

- (henüz kabul edilmiş yapı yok)

### Sormak

- Bir dosyaya ne uygulanır: `python3 harness/h.py sor <yol>`
- Bir düğüm nereden gelir, nereye gider: `python3 harness/h.py sor <KİMLİK>`
- Bir role hangi kurallar verilir: `python3 harness/h.py paket --rol <rol>`
<!-- harness:uretilen-bitir -->
