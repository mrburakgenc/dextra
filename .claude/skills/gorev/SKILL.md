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
2. Kartı aç: `python3 harness/h.py gorev yeni "<başlık>" --rol uygulayici --yol <desen> --hedef "<bittiğinde ne değişmiş olacak>" --olcut "<bunun nasıl sınanacağı>"`. İşçi yalnız kartı görür; gerekeni hedefe ve ölçüte yaz. Ölçüt gözlenebilir olsun: durum, eylem, beklenen sonuç, olmaması gereken ve nasıl doğrulanacağı. Komut işe düşen taslak kural ve kararları uyarı satırıyla sayarsa kullanıcıya söyle: kabul edilmeden bağlayıcı gitmez, kartta yalnız bilgi bloğundadır.
3. Koştur: `python3 harness/h.py gorev kos GV-NNN`. Hook bu komutu kullanıcıya sorar.
4. Raporu oku: durum, değişen dosyalar, sorunlar, uyarılar, işçinin kararları ve reddettiği seçenekler.
5. Koşum temizse incelet: `python3 harness/h.py gorev incele GV-NNN`. İnceleyici işi yapmayan ayrı bir oturumdur ve işçinin öz değerlendirmesini görmez.
6. İnceleme raporunu kullanıcıya ver: sonuç, bulgular, her kural için inceleyicinin hükmü ve işçiyle çeliştiği yerler.
7. İnceleme geçtiyse al: `python3 harness/h.py gorev al GV-NNN` (hook sorar). İş bu oturumun dalına birleştirilir; görevin ağacı ve dalı silinir.
8. İşçinin verdiği her karar için bir karar taslağı öner (`karar`); bilgi tabanına işçi değil sen yazarsın, kabulü kullanıcı verir.
9. Dalı göndermeden önce raporu yaz: `python3 harness/h.py rapor yeni "<konu>"` raporu açar ve görev tablosunu kayıtlardan üretir; elle yazılan bölümleri (en az kısa özet ve kullanıcıdan beklenenler) doldur; `python3 harness/h.py rapor durum` raporsuz görev ve boş bölüm göstermiyorsa gönder. Push kapısı raporsuz görevde durur.

## Yapma

- Sorunlu ya da uyarılı koşumu kendin düzeltmeye girişme, gizleme: kullanıcıya olduğu gibi söyle; karar onundur (yeniden koştur ya da `gorev at`).
- Ölçüm kayıtlarını (`durum.json`, `rapor.json`, `inceleme-rapor.json`, koşu geçmişi `kosular.jsonl`) elle düzenleme; hook reddeder.
- İşçinin "bitti" demesini kanıt sayma: kanıt ölçüm ve inceleme raporudur.
- Görevin dosyalarında ya da `kb/` altında commit edilmemiş değişiklik varken koşturma: koşum reddedilir, önce kullanıcıya söyle.
- Sonucu gördükten sonra kartın hedefini ya da ölçütünü değiştirme, işçinin ağacına dokunma: araç ikisini de ölçer ve işi incelemez, almaz.

## İlgili skill'ler

- `plan`: çok adımlı iş. `hata-ayikla`: işçi başarısız bir testte bunu kullanır.
- Süreç eklentisinin alt ajanla geliştirme skill'i aynı oturumun içinde alt ajan başlatır; bu skill ayrı oturum, ayrı çalışma ağacı ve ölçülen bir teslim ister.

## Sınırlar

İşçi bağımsız bir oturumdur: yalnız projenin ayarlarını yükler (kişisel talimatlar, eklentiler ve MCP sunucuları gitmez) ve komutlarını kum havuzunda koşar — kendi ağacında test çalıştırabilir, dışına yazamaz, commit atamaz. Ağ gerekiyorsa (paket kurmak gibi) alan adını `harness.json` içinde `gorev.ag_izinli` listesine kullanıcı yazar. İşçi ve inceleyici soru soramaz; hüküm de onların yargısıdır, kanıt değildir.
