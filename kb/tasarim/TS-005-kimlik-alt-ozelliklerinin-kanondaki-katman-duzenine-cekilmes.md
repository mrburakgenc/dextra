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
- Kapsam dışı: HTTP sözleşmesi (adresler, gövdeler, kodlar, iletiler) ve veritabanı; ön yüz.
- Kapsam genişledi (kullanıcı, 2026-11-25: "_shared ve shared içini de aynı düzene çek"): `kimlik/_shared` ve ortak kod (`backend/src/shared`) da kanondaki katman düzenine çekilir (aşağıda "Ortak kodun ve feature içi ortak klasörün düzeni").
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
    repositories/<ad>.<teknoloji>-repository.ts   (kökte dosya durmaz; repository olmayan parça kendi klasöründe)
  presentation/
    <alt-özellik>.controller.ts
  <alt-özellik>.module.ts
```

Sorumluluklar:
- Değer nesnesi: ham girdiyi alır, kuralı uygular, ya markalı tipi ya da ret kodunu döndürür ve sınırlarını dışa açar (örnek: rol adı baştaki ve sondaki boşluk atıldıktan sonra 1–100 karakter; ret kodları "kısa" ve "uzun"). Ret kodunu cevaptaki iletiye çevirmek komutun yanındaki alan yardımcısının işidir (Seçenekler 4); eşleme tüketici yazılır, eşlenmemiş kod derlenmez.
- Varlık: oluşturma işlevi değer nesnelerinden kaydın yazılacak hâlini üretir; durum kararları olguları alır (örnek: "sistem rolü mü", "boş mu") ve "tamam" ya da adlı bir ret döndürür. Varlık veritabanından doldurulmaz: yazma kapısı satırı yeteneğin şartıyla veritabanında bulur ve kişi göremediği kolonu okuyamaz (KR-008); bu yüzden karar işlevi satırın tamamını değil, işleyicinin topladığı olguları alır.
- Komut ve sorgu: girdinin biçimini Zod ile doğrular; alan kuralı için değer nesnesini çağırır. Ret, bugünkü `dogrulama_hatasi` cevabıyla aynı biçimde döner.
- İşleyici beş adımdır: bağlamdan isteyeni al; domain nesnesini ya da kararı kur; işlemi aç; kapıdan yaz ve notu bırak; sonucu döndür. İş kuralı içermez.
- Sonuç: işleyicinin döndürdüğü düz veri tipi; çatıdan bağımsızdır. Okumada kayıt, kişinin görebildiği kolonları taşıyan düz kayıttır (yetki kapısının verdiği hâl); okuma tarafında varlık kurulmaz.
- Repository arayüzü: adı `I` ile başlar (`IRolOkumaRepo`, `IRolYazmaRepo`); yazma tarafı da arayüz ve belirteçtir, soyut sınıf değildir.

### Ortak kodun ve feature içi ortak klasörün düzeni
Kanon (`ARCHITECTURE.md` "Shared Tekelliği" ve "Key Files Reference"): ortak koddaki her konu kendi küçük katmanlı düzenini taşır (`shared/<konu>/{domain,application,infrastructure}`); gözlemlenebilirlik alt alanlara bölünür; hata süzgeçleri `shared/filters` altındadır; konular arası sözleşmeler `shared/<konu>/domain/i-<ad>.contract.ts` adını taşır. Feature içi ortak klasör `_shared/{domain,application,infrastructure}` düzenindedir.

Dosyanın katmanı içeriğinden belirlenir (denetlenebilir kural):
- domain: saf tip, sabit, hata tipi, sözleşme ve saf kural; yalnız başka domain dosyalarını ve dilin kendi modüllerini içe aktarır.
- application: hizmet, arayüz (port), derleyici, düzenleyici; domain'i, çatının bağımlılık enjeksiyonu süsleyicilerini ve saf kitaplıkları içe aktarabilir; veritabanı istemcisini, kuyruk kitaplığını ve HTTP bağlayıcı sınıflarını (guard, boru, süzgeç, denetleyici) içe aktarmaz.
- infrastructure: geri kalan her şey: veritabanı ve kuyruk gerçeklemeleri, repository'ler, guard, boru, süzgeç, denetleyici, açılış denetimi, komut satırı girişleri.
- Modül dosyası (`<konu>.module.ts`) konunun kökünde durur.

```
shared/
  database/        {domain, application, infrastructure}
  guvenlik/        {domain, application, infrastructure}
  yetki/           {domain, application, infrastructure}
  kimlik/          domain/i-<ad>.contract.ts            (kimliğin uyguladığı sözleşmeler)
                   application/i-<ad>.port.ts           (doğrulama kitaplığının ya da işlemin tipini taşıyan arayüz)
  messaging/       {domain, application, infrastructure}
  tohum/           {domain, application, infrastructure}
  http/            {domain, application, infrastructure} (doğrulama borusu, kodlu hata)
  filters/         hata süzgeci                          (kanondaki yeri)
  observability/   erisim/  iz/  health/  istek-baglami/ (alt alanlar; kanondaki yeri)
  domain/          sonuc.ts                              (domain işlevlerinin ortak sonuç tipi)

features/kimlik/_shared/
  domain/          saf tipler; repositories/i-<ad>.repository.ts (çekirdek repository arayüzleri)
  application/     çekirdek parçalar (genel sayaç, kişi kilidi, kök üyelik, bütünlük sorusu, bağlantı, ...)
  infrastructure/  repositories/ (çekirdek repository gerçeklemeleri), tohum/ (kurulum göçü)
  kimlik-cekirdek.module.ts
```

Sözleşmenin saf tipleri domain'de durur; arayüzün kendisi doğrulama kitaplığının ya da veritabanı işleminin tipini taşıyorsa port olarak application'a girer (GV-116'nın sorusu: giriş yöntemi sözleşmesi böyle ikiye bölündü). Konu adları değişmez (`guvenlik`, `yetki`, `tohum` Türkçe; `database`, `messaging`, `observability` bugünkü gibi): yeniden adlandırma bu işin dışındadır. Bugün tek dosyada duran arayüz ile gerçekleme (çekirdek repository'ler) ikiye ayrılır: arayüz ve belirteç domain'e, gerçekleme infrastructure'a. Lint ayarındaki yol desenleri (çekirdek sınırı, ham istemci sınırı, katman tanımları) yeni yollara taşınır; hiçbir kural gevşetilmez.

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

### 4. Alan kuralının ret iletisi (GV-106 incelemesi)
Bugün geçersiz alanın `dogrulama_hatasi` cevabındaki `neden` metni doğrulama kitaplığının kendi İngilizce iletisidir ("Too small: expected string to have >=1 characters") ve ön yüz onu form alanının altında gösterir. Kural değer nesnesine taşınınca iletiyi kim üretecek sorusu çıktı.
- A — Ret iletisini değer nesnesi üretir ve Türkçedir. Ajanın ilk seçimiydi; geri alındı: yalnız değer nesnesi olan alanların iletisi Türkçeleşir, eksik alan, yanlış tip ve fazla alan iletileri İngilizce kalır (karışık dil) ve taşıma işi sözleşmeyi değiştirmiş olur.
- B (seçildi; kalıp böyle yazıldı) — Değer nesnesi ret kodunu döndürür ("kısa", "uzun") ve sınırlarını dışa açar; komutun yanındaki alan yardımcısı kodu kitaplığın kendi sorununa çevirir. Kazanç: taşıma hiçbir cevabı değiştirmez, kural yine tek yerdedir, domain'e kitaplık girmez. Bedel: ileti bugünkü gibi İngilizce kalır.
- Ayrı iş (bu epic'in dışında; sözleşme değişikliği olduğu için kendi görevi ve incelemesi olur): doğrulama iletilerinin tek yerden Türkçeleştirilmesi (doğrulama borusunda kitaplığın yerelleştirmesi), böylece bütün alan iletileri aynı dilde olur.

### Ajan kararları (kullanıcı teyidi bekler)
- AK-1: Doğrulamanın yeri: Zod şeması komutun ve sorgunun yanındadır (Seçenekler 1-A).
- AK-2: Adların dili: Türkçe adlar kalır, kanonun kalıbı Türkçe uygulanır (Seçenekler 2-A; kanon İngilizce ad ister).
- AK-3: Varlığın kapsamı: varlık yalnız yazma tarafındadır; okuma düz kayıt döndürür (Seçenekler 3-A).
- AK-4: Alan kuralının ret iletisi: değer nesnesi ret kodu döndürür, ileti değişmez (Seçenekler 4-B).
- AK-5: Komut yolu (bus) ve ortak taban sınıfı eklenmez, işleyici doğrudan çağrılır; isteyen bilgisi istek bağlamından gelir (KU-013).
- AK-6: İşleyicinin yanında birim testi zorunlu değildir: kurallar domain'e taşındığı için birim testleri domain dosyalarının yanındadır, işin bütünü uçtan uca testlerle sınanır (kanondan sapma).
- AK-7: Sonuç dosyası yalnız işleyici veri döndürüyorsa yazılır.

## Aşamalar
Hepsi çift yönlüdür (dosya düzeni ve adlar; veri ve sözleşme değişmez).
1. Yapı denetimi ve kalıp: denetim yazılır ve `rol` alt özelliği hedef düzene çekilir; `rol` öbür görevlerin örneğidir.
2. Öbür alt özellikler `rol` kalıbına çekilir: kullanıcı, grup, üyelik, yetenek (dosyaları kesişmez; yan yana koşabilir), sonra parola ve ardından oturum (oturum parolanın giriş yöntemini içe aktarır).
3. Feature içi ortak klasör (`kimlik/_shared`) düzene çekilir.
4. Ortak kod üç adımda düzene çekilir (içe aktarma yolları bütün depoda değiştiği için sırayla): yetki, güvenlik ve kimlik sözleşmeleri; veritabanı, tohum ve mesajlaşma; HTTP, süzgeçler ve gözlemlenebilirlik.
5. Denetim sıkılaşır: taşınmamış alt özellik kalmadığı ve ortak kodun düzeni de sınanır.

## Doğrulama
- Yapı denetimi (birim testi; `backend/src/shared/yapi/`): `features/*/*` altındaki her alt özelliğin düzenini kurallara karşı sınar ve ihlalleri dosya yoluyla bildirir. Taşıma sürerken yalnız taşınmış alt özellikler (içinde `application/commands` ya da `application/queries` olanlar) sınanır; son adımda hepsi.
- Davranış: taşınan alt özelliğin uçtan uca test dosyaları beklentileri değişmeden geçer (yalnız içe aktarma yolları değişebilir); sonda senaryo testi ve ön yüzle gerçek tarayıcı denemesi.
- Domain kuralları: her değer nesnesi ve varlık kararının yanında birim testi vardır.
