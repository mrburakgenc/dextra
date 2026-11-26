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
3. Koştur: `python3 harness/h.py gorev kos GV-NNN`. Hook bu komutu kullanıcıya sorar. Ortam hazır değilse (hazırlık komutu yolda yoksa ya da `gorev.on_kontrol` komutlarından biri kalırsa) `gorev kos` ve `gorev incele` oturum başlatmadan durur ve kalan komutu söyler: kullanıcıya söyle, ortam düzelince yeniden koştur (yola eklenecek klasörleri kullanıcı depoya girmeyen `harness.yerel.json` dosyasına `{"gorev": {"yol": [...]}}` olarak yazar). Yolları şu an koşan başka bir görevinkilerle kesişen görev başlamaz ve o görevin kimliği söylenir: o oturum bitince yeniden koştur; bunu aşan bayrak yoktur. İşçi tur ya da süre sınırında bitiş kaydı yazmadan kesilir ve ağaçta değişiklik varsa araç onu aynı komutta bir kez kendiliğinden sürdürür (`gorev.kendiliginden_devam`; 0 kapatır). İşçiye karar iletmek için (örneğin inceleme kaldıktan sonra) `--not "..."` ver; not o koşuda ve sonrakilerde işçinin istemine girer. İşe kabul edilmemiş taslak düşüyorsa (yollarına düşen taslak kural ve kararları ya da durumu kabul olmayan dayanağı) komut koşturmaz ve taslakları sayar: önce kullanıcıya bu taslakları kabul edip etmeyeceğini sor (kabul ederse `python3 harness/h.py kabul <KİMLİK> ...`; hook sorar). `--taslakla` (taslaklara rağmen yalnız o koşuya izin; hook her zaman kullanıcıya sorar) yalnız kullanıcı isterse.
4. Raporu oku: durum, değişen dosyalar, sorunlar, uyarılar, işçinin kararları ve reddettiği seçenekler. "Kapı dışı yazım" uyarısı (düzenleme kapısından geçmeden, kabukla ya da betikle değişen dosyalar) engel değildir; kullanıcıya söyle: inceleme kartı bu dosyaları ve onlara düşen kuralları ayrıca verir. İşçinin sorusu bir açık uç kimliği taşıyorsa (`KİMLİK/AU-n`; durumda "yarım kaldı (soru: kullanıcıya)") cevabı sen seçme: soruyu ve açık ucu kullanıcıya getir, onun cevabıyla `python3 harness/h.py gorev kos GV-NNN --cevap "..."` çalıştır (hook her zaman sorar). Karar verilen ucu kullanıcı isterse kapat: `python3 harness/h.py acik-uc kapat <KİMLİK> AU-<n> --karar "..."` (hook her zaman sorar).
5. Koşum temizse incelet: `python3 harness/h.py gorev incele GV-NNN`. İnceleyici işi yapmayan ayrı bir oturumdur ve işçinin öz değerlendirmesini görmez.
6. İnceleme raporunu kullanıcıya ver: sonuç, bulgular, her kural için inceleyicinin hükmü ve işçiyle çeliştiği yerler. Kalan incelemenin bulgusunu işçiye not olarak iletmeden önce koda karşı kendin doğrula; doğrulayamadığın bulguyu iletme, kullanıcıya söyle.
7. İnceleme geçtiyse al: `python3 harness/h.py gorev al GV-NNN` (hook sorar). İş bu oturumun dalına birleştirilir; görevin ağacı ve dalı silinir. Alma çakışmayla ya da başka bir hatayla yarıda kalırsa oturum dalı ve görev ağacı alma öncesine döner ve çakışan dosyalar bildirilir; çakışmayı giderdikten sonra (oturum dalında, gerekirse ardından `gorev tazele GV-NNN` ve yeniden inceleme) görevi yeniden koşturmadan yeniden al. Birleştirmeden sonra ağacın ya da dalın silinmesi hata verirse iş alınmış sayılır ve uyarı verilir; aynı komutu yeniden çalıştırınca yalnız kalan temizlik yapılır. Aynı anda başlayan almalar sıraya girer (`gorev.alma_bekleme_sn`).
8. İşçinin verdiği her karar için bir karar taslağı öner (`karar`); bilgi tabanına işçi değil sen yazarsın, kabulü kullanıcı verir.
9. Dalı göndermeden önce raporu yaz: `python3 harness/h.py rapor yeni "<konu>"` raporu açar, görev tablosunu ve incelemenin önerilerini kayıtlardan üretir (tabloya, başka bir raporun tablosunda 'alındı' ya da 'atıldı' satırı olmayan ve en az bir kez koşmuş görevler girer); elle yazılan bölümleri (en az kısa özet ve kullanıcıdan beklenenler) doldur ve commit et; `python3 harness/h.py rapor durum` raporsuz görev, boş bölüm ve commit edilmemiş rapor göstermiyorsa gönder. Alınmış görev ancak bir raporun tablosunda 'alındı' satırıyla raporlanmış sayılır: var olan bir raporun tablosunda 'bekliyor' gibi eski bir aşamayla duruyorsa o raporda `python3 harness/h.py rapor uret <dosya>` koştur ve commit et. Push kapısı raporu dalın ucundaki commit'te arar ve raporsuz görevde durur.

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
