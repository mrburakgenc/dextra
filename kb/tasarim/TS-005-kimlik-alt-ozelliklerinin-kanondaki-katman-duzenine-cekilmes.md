---
kimlik: TS-005
tur: tasarim
durum: taslak
surum: 1
baslik: Kimlik alt özelliklerinin kanondaki katman düzenine çekilmesi: komut ve sorgu klasörleri, domain kuralları, repository arayüzleri
agirlik: cift-yonlu
tarih: 2026-11-25
---
`kimlik` feature'ının yedi alt özelliği (kullanıcı, grup, rol, üyelik, yetenek, oturum, parola) çalışıyor ama kanonun alt özellik düzenine uymuyor; bu tasarım, davranışı değiştirmeden kodu o düzene çeker ve düzenin bir daha kaymaması için makineyle denetlenmesini sağlar.

## Sorun
Kullanıcının itirazı (2026-11-25, kendi sözü): "interface katmanı nerede, dosyalarda i-repository kısımları yok gibi; domainin domain kuralları nerede göremedim, validasyon kuralları yok gibi, ne var ne yok kaydediyor; command query result olarak klasörlü değil yapı, hepsi bir yerde duruyor; orada CQRS'i tam inceletmedin gibi duruyor."

Ölçüm (2026-11-25, bu depo): 34 işleyici var; 6 komut ve 6 sorgu dosyası var; sonuç dosyası 0; `domain/entities` klasörü 0; repository arayüzleri `domain/<ad>.repository.ts` içinde (9 dosya), beş alt özellikte yazma tarafı arayüz değil soyut sınıf; işleyicinin yanında birim testi 0. İş kuralları dört yere dağılmış: ucun Zod şeması (sunum katmanı), işleyici, kimliğin ortak "bütünlük soruları" ve veritabanı kısıtları.

Dayanak: KR-005 (taslak) kanonun alt özellik düzenini alır ve kullanıcı 2026-11-23'te "DDD tam sağlanmalı, kurallar tam geçmeli" demiştir; "sapma gerekiyorsa önce bu karar değiştirilir". Sapma kullanıcıya hiç getirilmedi (ajanın hatası): ilk kartlara kanonun klasör düzeni yazılmadı, sonraki kartlar "var olan kodu örnek al" dedi ve düz düzen yedi alt özelliğe yayıldı. Mimari kuralların hepsi taslak olduğu için işçilere ve inceleyicilere bağlayıcı kural olarak da gitmedi.

- Amaç: yedi alt özelliğin dosya düzeni, adları ve katman sorumlulukları aşağıdaki "Yapı"ya uyar; iş kuralları domain katmanında durur.
- Kapsam dışı: HTTP sözleşmesi (adresler, gövdeler, kodlar, iletiler) ve veritabanı; `kimlik/_shared` klasörünün iç düzeni; ortak kodun (`shared/`) iç düzeni; ön yüz. Bunlar ayrı iştir.
- Başarının ölçüsü: yapı denetimi 0 ihlal bildirir; taşınan alt özelliğin uçtan uca testleri beklentileri değişmeden geçer.

## Kısıtlar
- Davranış değişmez: her ucun adresi, yöntemi, gövdesi, durum kodu, hata kodu ve iletisi aynı kalır; denetimlerin sırası da (hangi durumda `bulunamadi`, hangisinde `cakisma` döndüğü bilgi sızdırmamak için sıraya bağlıdır) aynı kalır.
- Kaynağa erişim yetki kapılarından geçmeye devam eder (KR-010); çekirdek yollar ve çekirdek parçalar değişmez (TS-002).
- Katman yönü (KU-008, taslak): sunum uygulamayı, uygulama domain'i kullanır; altyapı domain'deki arayüzü gerçekler; domain hiçbir katmanı ve çatıyı içe aktarmaz.
- Doğrulama kitaplığı Zod'dur (KR-014); yeni paket eklenmez.
- Şema ve göç değişmez.

## Değişmezler
1. Domain katmanı saftır: çatı, veritabanı istemcisi, HTTP hata sınıfı ve Zod içe aktarmaz; kural ihlalini sonuç değeri olarak bildirir, işleyici onu HTTP hatasına çevirir.
2. Bir iş kuralı tek yerde yazılır: alan kuralı (uzunluk, biçim) değer nesnesinde, durum kuralı (silinebilir mi, yenilenebilir mi) varlıkta; ucun şeması ve işleyici o kuralı çağırır, kopyalamaz.
3. Varlığın oluşturma işlevi yalnız değer nesnesi alır; böylece uçtan gelmeyen bir çağıran (tohum, başka bir işleyici) da kuraldan geçmeden kayıt üretemez.
4. Her iş (use case) kendi klasöründedir ve tek işleyicisi vardır; bir işleyici sınıfı birden çok işi taşımaz.
5. Sunum katmanında şema dosyası yoktur; denetleyici komutun ya da sorgunun şemasını uygulama katmanından alır.

## Yapı
Hedef düzen (kanon: `kb/_gelen/ARCHITECTURE.md` "features/<feature>/<sub-feature>"; adlar bu deponun Türkçe adlandırmasıyla):

```
<alt-özellik>/
  domain/
    entities/<varlık>.entity.ts            varlık: oluşturma işlevi, değişmezler, durum kararları (+ .spec.ts)
    value-objects/<ad>.ts                  kuralı olan alan (isteğe bağlı; + .spec.ts)
    repositories/i-<ad>.repository.ts      repository arayüzleri ve belirteçleri
    services/<ad>.ts                       birden çok varlığı ilgilendiren saf kural (isteğe bağlı)
    <ad>.port.ts                           dış yetenek arayüzü (isteğe bağlı; örnek: parola özetleyici)
  application/
    commands/<iş>/<iş>.command.ts          Zod şeması ve ondan türeyen komut tipi
                  <iş>.handler.ts          tek işleyici, tek `calistir`
                  <iş>.result.ts           işleyici veri döndürüyorsa
    queries/<iş>/<iş>.query.ts             Zod şeması ve sorgu tipi
                 <iş>.handler.ts
                 <iş>.result.ts
    _shared/                               alt özellik içi ortak yardımcı (isteğe bağlı)
  infrastructure/
    repositories/<ad>.<teknoloji>-repository.ts
  presentation/
    <alt-özellik>.controller.ts
  <alt-özellik>.module.ts
```

Sorumluluklar:
- Değer nesnesi: ham girdiyi alır, kuralı uygular, ya markalı tipi ya da ret iletisini döndürür (örnek: rol adı baştaki ve sondaki boşluk atıldıktan sonra 1–100 karakter).
- Varlık: oluşturma işlevi değer nesnelerinden kaydın yazılacak hâlini üretir; durum kararları olguları alır (örnek: "sistem rolü mü", "boş mu") ve "tamam" ya da adlı bir ret döndürür. Varlık veritabanından doldurulmaz: yazma kapısı satırı yeteneğin şartıyla veritabanında bulur ve kişi göremediği kolonu okuyamaz (KR-008); bu yüzden karar işlevi satırın tamamını değil, işleyicinin topladığı olguları alır.
- Komut ve sorgu: girdinin biçimini Zod ile doğrular; alan kuralı için değer nesnesini çağırır. Ret, bugünkü `dogrulama_hatasi` cevabıyla aynı biçimde döner.
- İşleyici beş adımdır: bağlamdan isteyeni al; domain nesnesini ya da kararı kur; işlemi aç; kapıdan yaz ve notu bırak; sonucu döndür. İş kuralı içermez.
- Sonuç: işleyicinin döndürdüğü düz veri tipi; çatıdan bağımsızdır. Okumada kayıt, kişinin görebildiği kolonları taşıyan düz kayıttır (yetki kapısının verdiği hâl); okuma tarafında varlık kurulmaz.
- Repository arayüzü: adı `I` ile başlar (`IRolOkumaRepo`, `IRolYazmaRepo`); yazma tarafı da arayüz ve belirteçtir, soyut sınıf değildir.

## Seçenekler
Üç karar ajanındır (kullanıcı devretti: "tamam onları da yap", 2026-11-25); kabul edilmiş karar değildir, kullanıcı teyidi bekler.

### 1. Doğrulamanın yeri
- A (seçildi) — Zod şeması komutun ve sorgunun yanında: kanondaki "komut HTTP gövdesi görevini de görür" düzeni, sınıf süsleyicileri yerine Zod ile. Kazanç: sunum katmanında şema kalmaz, uygulama katmanı sunumdan içe aktarmaz (AK-36'nın sorunu biter), kural tek yerdedir. Bedel: 34 işin şeması taşınır.
- B — Şema sunumda kalır: taşıma yok; ama işleyiciyi uçtan başka yoldan çağıran doğrulamayı atlar ve katman yönü bozuk kalır.
- C — Kanondaki gibi sınıf süsleyicili doğrulama: KR-014 ile çelişir ve yeni paket ister.

### 2. Adların dili
- A (seçildi) — Türkçe adlar kalır, kanonun kalıbı Türkçe uygulanır: klasör `<iş>` (`rol-olustur`), dosya sonekleri kanondaki gibi (`.command.ts`, `.handler.ts`, `.result.ts`, `.query.ts`), tipler `RolOlusturKomutu`, `RolOlusturHandler`, `RolOlusturSonucu`, `RolListeleSorgusu`. Kazanç: bilgi tabanı, veritabanı ve uçlarla aynı dil; yeniden adlandırma yükü yok. Bedel: kanonun CQRS-01 maddesindeki İngilizce ad örneklerinden sapma.
- B — İngilizce adlar (`CreateRoleCommand`): kanonla birebir; ama bütün tanımlayıcılar, notlardaki iş adları ve testler yeniden adlandırılır, kod iki dilli olur.

### 3. Varlığın kapsamı
- A (seçildi) — Varlık yazma tarafındadır; okuma düz kayıt döndürür (komut ve sorgunun ayrıldığı düzen). Kazanç: kolon sınırı korunur (kişi göremediği kolonu varlık üzerinden de göremez), okuma yolu yalın kalır. Bedel: varlık satırdan doldurulmadığı için durum kararları olguları parametre alır.
- B — Her işte satırın tamamı varlığa doldurulur: klasik düzen; ama kolon sınırını deler ya da çekirdek dışı yeni bir okuma yolu ister (KR-010 Seçim 48'e aykırı).

Ek ajan kararları: komut yolu (bus) ve ortak taban sınıfı eklenmez, işleyici doğrudan çağrılır (isteyen bilgisi istek bağlamından gelir; KU-013). İşleyicinin yanında birim testi zorunlu değildir: kurallar domain'e taşındığı için birim testleri domain dosyalarının yanındadır, işin bütünü uçtan uca testlerle sınanmaya devam eder (kanondan sapma; teyit bekler). Sonuç dosyası yalnız işleyici veri döndürüyorsa yazılır.

## Aşamalar
Hepsi çift yönlüdür (dosya düzeni ve adlar; veri ve sözleşme değişmez).
1. Yapı denetimi ve kalıp: denetim yazılır ve `rol` alt özelliği hedef düzene çekilir; `rol` öbür görevlerin örneğidir.
2. Öbür alt özellikler `rol` kalıbına çekilir: kullanıcı, grup, üyelik, yetenek (dosyaları kesişmez; yan yana koşabilir), sonra parola ve ardından oturum (oturum parolanın giriş yöntemini içe aktarır).
3. Denetim sıkılaşır: taşınmamış alt özellik kalmadığı sınanır.

## Doğrulama
- Yapı denetimi (birim testi; `backend/src/shared/yapi/`): `features/*/*` altındaki her alt özelliğin düzenini kurallara karşı sınar ve ihlalleri dosya yoluyla bildirir. Taşıma sürerken yalnız taşınmış alt özellikler (içinde `application/commands` ya da `application/queries` olanlar) sınanır; son adımda hepsi.
- Davranış: taşınan alt özelliğin uçtan uca test dosyaları beklentileri değişmeden geçer (yalnız içe aktarma yolları değişebilir); sonda senaryo testi ve ön yüzle gerçek tarayıcı denemesi.
- Domain kuralları: her değer nesnesi ve varlık kararının yanında birim testi vardır.
