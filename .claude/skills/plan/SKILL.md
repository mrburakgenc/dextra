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
4. Epic'i task'lara böl. Tek oturumda bitecek task yapraktır: `python3 harness/h.py plan task EP-NNN "<başlık>" --hedef "..." --olcut "..." [--yol <desen>] [--once 1,2]`.
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

11. Epic'i yürüt: `python3 harness/h.py plan yurut EP-NNN`. Hook kullanıcıya bir kez sorar; onaydan sonra hazır yapraklar sırayla koşar, incelenir ve bu dala alınır. Uzun epic'te komutu arka planda koştur ya da `--en-cok N` ile parça parça yürüt.
12. Yürütme ilk sorunda durur. Durduğu yeri ve nedeni kullanıcıya olduğu gibi söyle. Karar kullanıcınındır: yaprağı yeniden koştur (`gorev kos GV-NNN`) ya da at (`gorev at GV-NNN`), sonra yürütmeyi sürdür.
13. Epic bitince kullanıcıya şunu ver: alınan ve atılan yapraklar, işçilerin verdiği kararlar (taslak karar önerileriyle) ve inceleyicilerin önerileri.

## Yapma

- İşareti elle koyma: yaprak, görevi alınınca kendiliğinden `[x]` olur; elle konan işareti hook reddeder, `plan durum` da geri alır.
- Duran yaprağı kendin düzeltmeye girişme; sorunu gizleme.
- Sırası olmayan yaprakların dosya kümelerini çakıştırma: yan yana koşabilirler.
- Onayı atlatmak için komutu bir betiğe sarma.
- Commit edilmemiş karar ya da kuralla yürütme: işçi yalnız commit edilmiş hâli görür.

## İlgili skill'ler

- `tasarla`: plandan önce. `gorev`: tek yaprağı elle yürütmek için.
- Süreç eklentisinin plan yazma skill'i varsa adımları düşünmek için kullanılabilir; çıktı onun plan belgesine değil bu ağaca yazılır ve yürütmeyi bu skill yapar.

## Sınırlar

Kapsayıcı task'ın ve epic'in kendi kabul ölçütü ayrıca sınanmaz; "bitti", yapraklarının alınmış olması demektir (9. adım bunun içindir). Plan ana çalışma ağacında durur: başka bir ağaçtaki oturum aynı ağacı görür ve bir yaprağı koşturabilir ya da inceletebilir.
