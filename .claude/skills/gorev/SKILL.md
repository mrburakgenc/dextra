---
name: gorev
description: Tek bir işi görev kartıyla ayrı bir oturumda (claude -p), kendi çalışma ağacında koşturur, inceletir ve sonucunu denetler. Tek adımlık bir işi ana oturumun dışında yaptırmak gerektiğinde kullan; çok adımlı işte plan skill'ini kullan.
argument-hint: <koşturulacak iş>
---

Şu işi ayrı bir oturumda koştur: $ARGUMENTS

Sen orchestrator'sın: işi sen yapmazsın; kartı yazar, koşumu ve incelemeyi başlatır, sonucu ölçer ve kullanıcıya getirirsin.

## Ne zaman

- İş tek adım, sınırı belli ve ana oturumun bağlamını doldurmadan yapılabilir.
- Bir planın duran yaprağı elle yeniden koşturulacak.

## Ne zaman değil

- Birden çok adım var: `plan`.
- İş konuşarak netleşecek ya da tasarım kararı içeriyor: önce konuş ya da `tasarla`.
- Değişiklik birkaç satır ve bu oturumda yapılabilir: ayrı oturumun bedeline değmez.

## Adımlar

1. İşin dokunacağı dosyaları belirle ve mümkün olan en dar yol desenini seç.
2. Kartı aç: `python3 harness/h.py gorev yeni "<başlık>" --rol uygulayici --yol <desen> --hedef "<bittiğinde ne değişmiş olacak>" --olcut "<bunun nasıl sınanacağı>"`. İşçi yalnız kartı görür; gerekeni hedefe ve ölçüte yaz. Ölçüt gözlenebilir olsun: durum, eylem, beklenen sonuç, olmaması gereken ve nasıl doğrulanacağı. Komut işe düşen taslak kural ve kararları uyarı satırıyla sayarsa kullanıcıya söyle: kabul edilmeden bağlayıcı gitmez, kartta yalnız bilgi bloğundadır. Komut "kapsam geniş", "kart büyük" ya da "liste dışı içe aktaranlar" uyarısı verirse (kartın sonunda "Kapsam notu" olarak da durur; engel değildir) kullanıcıya söyle: işi bölmeyi ya da liste dışı dosyaları yola eklemeyi düşün.
3. Koştur: `python3 harness/h.py gorev kos GV-NNN`. Hook bu komutu kullanıcıya sorar. İşçi tur ya da süre sınırında bitiş kaydı yazmadan kesilir ve ağaçta değişiklik varsa araç onu aynı komutta bir kez kendiliğinden sürdürür (`gorev.kendiliginden_devam`; 0 kapatır). İşçiye karar iletmek için (örneğin inceleme kaldıktan sonra) `--not "..."` ver; not o koşuda ve sonrakilerde işçinin istemine girer.
4. Raporu oku: durum, değişen dosyalar, sorunlar, uyarılar, işçinin kararları ve reddettiği seçenekler. "Kapı dışı yazım" uyarısı (düzenleme kapısından geçmeden, kabukla ya da betikle değişen dosyalar) engel değildir; kullanıcıya söyle: inceleme kartı bu dosyaları ve onlara düşen kuralları ayrıca verir.
5. Koşum temizse incelet: `python3 harness/h.py gorev incele GV-NNN`. İnceleyici işi yapmayan ayrı bir oturumdur ve işçinin öz değerlendirmesini görmez.
6. İnceleme raporunu kullanıcıya ver: sonuç, bulgular, her kural için inceleyicinin hükmü ve işçiyle çeliştiği yerler.
7. İnceleme geçtiyse al: `python3 harness/h.py gorev al GV-NNN` (hook sorar). İş bu oturumun dalına birleştirilir; görevin ağacı ve dalı silinir. Alma çakışmayla ya da başka bir hatayla yarıda kalırsa oturum dalı ve görev ağacı alma öncesine döner ve çakışan dosyalar bildirilir; çakışmayı giderdikten sonra (oturum dalında, gerekirse ardından `gorev tazele GV-NNN` ve yeniden inceleme) görevi yeniden koşturmadan yeniden al. Birleştirmeden sonra ağacın ya da dalın silinmesi hata verirse iş alınmış sayılır ve uyarı verilir; aynı komutu yeniden çalıştırınca yalnız kalan temizlik yapılır. Aynı anda başlayan almalar sıraya girer (`gorev.alma_bekleme_sn`).
8. İşçinin verdiği her karar için bir karar taslağı öner (`karar`); bilgi tabanına işçi değil sen yazarsın, kabulü kullanıcı verir.
9. Dalı göndermeden önce raporu yaz: `python3 harness/h.py rapor yeni "<konu>"` raporu açar ve görev tablosunu kayıtlardan üretir; elle yazılan bölümleri (en az kısa özet ve kullanıcıdan beklenenler) doldur ve commit et; `python3 harness/h.py rapor durum` raporsuz görev, boş bölüm ve commit edilmemiş rapor göstermiyorsa gönder. Push kapısı raporu dalın ucundaki commit'te arar ve raporsuz görevde durur.

## Yapma

- Sorunlu ya da uyarılı koşumu kendin düzeltmeye girişme, gizleme: kullanıcıya olduğu gibi söyle; karar onundur (yeniden koştur, ağacı oturum dalının ucuna getir: `gorev tazele GV-NNN`, dosya listesini genişlet: `gorev genislet GV-NNN --yol <desen>` (hook sorar) ya da `gorev at`; işi başka bir görevle yaptıysan eskisini `gorev at GV-ESKİ --yerine GV-YENİ` ile at, zaten atılmışsa `gorev yerine GV-ESKİ GV-YENİ`).
- Ölçüm kayıtlarını (`durum.json`, `rapor.json`, `inceleme-rapor.json`, koşu geçmişi `kosular.jsonl`) elle düzenleme; hook reddeder.
- İşçinin "bitti" demesini kanıt sayma: kanıt ölçüm ve inceleme raporudur.
- Görevin dosyalarında ya da `kb/` altında commit edilmemiş değişiklik varken koşturma: koşum reddedilir, önce kullanıcıya söyle.
- Sonucu gördükten sonra kartın hedefini ya da ölçütünü değiştirme, işçinin ağacına dokunma: araç ikisini de ölçer ve işi incelemez, almaz.

## İlgili skill'ler

- `plan`: çok adımlı iş. `hata-ayikla`: işçi başarısız bir testte bunu kullanır.
- Süreç eklentisinin alt ajanla geliştirme skill'i aynı oturumun içinde alt ajan başlatır; bu skill ayrı oturum, ayrı çalışma ağacı ve ölçülen bir teslim ister.

## Sınırlar

İşçi bağımsız bir oturumdur: yalnız projenin ayarlarını yükler (kişisel talimatlar, eklentiler ve MCP sunucuları gitmez) ve komutlarını kum havuzunda koşar — kendi ağacında test çalıştırabilir, dışına yazamaz, commit atamaz. Ağ gerekiyorsa (paket kurmak gibi) alan adını `harness.json` içinde `gorev.ag_izinli` listesine kullanıcı yazar. İşçi ve inceleyici soru soramaz; hüküm de onların yargısıdır, kanıt değildir.
