---
name: mimari-tara
description: Kodu salt okuyarak tarar, mimari sürtünmeyi (sığ modül, sızan dikiş, sınanamayan yer) bulur ve derinleştirme adaylarını güç sırasıyla listeler; kullanıcı birini seçer, seçilen aday tasarla ile sürer. Dönemsel bakımda ya da bir bölge değiştirmesi zorlaşmaya başladığında ana oturum elle çağırır.
argument-hint: <isteğe bağlı: bakılacak yön — modül, alt sistem ya da sıkıntı>
disable-model-invocation: true
---

Kodu mimari sürtünme için tara: $ARGUMENTS

Bu skill hiçbir dosyayı değiştirmez. Çıktısı öneri listesidir; çıktı konuşmaya ve geçici bir dosyaya yazılır,
depoya yazılmaz: seçilen aday tasarım kaydına dönüşür, seçilmeyenler depoda bayatlamaz (TS-009, AK-13).
Adaylar `kod-tasarimi` sözlüğüyle yazılır: modül, arayüz, derinlik, dikiş, bağdaştırıcı, kaldıraç, yerellik.

## Ne zaman

- Dönemsel bakım: son haftalarda sık değişen bir bölge var ve her değişiklik birkaç dosyaya yayılıyor.
- Kullanıcı bir modülün, alt sistemin ya da bir sıkıntının üstüne gidilmesini istiyor.
- Bir epic bitti; yeni epic açmadan önce zeminin durumu görülmek isteniyor.

## Ne zaman değil

- Bilgi tabanındaki çelişki ve bayat kararlar için: `kb-tara`.
- Tek bir parçanın tasarımı konuşulurken: doğrudan `kod-tasarimi`.
- Görev oturumunda: bu skill yalnız ana oturumda, kullanıcı çağırınca koşar.

## Adımlar

1. **Yönü seç.** Kullanıcı bir yön verdiyse onu al ve aşağıdaki çıkarımı atla. Vermediyse git geçmişinden son dönemde
   sık değişen dosyaları bul: `git log --since=60.days --name-only --pretty=format: | sort | uniq -c | sort -rn | head -30`.
   Değişiklikler dağınıksa ve belirgin sıcak nokta yoksa ağı genişlet. Neden: derinleştirme gelecekteki değişikliği
   kolaylaştırır, en çok değişen yerde en çok karşılığını verir.
2. **Kararları oku.** O bölgeye düşen karar ve tasarım düğümlerini bul ve oku: `python3 harness/h.py sor <yol>`,
   gerekirse `python3 harness/h.py sor <KİMLİK>`. Kabul edilmiş kararlar yeniden tartışılmaz; aday çıkarırken onları bil.
3. **Keşif alt ajanını gönder.** Taze bağlamlı bir `kesif` alt ajanı başlat. İstem `[gorev] rol=kesif` satırıyla ve
   `python3 harness/h.py paket --rol kesif --yol <bölge>` çıktısıyla başlar. Ondan kodu katı bir yöntemle değil kendi
   yoluyla gezmesini ve şu sürtünmeleri dosya:satır ile not etmesini iste:
   - bir kavramı anlamak için çok sayıda küçük parça arasında gidip gelmek;
   - arayüzü gerçeklemesi kadar karmaşık sığ parça;
   - yalnız test için ayrılmış işlev (hata çağrıldığı yerde kalıyor, yerellik yok);
   - dikişten sızan bağ: iki modül birbirinin içini biliyor;
   - sınanamayan ya da yalnız arayüzün arkasından sınanabilen yer.
   Şüpheli her parçaya silme testini uygulasın: silinince karmaşıklık toplanıyor mu, yalnız yer mi değiştiriyor?
4. **Adayları yaz.** Her aday için:
   - **Dosyalar**: hangi modüller ve dosyalar;
   - **Sorun**: sürtünme nedir, kanıtı (dosya:satır);
   - **Öneri**: ne değişir, düz cümleyle; arayüz önerme, onu `tasarla` yapar;
   - **Kazanç**: yerellik ve kaldıraç diliyle; testler nasıl iyileşir;
   - **Güç**: güçlü, araştırmaya değer ya da spekülatif.
   Listenin en üstüne **ilk önerilen aday** yazılır: hangisi ve neden önce o.
5. **Kararlarla çelişeni ayıkla.** Kabul edilmiş bir kararla çelişen aday ancak sürtünme gerçekse yazılır ve kararın
   kimliğiyle işaretlenir: "KR-005 ile çelişir; yeniden açmaya değer, çünkü…". Bir kararın yasakladığı her kuramsal
   düzenlemeyi listeleme. KU-008'in katmanları ve repository arayüzleri aday değildir (`kod-tasarimi`, bu deponun
   kurallarıyla ilişkisi).
6. **Çıktıyı ver.** Listeyi konuşmaya yaz ve aynısını `$TMPDIR/mimari-tara-<yyyymmdd-hhmm>.md` dosyasına koy;
   dosyanın mutlak yolunu söyle. Sonra kullanıcıya sor: "Hangisini açalım?"
7. **Seçileni sürdür.** Kullanıcı bir aday seçerse `tasarla` ile sür: kısıtlar, bağımlılıklar, derinleşmiş modülün
   biçimi, dikişin arkasında ne duracağı, hangi testlerin kalacağı.
8. **Reddi kaydet.** Kullanıcı bir adayı gerekçeyle reddederse karar taslağı öner: "Bunu karar olarak yazalım mı,
   sonraki tarama yeniden önermesin?" Yalnız gerekçe sonraki taramanın bilmesi gereken türdense öner; "şimdi değil"
   gibi geçici ya da kendiliğinden belli gerekçede önerme. Kabul edilirse `karar` skill'iyle taslak açılır.

## Yapma

- Hiçbir dosyayı değiştirme; çıktıyı depoya (`docs/`, `kb/` ya da başka bir yere) yazma.
- Kullanıcı seçmeden arayüz ya da uygulama önerme; tarama aday listesiyle biter.
- "Servis", "bileşen", "API" deme; `kod-tasarimi` terimlerini kullan.
- Kanıtı olmayan adayı güçlü diye yazma; dosya:satır gösteremiyorsan en çok spekülatiftir.
- Alt ajanı kural paketi olmadan başlatma.

## İlgili skill'ler

- `kod-tasarimi`: adayların dili ve silme testi.
- `tasarla`: seçilen adayın sürdüğü yer. `karar`: gerekçeyle reddedilen adayın kaydı.
- `kb-tara`: aynı işin bilgi tabanı için olanı.

## Sınırlar

Tarama bir modelin yargısıdır: gerçek sürtünmeyi kaçırabilir, olmayanı görebilir. Güç düzeyi ölçüm değil kanaattir;
sonucu kapı değildir, zinciri kırmızı yapmaz. Git geçmişi sık değişeni gösterir, kötü tasarımı değil: sıcak nokta
yalnız nereye bakılacağını söyler.

Kaynak: mattpocock/skills `improve-codebase-architecture` ve `grilling` (commit 6f7f783), MIT lisanslı; metin kopyalanmadı, fikir Türkçeye ve bu deponun kurallarına uyarlandı.
