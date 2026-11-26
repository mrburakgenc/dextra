---
name: plan
description: Bir işi space → epic → task → subtask ağacına döker ve epic'i tek onayla yürütür; her yaprak kendi çalışma ağacında koşar, incelenir, alınınca işaretlenir. Çok adımlı bir iş planlanacak ya da var olan bir epic yürütülecekse kullan.
argument-hint: <planlanacak iş>
---

Şu iş için plan yap ve yürüt: $ARGUMENTS

Sen orchestrator'sın. Plan dört düzeyli bir ağaçtır ve işaretleri ölçümden gelir:

| Düzey | Ne | Örnek |
|---|---|---|
| **space** | Bir özellik (feature): adı, amacı ve yolları vardır; kalıcıdır | Sipariş |
| **epic** | O özellikte geliştirilecek konu: hedefi vardır, biter | İptal nedenleri |
| **task** | İşin kendisi: ya doğrudan koşturulur (yaprak) ya da subtask'lara bölünür | Doğrulama katmanı |
| **subtask** | Task'ın tek oturumluk parçası; her zaman yapraktır | Neden kodu alanı |

Koşturulan birim **yapraktır**: her yaprağın bir görev kartı vardır ve kendi çalışma ağacında koşar.

## Ne zaman

- İş birden çok adımdan oluşuyor ve adımlar ayrı oturumlarda yapılabilir.
- Var olan bir epic'in kalan yaprakları yürütülecek.

## Ne zaman değil

- Tek adımlık iş: `gorev`.
- Ne yapılacağı henüz belli değil ya da tek yönlü bir karar bekliyor: önce `tasarla`.
- Bu oturumda, konuşarak yapılacak küçük iş: plan açma, yap.

## Adımlar

### Planı yazmak

1. Önce var olana bak: `python3 harness/h.py plan durum`. İş var olan bir özelliğe aitse o space'i kullan; yeni space yalnız yeni bir özellik için açılır.
2. Space yoksa aç: `python3 harness/h.py plan space "<özellik adı>" --amac "<bu özellik ne işe yarar>" --yol <desen> [--yol <desen>]`. Yollar özelliğin dosyalarıdır; yaprağa yol verilmezse bunlar kullanılır.
3. Epic'i aç: `python3 harness/h.py plan epic <space> "<başlık>" --hedef "<epic bittiğinde ne değişmiş olacak>"`.
4. Epic'i task'lara böl. Tek oturumda bitecek task yapraktır: `python3 harness/h.py plan task EP-NNN "<başlık>" --hedef "..." --olcut "..." [--yol <desen>] [--once 1,2]`. Komut işe düşen taslak kural ve kararları uyarı satırıyla sayarsa kullanıcıya söyle: kabul edilmeden bağlayıcı gitmez. Komut "kapsam geniş", "kart büyük" ya da "liste dışı içe aktaranlar" uyarısı verirse (kartın sonunda "Kapsam notu" olarak da durur; engel değildir) kullanıcıya söyle: yaprağı bölmeyi ya da liste dışı dosyaları yola eklemeyi düşün.
5. Tek oturuma sığmayan task kapsayıcıdır (`plan task EP-NNN "<başlık>" [--once 1,2]`, hedef ve ölçüt vermeden); altına subtask ekle: `python3 harness/h.py plan subtask EP-NNN <task-no> "<başlık>" --hedef "..." --olcut "..." [--yol <desen>] [--once 1,2]`.
6. Her yaprağın hedefini ve ölçütünü işçi için yaz: işçi yalnız kartı görür, bu oturumdaki konuşmayı bilmez. Hedef bittiğinde neyin değişmiş olacağını, ölçüt bunun nasıl sınanacağını söyler.
   - Ölçütü gözlenebilir yaz: **durum** (hangi girdi, hangi ortam), **eylem**, **beklenen sonuç**, **olmaması gereken** ve **nasıl doğrulanır** (komut ya da test). "Doğru çalışır", "güvenli", "hızlı", "sağlam" gibi sözler gözlenebilir bir kanıta çevrilmeden ölçüt olmaz.
   - Hedefte üç şeyi ayır: depodan doğruladığın olgular, koddan çıkarılamayan kısıtlar, varsayımların.
   - Bölerken: az ve bütünlüklü yaprak; test, uygulamasıyla aynı yaprakta kalır; önkoşul yalnız gerçek kod bağımlılığında yazılır.
7. Yaprağın boyu: tek oturumu dolduracak kadar gerçek iş taşısın. Her yaprak iki oturum (işçi, inceleyici) ister; beş dakikalık işleri ayrı subtask yapma, aynı dosya kümesindeki küçük işleri tek yaprakta topla.
8. Sırayı `--once` ile yaz: task için başka task numaraları, subtask için aynı task'ın subtask sıraları.
9. Epic'in bütününü sınayan bir son yaprak ekle: yaprakların tek tek doğru olması bütünün doğru olduğunu göstermez.
10. Ağacı kullanıcıya göster (`python3 harness/h.py plan durum EP-NNN`).

### Planı yürütmek

11. Epic'i yürüt: `python3 harness/h.py plan yurut EP-NNN`. Hook kullanıcıya bir kez sorar; onaydan sonra hazır yapraklar sırayla koşar, incelenir ve bu dala alınır. Uzun epic'te komutu arka planda koştur ya da `--en-cok N` ile parça parça yürüt. İşe kabul edilmemiş taslak düşen yaprakta (yollarına düşen taslak kural ve kararları ya da durumu kabul olmayan dayanağı; epic'in dayanağı yapraklarına geçer) yürütme durur ve taslakları sayar: önce kullanıcıya bu taslakları kabul edip etmeyeceğini sor (kabul ederse `python3 harness/h.py kabul <KİMLİK> ...`; hook sorar). `--taslakla` (taslaklara rağmen yalnız o yürütmeye izin; hook her zaman kullanıcıya sorar) yalnız kullanıcı isterse. Ortam hazır değilse (hazırlık komutu yolda yoksa ya da `gorev.on_kontrol` komutlarından biri kalırsa) yaprağın oturumu (işçi ya da inceleyici) başlamaz ve yürütme kalan komutu söyleyerek durur; yola eklenecek klasörleri kullanıcı depoya girmeyen `harness.yerel.json` dosyasına `{"gorev": {"yol": [...]}}` olarak yazar. Yaprak ancak kapılardan geçerse alınır: işçinin bitiş kaydında `testler` alanı zorunludur (boş liste olabilir); inceleme kaydında `olcut` (`karsilandi` ve `kanit`) ve `bakilmayan` zorunludur, "geçti" hükmü en az bir koşturulmuş komut (`kosulan`) ister ve `olcut.karsilandi` false ise sonuç "kaldı"dır.
12. Yürütme ilk sorunda durur. Durduğu yeri ve nedeni kullanıcıya olduğu gibi söyle. Karar kullanıcınındır: yaprağı yeniden koştur (`gorev kos GV-NNN`, işçiye karar iletmek için `--not "..."`; yaprak açık uca dayanan soruyla durduysa (`yarım kaldı (soru: kullanıcıya)`) not verilmez: soruyu kullanıcıya götür, cevabını `gorev kos GV-NNN --cevap "..."` ile ver, hook kullanıcıya sorar), ağacını oturum dalının ucuna getir (`gorev tazele GV-NNN`), dosya listesini genişlet (`gorev genislet GV-NNN --yol <desen>`, hook sorar) ya da at (`gorev at GV-NNN`; işi başka bir görevle yaptıysan eskisini `gorev at GV-ESKİ --yerine GV-YENİ` ile at, zaten atılmışsa `gorev yerine GV-ESKİ GV-YENİ`: yerine geçen alınmışsa yaprak işaretli görünür, sayımda yine atıldı sayılır), sonra yürütmeyi sürdür. Yürütme almada (çakışma) durduysa yaprak alma öncesindeki gibi durur: çakışma giderilince yeniden koşturmadan al (`gorev al GV-NNN`, hook sorar), sonra yürütmeyi sürdür.
13. Epic bitince kullanıcıya şunu ver: alınan ve atılan yapraklar, işçilerin verdiği kararlar (taslak karar önerileriyle), inceleyicilerin önerileri ve yürütmenin bildirdiği kapı dışı yazım uyarıları (hangi yaprakta hangi dosyalar).
14. Dalı göndermeden önce raporu yaz: `python3 harness/h.py rapor yeni "<konu>"` raporu açar, görev tablosunu ve incelemenin önerilerini kayıtlardan üretir (tabloya, başka bir raporun tablosunda 'alındı' ya da 'atıldı' satırı olmayan ve en az bir kez koşmuş görevler girer); elle yazılan bölümleri (en az kısa özet ve kullanıcıdan beklenenler) doldur ve commit et; `python3 harness/h.py rapor durum` raporsuz görev, boş bölüm ve commit edilmemiş rapor göstermiyorsa gönder. Alınmış görev ancak bir raporun tablosunda 'alındı' satırıyla raporlanmış sayılır: var olan bir raporun tablosunda 'bekliyor' gibi eski bir aşamayla duruyorsa o raporda `python3 harness/h.py rapor uret <dosya>` koştur ve commit et. Push kapısı raporu dalın ucundaki commit'te arar ve raporsuz görevde durur. `rapor yeni`, söz defterinde bu çalışma ağacında yazılmış kullanıcı iletilerini ve soru cevaplarını 4. bölüme ("Kullanıcının verdiği kararlar") ham liste olarak koyar; o bölümü bu listeden ayıklayarak yaz. Defterin kendisi: `python3 harness/h.py soz [--gun YYYY-AA-GG] [--agac AD]`.

## Yapma

- İşareti elle koyma: yaprak, görevi alınınca kendiliğinden `[x]` olur; elle konan işareti hook reddeder, `plan durum` da geri alır.
- Duran yaprağı kendin düzeltmeye girişme; sorunu gizleme.
- Sırası olmayan yaprakların dosya kümelerini çakıştırma: yan yana koşabilirler.
- Onayı atlatmak için komutu bir betiğe sarma.
- Commit edilmemiş karar ya da kuralla yürütme: işçi yalnız commit edilmiş hâli görür.

## İlgili skill'ler

- `tasarla`: plandan önce. `gorev`: tek yaprağı elle yürütmek için.

## Sınırlar

Kapsayıcı task'ın ve epic'in kendi kabul ölçütü ayrıca sınanmaz; "bitti", yapraklarının alınmış olması demektir (9. adım bunun içindir). Plan ana çalışma ağacında durur: başka bir ağaçtaki oturum aynı ağacı görür ve bir yaprağı koşturabilir ya da inceletebilir.
