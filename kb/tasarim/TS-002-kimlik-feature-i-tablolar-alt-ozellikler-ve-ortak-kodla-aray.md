---
kimlik: TS-002
tur: tasarim
durum: taslak
surum: 1
baslik: Kimlik feature'ı: tablolar, alt özellikler ve ortak kodla arayüzler
agirlik: tek-yonlu
tarih: 2026-11-24
baglam: TS-001
---
Bu tasarım, kullanıcı, oturum, grup, rol, izin, üyelik ve yetenek kavramlarının hangi tablolarda durduğunu, `kimlik` feature'ının alt özelliklerini ve her istekte çalışan ortak kodun bu veriye hangi arayüzlerden ulaştığını belirler; kararların kendisi KR-008, KR-009 ve KR-010'dadır, burası onların tek bir feature'a yerleştirilmesidir.

> Durum (2026-11-24): dördüncü hâldir. Üç bağımsız tur koştu: birinci tur "imzalamam" (20 bulgu, 4 ağır), ikinci tur "imzalamam" (15 yeni bulgu, 2 ağır; çekirdek yapının tuttuğunu yazdı), üçüncü tur dar doğrulamaydı ve "düzeltmelerle imzalarım" dedi (8 yeni bulgu, ağır yok; birinci adıma başlanabileceğini, ikinci adımı bekleten kullanıcı kararı olmadığını yazdı). Üç turun bulguları ajan tarafından belgeyle karşılaştırıldı, geçerli bulundu ve işlendi; ayrıntı "Çürütme" bölümündedir. Bu dördüncü hâl yeniden incelenmedi. "Ajan önerisi" yazan ve teyit taşımayan yerler hâlâ öneridir. Hiçbir şey kodla sınanmadı.

## Sorun
- Amaç: kimlik ve yetki kararlarını (KR-008, KR-009, KR-010) tablolara, alt özelliklere ve arayüzlere dökmek; yürüyen iskeletin ilk feature'ı budur, çünkü öbür her özellik ona dayanır.
- Kapsam dışı: kendi kendine kayıt, kendi kendine parola sıfırlama, çok adımlı doğrulama, donanım anahtarı (KR-009); devredilmiş yönetim, öncelik ve kapatma (KR-008); dosya yükleme; e-posta ile giriş.
- Başarının ölçüsü: KR-008, KR-009 ve KR-010 "Doğrulama" listelerindeki sınamaların bu feature üzerinde yeşil koşması. Sayılı hedefler o kararlardadır.

## Senaryolar
Sayılar kararlardaki hedefler ve varsayılanlardır; hiçbiri ölçüm değildir.
1. Davet. Yönetici "kullanıcı aç" çağırınca sistem aynı işlemde 1 kullanıcı satırı ve 1 (Kök, Temel) üyeliği yazar; parola yöntemi açıksa 1 parola bağlantısı da yazar, bağlantı cevapta 1 kez görünür ve 24 saat geçerlidir (KR-009 Seçim 9). Kişi bağlantıyla parolasını belirler; aynı bağlantının ikinci kullanımı reddedilir (hedef: 0). Yalnız kodla giriş açıksa bağlantı üretilmez; telefon zorunludur ve kişi doğrudan kod isteyerek girer (ajan önerisi; çürütme 11).
2. Giriş. Kişi kullanıcı adı ve parolayla girince sistem 1 oturum satırı açar, 15 dakikalık erişim belirteci, yenileme belirteci ve cihaz sırrı verir; IP adresi ve tarayıcı bilgisi oturuma yazılır. Kişinin en çok 3 açık oturumu olur (varsayılan); dördüncü girişte en eski oturum `oturum_siniri` nedeniyle kapanır ve yeni giriş kabul edilir (kullanıcı teyidi, 2026-11-24; reddedilen: yeni girişin reddedilmesi).
3. Kimlikli istek. Her istekte oturum, kişinin durumu ve iki sürüm sayısı 1 sorguda okunur (hedef: kimlik için ek Redis gidişi 0, ek sorgu 0; KR-009 ölçüt 4). IP ya da tarayıcı bilgisi uymazsa istek reddedilir ve yalnız o oturum kapanır.
4. Yenileme. Geçerli yenileme belirteci ve cihaz sırrıyla gelen istek yeni bir çift alır. Döndürmeyle değişmiş eski belirteç hoşgörü penceresinin dışında gelirse kişinin bütün oturumları kapanır (hedef: aynı belirtecin işe yaradığı yenileme en çok 1; KR-009 ölçüt 2). Bu, kaç nesil eski olursa olsun her eski belirteç için geçerlidir (çürütme 2).
5. Kapatma. Çıkış, yöneticinin kapatması, parola değişimi ya da pasife alma oturum satırını kapatır; kapatmadan sonraki ilk istek reddedilir (hedef: erişimin sürdüğü istek 0; KR-009 ölçüt 1). Kapatmayla yarışan bir giriş, kapatmadan sonra oturum bırakmaz (çürütme 1).
6. Yetki değişimi. Yönetici bir üyelik verince kişinin sayısı aynı işlemde artar ve kişinin bir sonraki iş biriminde yeni yetki geçerlidir (hedef: geri alınan yetkinin sürdüğü iş birimi 0; KR-010 ölçüt 1).
7. Redis kesintisi. Redis'e ulaşılamazken kimlikli istekler çalışmaya devam eder; oturum kapanmaz, yetki veritabanından derlenir (KR-009 Seçim 5).
8. Hareketsizlik. Son döndürmeden sonra 30 dakika (varsayılan; KR-009) yenilenmeyen oturum bir sonraki yenilemede `sure` nedeniyle kapanır ve reddedilir (çürütme 12).

## Kısıtlar
- Tabloların sahibi `kimlik` feature'ıdır (kullanıcı, 2026-11-24); başka feature bu tabloları sorgulamaz (KR-005 Kural 5) ve ortak kod hiçbir feature'ı içe aktarmaz.
- Her alt özellik dört katman taşır (KR-005).
- Veritabanındaki adlar Türkçe ve snake_case'dir; kayıt kimliği zaman sıralı rastgele kimliktir (KR-011 Seçim 7 ve 8).
- Yetki motoru altta CASL, üstte bu deponun katmanıdır; sunucuda veri kararını yalnız veritabanı verir (KR-010 Seçim 37 ve 38).
- Sırlar kaynak olmayan ayrı tabloda durur (KR-008 Seçim 21).
- Feature'lar arası erişim sözleşmeyle ve tüketenin ACL'iyle yapılır (KR-005 Kural 1–7).
- Veri erişimi Unit of Work'ün `run` ve `read` kapılarından geçer; iç içe `run` hata verir; otomatik yeniden deneme yoktur (KR-011).
- Doğrulama uçta Zod şemasıyla yapılır; şemasız parametre hatadır (KR-014).

## Değişmezler
Kaynak kararın numarası parantez içindedir. Her değişmezin yanında onu tutan mekanizma yazılıdır (çürütme 6); mekanizmaların hepsi ajan önerisidir.

| # | Her zaman doğru kalması gereken | Tutan mekanizma |
|---|---|---|
| 1 | Kök grup tektir: üst grubu olmayan tek canlı grup vardır (KR-008 Seçim 15) | canlı ve üstsüz satır için kısmi tekil kısıt |
| 2 | Grup ağacında döngü yoktur (KR-008 Seçim 27) | genel sayaç kilidi altında komut denetimi (oluştur, taşı) |
| 3 | Canlı alt birimi, üyeliği ya da yeteneği olan grup silinemez; rol ve izin yalnız boşken silinir (KR-008 Seçim 22) | genel sayaç kilidi altında komut denetimi |
| 4 | Sistemdeki son canlı (Kök, SuperAdmin) üyeliği silinemez; onu taşıyan kişi pasife alınamaz (KR-008 Seçim 43) | genel sayaç kilidi altında komut denetimi (üyelik kaldır, pasife al, unut). Sayım yalnız açık giriş yöntemlerinden biriyle girebilen üyeleri sayar (üçüncü tur 5): aksi hâlde bir yöntem kapatıldıktan sonra kalan tek girebilen SuperAdmin pasife alınabilir ve değişmez 18 bir sonraki açılışta uygulamayı durdururdu |
| 5 | Sistem aktörü olmayan, pasif olmayan her kullanıcının tam bir canlı (Kök, Temel) üyeliği vardır; pasif kullanıcının canlı üyeliği ve açık oturumu yoktur (KR-008 Seçim 31 ve 43) | "üyelik ver" pasif kişiyi, "üyelik kaldır" kök üyeliği reddeder; canlı üçlünün tekil kısıtı ikinci kök üyeliği engeller; pasife alma kişiyi kilitleyip üyelikleri ve oturumları kapatır |
| 6 | Yetenek satırı yerinde düzenlenmez; yazıldıktan sonra yalnız silinme zamanı bir kez yazılır (KR-008 Seçim 7) | repository'de güncelleme metodu yoktur; silme `silinme_zamani` boşken koşulludur |
| 7 | Yetenekte «bütün kayıtlar» işareti ile şart, «bütün kolonlar» işareti ile kolon listesi birlikte yazılmaz; ikisi de yoksa satır saklanır ama hiçbir kayıt ya da kolon vermez; birim kolonu olan kaynakta şartlı satır birim koşulu ya da «bütün birimler» taşır (KR-008 Seçim 5, 11, 45) | yalnız "ikisi birlikte"yi yasaklayan veritabanı denetim kısıtı (ikinci tur 13: önceki hâl "tam biri" diyordu; KR-008'in saklanabilir saydığı boş satırı ve kolon sınırı aranmayan silme ile niyet satırlarını reddederdi); birim koşulu şemaya bağlı olduğu için komut denetimi |
| 8 | Grup, rol, üyelik ve yetenek tablolarına yazma izni veren yetenek yalnız (Kök, SuperAdmin) kümesine bağlanır; sistem satırları silinemez ve daraltılamaz (KR-008 Seçim 15, 17, 30) | genel sayaç kilidi altında komut denetimi; `yetenek.sistem_satiri` işareti ve silme komutunda denetim |
| 9 | Üyelik ve yetenek yazılırken bağlandığı grup ve rol canlıdır (KR-010) | genel sayaç kilidi altında komut denetimi |
| 10 | Yetki tablosuna yazan her işlem ilgili sürüm sayısını aynı işlemde artırır (KR-010 Seçim 24 ve 32) | yetki tablolarına yazma yalnız `_shared` içindeki tek parçadan geçer; "sürümü artırmadan yazan yol yok" sınaması |
| 11 | Kapatılmış oturum yeniden açılmaz ve yenilenmez; kapatma tek yazmadır ve nedenini taşır (KR-009 Kural 1) | kapatma `kapatilma_zamani` boşken koşullu güncellemedir; yenileme satırı kilitleyip aynı kolona bakar |
| 12 | Oturumun mutlak bitişi yazıldıktan sonra değişmez (KR-009 Kural 6) | repository'de bu kolonu güncelleyen metot yoktur |
| 13 | Parola, bağlantı kodu, giriş kodu ve cihaz sırrı düz hâliyle saklanmaz; yalnız özetleri durur (KR-009) | tablolarda yalnız özet kolonu vardır; sınama |
| 14 | Bir kişinin aynı anda en çok bir kullanılabilir parola bağlantısı vardır (KR-009 Seçim 9) | kullanılmamış satırlar için kısmi tekil kısıt; yenisi üretilirken eskisi silinir |
| 15 | Boş olmayan `kullanici_adi` ve `telefon` bütün kullanıcılar arasında tekildir; pasif kullanıcının adı ve telefonu ayrılmış kalır (unutulmuş kişi dışında; onun bu alanları boşaltılır) | tekil kısıtlar; kullanıcı adı küçük harfe çevrilerek saklanır (yazım kanonu açık) |
| 16 | Sistem aktörü giriş yapamaz, sırrı, telefonu ve oturumu olmaz; üyeliklerini yalnız göç yazar, çalışma anında değişmez (KR-010 Seçim 25; KR-012) | oturum çekirdeği sistem aktörünü reddeder; kullanıcıyı hedef alan bütün komutlar sistem aktörü hedefini reddeder: güncelle, giriş bilgisini değiştir, parola bağlantısı üret, pasife al, yeniden aç, unut, üyelik ver, üyelik kaldır (ikinci tur 8). Aktörün yeteneği, üyesi olduğu kümenin yetenek satırlarıyla ayarlanır |
| 17 | Unutulan kullanıcı yeniden açılamaz (çürütme 13) | `unutulma_zamani` dolu kişide "yeniden aç" reddedilir |
| 18 | En az bir giriş yöntemi açıktır ve açık yöntemlerden biriyle girebilen en az bir (Kök, SuperAdmin) üyesi vardır (KR-009 Kural 13) | yöntem proje ayarıdır; denetim açılışta yapılır ve tutmuyorsa uygulama başlamaz (ikinci tur 9). Açılış denetimi bir çekirdek yoldur. Bu durumda yalnız yönetim değil herkes etkilenir |
| 19 | "Kullanıcı aç" ve "giriş bilgisini değiştir", sistem aktörü olmayan kişiyi açık yöntemlerin hiçbirinin giriş bilgisi olmadan bırakmaz (KR-009 Kural 13) | komut denetimi; unutulmuş kişi kuralın dışındadır. Ayar sonradan değişirse eski kullanıcılar kuralı bozabilir; onlar yalnız giremez, uygulama durmaz |

## Kapasite
Girdiler:
- Aynı anda bağlı kişi: 1000–5000 (kullanıcı beyanı; ölçüm değil).
- Kişi başına açık oturum: en çok 3 (varsayılan; KR-009).
- Erişim belirtecinin ömrü: 15 dakika; hareketsizlik sınırı: 30 dakika (varsayılanlar; KR-009).
- Kişi başına istek hızı: bilinmiyor; ölçülmedi.

Aritmetik:
- Açık oturum satırı: en çok 5000 × 3 = 15.000. "Açık", kapatılmamış ve süresi geçmemiş demektir; terk edilmiş oturum hareketsizlik sınırından sonra açık sayılmaz (çürütme 12).
- Yenileme: etkin her oturum saatte 4 kez yenilenir; 5000 etkin oturumda 5000 × 4 = saatte 20.000, yani saniyede yaklaşık 5,6 yenileme. Her yenileme kişinin ve oturumun satırını kilitler ve iki satır yazar.
- Kimlikli istek başına kimlik maliyeti: 1 birincil anahtar okuması; toplam yük istek hızına bağlıdır ve o ölçülmedi.
- Büyüyen tablolar: `oturum` (her giriş bir satır; kapananlar kalır), `parola_baglantisi`, `giris_kodu`. Saklama süreleri belirlenmedi; temizlik işi tasarlanmadı.
- Parola özetleme: Argon2id girişte ve parola belirlemede iş başına 19 MiB bellek ister (KR-009 Seçim 6); aynı anda kaç özetlemenin koşacağına sınır konmadı ve süre ölçülmedi.

## Veri modeli
Ajan önerisi. Adlandırma biçimini kullanıcı teyit etti (2026-11-24; KR-011 Seçim 7): tablo adı tekildir, adlar Türkçeye özgü harf taşımaz, zaman kolonları `_zamani` ile biter, başka tabloya bağ `_id` ile biter, saklanan sabit değerler ve şartın içindeki anahtarlar Türkçedir. Teyit biçim içindir; tek tek tabloların ve kolonların varlığı ayrıca gözden geçirilecek.
```
Kaynak olan tablolar (yönetim ve liste işleri yetenek satırıyla okur ve yazar)
kullanici           id · kullanici_adi? · telefon? · gorunen_ad · sistem_aktoru · yetki_surumu
                    · pasif_zamani · unutulma_zamani · olusturma_zamani      (? = boş olabilir)
oturum              id · kullanici_id · giris_yontemi · baslangic_zamani · mutlak_bitis_zamani
                    · son_dondurme_zamani · ip_adresi · tarayici_bilgisi
                    · kapatilma_zamani · kapatilma_nedeni
grup                id · ust_grup_id · ad · silinme_zamani · olusturma_zamani
rol                 id · kod? · ad · silinme_zamani
izin                id · kaynak · eylem
uyelik              id · kullanici_id · grup_id · rol_id · silinme_zamani · olusturma_zamani
yetenek             id · grup_id · rol_id · izin_id
                    · sart · butun_kayitlar · butun_birimler · kolonlar · butun_kolonlar
                    · sistem_satiri · silinme_zamani · tohum_anahtari · yerine_gectigi_id · koken
                    · olusturma_zamani

Kaynak olmayan tablolar (yalnız kimlik'in kendi kodu erişir; yetenek satırıyla açılamaz)
kullanici_sirri     kullanici_id · parola_ozeti · guncelleme_zamani
oturum_sirri        oturum_id · nesil · gecerli_yenileme_ozeti · onceki_yenileme_ozeti
                    · cihaz_sirri_ozeti
parola_baglantisi   id · kullanici_id · kod_ozeti · son_gecerlilik_zamani · kullanilma_zamani
                    · olusturan_id · olusturma_zamani
giris_kodu          (kolonları kodla girişin açık soruları kapanınca çizilecek; çürütme 20)
yetki_surumu        id · sayac                    (tek satır: genel sayaç)
```
- Oturumun ikiye bölünmesi (ajan önerisi; kullanıcı teyidi, 2026-11-24): "oturumlarım" yetenek satırıyla okunduğu için (KR-008 Seçim 46) `oturum` bir kaynaktır ve «bütün kolonlar» işareti modelin bütün alanlarını açar; sırlar kaynak modelinde duramayacağı için (KR-008 Seçim 21) yenileme ve cihaz sırrı özetleri `oturum_sirri` tablosuna ayrılır. Her istekteki okuma yalnız `oturum` satırına bakar. Bu, KR-009'daki "oturum başına tek satır" çizimini ve KR-010 Seçim 36'daki "oturum altyapı tablosudur" cümlesini değiştirir; ikisine de uyarlama notu düşüldü.
- Kaynak olmayan modele ilişki adımı (çürütme 18): şart, süzgeç ve sıralama, kaynak olmayan bir tabloya ilişki üzerinden bakamaz; derleme ve tarama bunu reddeder. Aksi hâlde aynı feature'da durdukları için bir şart özet kolonuna bakabilirdi.
- Yalnız sistemin yazdığı kolonlar (çürütme 17): `kullanici.yetki_surumu`, `sistem_aktoru`, `pasif_zamani` ve `unutulma_zamani` kaynak modeldedir ve «bütün kolonlar» ile okunur; istek gövdesinden kabul edilmezler ve "güncelle" şemasında yer almazlar (KR-008 Seçim 34'teki "sistemin yazdığı kolonlar" listesine eklenir).
- Yenileme belirtecinin biçimi (çürütme 2) — kapandı (kullanıcı, 2026-11-24; KR-009 Seçim 12): belirteç imzalıdır ve kişinin kimliğini, oturumun kimliğini ve nesil sayısını taşır; `oturum_sirri.nesil` her döndürmede artar. İmzası geçerli ama nesli eski olan her belirteç, kaç nesil eski olursa olsun, yeniden kullanım sayılır. İmzasız ya da bozuk belirteç hiçbir oturuma dokunmadan reddedilir; aksi hâlde oturum kimliğini bilen herkes sahte belirteçle alarm çaldırıp kişinin oturumlarını kapattırabilirdi. Bu, KR-009'un açık bıraktığı "imzalı mı opak mı" sorusunu imzalı yönünde kapatır. Reddedilen: yalnız son iki özeti saklayan opak belirteç (ilk hâl; iki kez yenileyen hırsızı gerçek sahibi dönünce yakalayamaz); verilmiş bütün belirteçlerin özetini saklamak (oturum başına yüzlerce satır).
- Kişinin yetki sayısı `kullanici.yetki_surumu` kolonundadır; genel sayaç `yetki_surumu` tablosundaki tek satırdır (KR-010 Seçim 32).
- Koddaki model adları aynı sözcüklerdir (`Kullanici`, `Uyelik`, `Yetenek`); alan adları camelCase yazılır (`kullaniciAdi`) ve kolona eşlenir.
- Son döndürme zamanının yeri (ikinci tur 7): `son_dondurme_zamani` sır değildir ve `oturum` tablosundadır; önceki hâlde sır tablosundaydı ve "oturumlarım" son etkinliği gösteremiyor, hareketsiz oturumu açık sayıyordu. "Açık oturum" bir kolon değil, hesaptır: kapatılmamış, mutlak bitişi geçmemiş ve son döndürmesinden beri hareketsizlik sınırı dolmamış oturum. Oturum sınırı sayımı ve "oturumlarım" bu hesabı kullanır. Süresi geçmiş satırı yenileme `sure` ile kapatır; terk edilmiş oturum hiç yenilenmediği için onu ayrıca temizlik işi kapatır (tasarlanmadı; üçüncü adım). O iş yazılana kadar kapatılmamışların kısmi dizini ölü satırlarla büyür.
- Düz güncellemeye kapalı öbür kolonlar (ikinci tur, birinci turun 17. bulgusunun devamı): `yetenek` satırının hiçbir kolonu güncellenmez (değişmez 6); `grup.ust_grup_id` yalnız "taşı" işiyle değişir, "güncelle" yalnız adı değiştirir; `rol.kod` çalışma anında yazılmaz.
- Saklanan sabit değerler Türkçedir (biçim teyitli; değer listesi ajan önerisi): `koken` için `goc` ve `yonetici`; `giris_yontemi` için `parola` ve `tek_kullanimlik_kod`; `kapatilma_nedeni` için `cikis`, `sahibi_kapatti`, `yonetici`, `pasife_alma`, `parola_degisimi`, `giris_bilgisi_degisti`, `yetki_yukseltme`, `sure`, `yeniden_kullanim`, `tutarsiz_nesil`, `oturum_siniri`, `adres_degisti`, `cihaz_uymadi`, `yontem_kapandi`, `unutma`. KR-009'daki neden listesi bu listeye göre güncellenecek (ikinci tur 14).
- Şartın saklanan biçimi (anahtar adları teyitli): `[{ "alan": …, "islec": …, "deger": … }]`.
- `rol.kod` yalnız sistem rollerinde doludur (temel rol ve SuperAdmin; KR-008 Seçim 15); yöneticinin açtığı rolde boştur (ajan okuması).

Anahtarlar ve kısıtlar (ajan önerisi):
- Kimlik kolonunun türü — kapandı (kullanıcı, 2026-11-24; KR-011 Seçim 8): zaman sıralı rastgele kimlik (UUID v7); reddedilen artan sayıdır.
- `kullanici`: boş olmayan `kullanici_adi` tekil; boş olmayan `telefon` tekil.
- `oturum`: kapatılmamış satırlar için `kullanici_id` üzerinde kısmi dizin.
- `oturum_sirri`, `kullanici_sirri`: birincil anahtar sahibinin kimliğidir.
- `parola_baglantisi`: `kod_ozeti` tekil; kullanılmamış satırlar için `kullanici_id` kısmi tekil. Yeni bağlantı üretilirken kişinin kullanılmamış eski satırı silinir; izini olay taşır.
- `grup`: `ust_grup_id` dizini; canlı ve üstsüz satır için kısmi tekil kısıt.
- `rol`: boş olmayan `kod` tekil. `izin`: (`kaynak`, `eylem`) tekil.
- `uyelik`: canlı satırlar için (`kullanici_id`, `grup_id`, `rol_id`) kısmi tekil; canlılar için `kullanici_id` dizini.
- `yetenek`: canlı satırlar için (`grup_id`, `rol_id`) dizini; canlı satırlar için boş olmayan `tohum_anahtari` tekil; kayıt ve kolon sınırı için denetim kısıtları (değişmez 7).

Durum geçişleri:
```
kullanici           açık ──pasife_al──▶ pasif ──yeniden_ac──▶ açık        (silinmez)
                    açık | pasif ──unut──▶ unutuldu                       (geri dönüş yok)
oturum              açık ──kapat(neden)──▶ kapalı                         (geri dönüş yok)
parola_baglantisi   kullanılabilir ──▶ kullanıldı | süresi geçti | yerine yenisi üretildi
uyelik, grup, rol   canlı ──▶ silinmiş                                    (geri dönüş yok)
yetenek             canlı ──▶ silinmiş;  "yenile" = eskisi silinir + yerine_gectigi_id taşıyan yeni satır
```

İşlem sınırları (her komut tek `run` çağrısıdır; parola özetleme işlemin dışında yapılır):
- Kilit sırası bütün komutlarda aynıdır (çürütme 5; ikinci tur 11'e göre düzeltildi): genel sayaç satırı → kişinin satırı → bağlantı ya da kod satırı → oturum satırları. Bir komut bu sıranın ihtiyaç duyduğu kısmını alır, sırayı bozmaz. Önceki hâl oturumları bağlantıdan önce sayıyordu, ama giriş ve parola belirleme adımları tersini yapıyordu.
- Kilit kipi (ikinci tur 11): kişinin satırı anahtar dışı güncelleme kilidiyle kilitlenir (PostgreSQL'de `FOR NO KEY UPDATE`; anahtar kolonuna dokunmayan boş bir güncelleme de bu kilidi alır, ham SQL gerekmez). Tam satır kilidi (`FOR UPDATE`) kullanılmaz: o kip, bu kişiye yabancı anahtar veren her yazmayla çakışır (öbür feature'ların tabloları, `olusturan_id`) ve iki yöneticinin birbirine aynı anda bağlantı üretmesini kilitler. Ölçüldü (2026-11-24; GV-003, yedi geçen testle sabit; Prisma 7.10.1, PostgreSQL 19): değer değiştirmeyen bir güncelleme model API'siyle gerçekten bir güncelleme deyimi gönderir ve anahtar dışı güncelleme kilidi alır (kişinin satırında ve tek satırlı genel sayaçta); o kilit tutulurken anahtar paylaşım kilidi alınabilir, yani bu kişiye yabancı anahtar veren yazmalar beklemez. Tekil dizinli `kullanici_adi` kolonunun değerini değiştiren güncelleme tam satır kilidi alır: "giriş bilgisini değiştir" ve "unut" işleri sürerken o kişiye bağlanan yazmalar kısa süre bekler (nadir işler; kabul edilen sonuç, ajan). Ölçülmedi: boş veri nesnesiyle güncellemenin deyim gönderip göndermediği; kilidin işlem sonunda bırakıldığı.
- Kişinin birden çok oturumuna dokunan her komut önce kişinin satırını kilitler: giriş, yenileme, pasife alma, parola belirleme, parola değiştirme, giriş bilgisinin değişmesi, unutma (çürütme 1 ve 5). Kişi kilidini tutan komut o kişinin oturum satırlarını istediği sırayla kilitleyebilir.
- Tek oturuma dokunan yollar kişiyi kilitlemez: çıkış, sahibinin ya da yöneticinin oturum kapatması ve oturum denetimindeki adres kapatması yalnız o satırı "kapatılmamışsa kapat" diye koşullu günceller. Tek kilit tutup hiçbir şey beklemedikleri için kilitlenme döngüsüne giremezler; en kötü sonuç, eşzamanlı bir girişin sınır sayımında o oturumu açık görüp bir oturumu gereksiz kapatmasıdır.
- Kapatıp reddeden dallar (üçüncü tur 6): bir komut hem oturum kapatıp hem isteği reddediyorsa (yenilemede yeniden kullanım, süre, adres, cihaz sırrı, tutarsız nesil, kapatılmış yöntem; oturum denetimindeki adres kapatması; kapalı oturuma eski nesilde olay yazımı), işlemi tamamlar ve reddi hata olarak atmaz, sonuç değeri olarak döndürür. Aksi hâlde `run` içindeki hata bütün yazmaları geri alır (KR-011) ve kapatma ile güvenlik olayı da geri alınır; hırsızlık tespiti kalıcı olmazdı. Sınama, ret cevabından sonra satıra bakar.
- Kullanıcı aç: kullanıcı, (Kök, Temel) üyeliği, parola yöntemi açıksa ve kullanıcı adı doluysa parola bağlantısı, ve olay tek işlemde; genel sayaç kilidi alınmaz (KR-010). Telefonun yazım kanonu kararlaştırılana kadar komut telefon kabul etmez (ikinci tur).
- Parola bağlantısı üret: hedef kişi kilitlenir; SuperAdmin koruması (KR-008 Seçim 47) ve sistem aktörü kilit altında denetlenir; kişinin kullanılmamış eski bağlantısı silinir, yenisi yazılır. Soru kilitten önce sorulursa araya giren bir SuperAdmin üyeliği verme işi, yeni SuperAdmin'in bağlantısını silip yenisini isteyene çıkarırdı (üçüncü tur 1).
- Pasife al: genel sayaç satırı, sonra kişi kilitlenir; son SuperAdmin, SuperAdmin koruması ve sistem aktörü denetlenir; kişinin bütün üyelikleri ve kapatılmamış bütün oturumları kapatılır (`pasife_alma`; hesaba göre açık olmayan ama kapatılmamış satırlar da); kişinin sayısı artar.
- Yeniden aç: kişi kilitlenir; unutulmuş kişi ve sistem aktörü reddedilir; pasif işareti kalkar; yeni (Kök, Temel) üyeliği yazılır; kişinin sayısı artar. Genel sayaç kilitlenmez: yalnız "kişinin sayısı" parçası çağrılır; "genel sayaç" parçası çağrılsaydı kişi → sayaç diye ters bir kilit sırası doğardı (üçüncü tur 1).
- Üyelik ver ya da kaldır: genel sayaç satırı kilitlenir ama artırılmaz; grup ve rolün canlı olduğu, kişinin pasif ve sistem aktörü olmadığı, kaldırırken kök üyelik olmadığı ve son SuperAdmin denetlenir; kişinin sayısı artar. (Kök, SuperAdmin) üyeliği verilirken kişi de kilitlenir ve giriş sıfırlanır (kullanıcı, 2026-11-24; KR-008 Seçim 47 eki; ikinci tur 1): hedef zaten canlı (Kök, SuperAdmin) üyesiyse komut en başta reddedilir ve hiçbir şey sıfırlanmaz; değilse kişinin bütün oturumları kapatılır (`yetki_yukseltme`), `kullanici_sirri` satırı, bekleyen bağlantısı ve bekleyen kodları silinir; parola yöntemi açıksa ve kullanıcı adı doluysa aynı işlemde yeni bir parola bağlantısı üretilir ve cevapta üyeliği veren SuperAdmin'e bir kez gösterilir (koşul "kullanıcı aç"takiyle aynıdır; üçüncü tur 8).
- Yetenek yaz, yenile, sil; grup oluştur, taşı, sil; rol yaz, sil: genel sayaç satırı kilitlenir ve artırılır.
- Giriş (çürütme 1 ve 10): yöntem girdiyi işlemin dışında doğrular. Sonra tek işlemde kişinin satırı kilitlenir; kişinin pasif, unutulmuş ya da sistem aktörü olmadığına bakılır; yöntemin "kesinleştir" adımı kilit altında çalışır (parolada: sırrın `guncelleme_zamani` değeri doğrulamada okunanla aynı mı; kodda: kod satırı kilitlenir ve kullanıldı diye işaretlenir); açık oturumlar sayılır, sınır aşılıyorsa en eskisi kapatılır; yeni `oturum` ve `oturum_sirri` satırları yazılır (`son_dondurme_zamani` başlangıç zamanıyla dolar). Böylece parola değişimi ya da pasife almayla yarışan giriş, kapatmadan sonra oturum bırakmaz ve kod tüketilip oturum açılamadan kalmaz.
- Yenile (sıra ajan önerisi; kullanıcı teyidi, 2026-11-24; çürütme 7; ikinci tur 5'e göre dört yeri netleştirildi, bu netleştirmeler teyide sunulmadı):
  1. Belirtecin imzası ve türü doğrulanır; geçersizse ya da yenileme belirteci değilse hiçbir satıra dokunulmadan reddedilir. Tür denetimi olmadan, nesil taşımayan bir erişim belirteci 3. adımda yeniden kullanım sayılır ve kişinin bütün oturumlarını kapattırırdı.
  2. Kişinin ve oturumun satırı kilitlenir; sır satırı bu kilit altında okunur. Oturum kapalıysa istek reddedilir; toplu kapatma yapılmaz (KR-009 Kural 7). Kapalı oturuma eski nesil gelmişse ayrıca güvenlik olayı yazılır: çalıntı oturumu yenileyip sonra çıkış yapan hırsızın ardından gerçek sahibi böyle döner. Bu durumda kişinin öbür oturumlarının da kapatılıp kapatılmayacağı açıktır (kullanıcı kararı; üçüncü adım). KR-009 Kural 7 "güvenlik olayı yalnız gerçekten bir oturum kapandıysa yazılır" der; bu olay o cümlenin adıyla istisnasıdır ve KR-009'a öyle yazıldı (üçüncü tur 7).
  3. Nesil satırdakinden büyükse tutarsızlıktır (olağan yolla oluşamaz; yedekten dönüşte oluşur): oturum `tutarsiz_nesil` ile kapatılır. Nesil eşit ama belirtecin özeti saklanan özete uymuyorsa da tutarsızlıktır ve aynı şekilde kapatılır (üçüncü tur). Nesil satırdakinden küçükse: bir önceki nesil hoşgörü penceresinin içindeyse oturum yaşar (KR-009 Kural 3 ve 4), değilse yeniden kullanımdır ve kişinin bütün oturumları kapatılır (`yeniden_kullanim`). Yeniden kullanım kararı cihaz sırrına bakmaz: eski bir belirtecin gelmesi tek başına hırsızlık işaretidir. Pencere içindeki dal ise aşağıdaki 4, 5 ve 6. adımlardan geçmeden cevap üretmez; cihaz sırrı pencere boyunca da aranır.
  4. Mutlak bitiş ya da hareketsizlik sınırı geçmişse oturum `sure` ile kapatılır ve reddedilir.
  5. Adres ya da tarayıcı bilgisi uymuyorsa yalnız o oturum `adres_degisti` ile, cihaz sırrı uymuyorsa `cihaz_uymadi` ile kapatılır (KR-009 Kural 8).
  6. Oturumun açıldığı giriş yöntemi kapatılmışsa oturum `yontem_kapandi` ile kapatılır.
  7. Döndürülür: nesil artar, özetler kayar, son döndürme zamanı yazılır.
  Açık: cevabı kaybolan yenilemenin aynen tekrarında ne döneceği (KR-009 Kural 4; tabloda bunu üretecek veri yoktur, yöntem üçüncü adımda seçilecek; ikinci adımı bloke etmez).
- Çıkış: isteği yapan oturumun satırı "kapatılmamışsa kapat" diye koşullu güncellenir (`cikis`). Oturum kapat: aynı güncelleme, yetenek satırının şartıyla birlikte (`sahibi_kapatti` ya da `yonetici`).
- Parola belirle: bağlantı kodunun özeti işlemin dışında hesaplanır ve satır bulunur; yeni parola ancak bağlantı geçerliyse özetlenir (geçersiz bağlantıyla özetleme yükü bindirilemez). Sonra tek işlemde kişi, ardından bağlantı satırı kilitlenir; bağlantı kullanıldı diye işaretlenir; sır yazılır; kişinin bütün oturumları kapatılır.
- Parola değiştir (ikinci tur 3'e göre düzeltildi; girişteki yarışın aynısı buradaydı): eski parola işlemin dışında doğrulanır; sonra kişi kilitlenir ve kilit altında iki şeye yeniden bakılır: sırrın `guncelleme_zamani` değeri doğrulamada okunanla aynı mı, isteği yapan oturum hâlâ açık mı. İkisi de tutuyorsa sır yazılır ve kişinin bütün oturumları kapatılır, o anki dahil (kullanıcı teyidi, 2026-11-24). Önceki hâlde eski parolayı bilen biri, kurbanın parola değişimiyle aynı anda kendi değişimini gönderip kurbanınkini sessizce ezebiliyordu.
- Giriş bilgisini değiştir (`kullanici_adi`, `telefon`): kişi kilitlenir; SuperAdmin koruması ve sistem aktörü denetlenir; değer yazılır; kişinin bekleyen bağlantı ve kod satırları silinir (eski telefona gitmiş kod, değişimden sonra oturum açmasın; ikinci tur 14); kişinin bütün oturumları kapatılır (`giris_bilgisi_degisti`).
- Unut (ikinci tur 4'e göre yeniden yazıldı; önceki hâl üyeliklere dokunmuyor ve genel sayacı kilitlemiyordu, son SuperAdmin unutulabiliyordu): unutma pasife almanın üstüne kurulur. Aynı kilitler alınır, aynı denetimler yapılır (son SuperAdmin, SuperAdmin koruması, sistem aktörü), üyelikler ve oturumlar kapatılır, `pasif_zamani` yazılır (kişi kapatılır); ardından kişisel alanlar temizlenir ve `unutulma_zamani` yazılır. Yeteneksiz üyelik kapatması yaptığı için KR-008 Seçim 17'nin adıyla üçüncü istisnasıdır (üçüncü tur 7). Kendi izni vardır (`Kullanici:unut`). Bu, KR-012'deki "kişisel alanlar değiştirilir ve kullanıcı kapatılır" cümlesiyle aynı yöndedir.
- Genel sayaç satırı yoksa (göç koşmamışsa): yetki yazan komut kilitleyecek satır bulamaz ve reddedilir; her istekteki okuma satır döndürmez ve istek reddedilir. İkisi de kapalı düşer (ikinci tur 15).

Kapananlar ve etkileri:
- Giriş yöntemleri — kapandı (kullanıcı, 2026-11-24; KR-009 Seçim 10): base iki hazır yöntem taşır, parola ile giriş (kullanıcı adı ve parola) ve tek kullanımlık kodla giriş (telefon ve kod); proje açıp kapatır. Önce parola, ardından kodla giriş yazılır. E-posta ile giriş base'de yoktur (ajan okuması: kullanıcı üç yol arasında e-postayı seçmedi; ayrıca sorulmadı).
- İki yöntemin sonuçları (ajan önerisi; kullanıcı teyidi, 2026-11-24; çürütme 11): sistem aktörü olmayan kullanıcı, açık yöntemlerden en az birinin giriş bilgisini taşır (parola açıksa kullanıcı adı, kod açıksa telefon); ikisi de boş olamaz. Bir yöntem kapatılınca o yöntemle açılmış oturumlar bir sonraki yenilemede kapanır. Son açık yöntem kapatılamaz ve bir yöntem, onunla girebilen en az bir (Kök, SuperAdmin) üyesi kalmadan kapatılamaz.
- `kullanici` tablosunun kişisel alanları — kapandı (kullanıcı, 2026-11-24): a. Base'de giriş alanları (`kullanici_adi`, `telefon`) dışında yalnız `gorunen_ad` durur; öbür kişisel bilgiler projenin kendi feature'ında, kendi tablosunda durur ve `kullanici_id` ile bağlanır. Reddedilenler: hazır profil alanları; hiç ad taşımamak. Kabul edilen bedel: ad ve soyadı ayrı isteyen proje bunları kendi tablosuna yazar ve görünen adla eşit tutmak onun işidir.
- Unutma isteğinde `kimlik`in temizledikleri (ajan önerisi; kullanıcı teyidi, 2026-11-24; çürütme 13; ikinci tur 4 ile genişletildi, genişletme teyide sunulmadı): önce pasife almanın yaptığı her şey (üyelikler ve oturumlar kapanır; açık oturumlar `unutma` nedeniyle). Sonra: `kullanici` satırında `kullanici_adi` ve `telefon` boşaltılır (tekil kısıt ve o adın yeniden kullanılabilmesi için), `gorunen_ad` kişiye geri götürmeyen sabit bir değerle değiştirilir (KR-012: "kişiye geri götürmeyen bir değerle"); kişinin `kullanici_sirri` satırı, bekleyen bağlantı ve kod satırları ile `oturum_sirri` satırları silinir; kişinin bütün oturum satırlarındaki `ip_adresi` ve `tarayici_bilgisi` aynı sabit değerle değiştirilir. Kişi `unutuldu` durumuna geçer ve yeniden açılamaz. Değişmez 19 unutulmuş kişiyi kapsamaz. İz veritabanındaki kayıtlar KR-012 ve KR-013'ün konusudur; unutmanın kendi değişiklik kaydı sildiği değeri "eski değer" olarak taşımaz (ikinci tur 10).
- Davet akışının beş tanımı — kapandı (kullanıcı teyidi, 2026-11-24; KR-009 Seçim 9): bağlantı 24 saat yaşar ve proje ayarıyla değişir; yenisi üretilince eskisi ölür; parola bağlantıyla yeniden belirlenince bütün oturumlar kapanır; bağlantı üretmek kendi izni olan ayrı bir iştir; bağlantı kendiliğinden oturum açmaz.

## Yapı
Ajan önerisi; kullanıcı seçimleri adıyla işaretlidir.

Sahiplik (kullanıcı, 2026-11-24): yukarıdaki tabloların ve yazma kurallarının sahibi `kimlik` feature'ıdır; ortak kodda yalnız motor kalır ve veriyi arayüzden ister. Bu, KR-008, KR-009 ve KR-010'daki "Ortak parça" satırlarını değiştirir: yetki tablolarının yazma kapısı ve oturum kayıtları `kimlik`in içindedir.

Bağımlılık yönü:
```
features/<başka>  ──kendi ACL'i──▶  shared/kimlik/        ◀──tüketir──  shared/yetki, shared/guvenlik
                                    (sözleşmeler:                        (motor: guard, bellek, derleyici,
features/kimlik  ────uygular─────▶   arayüz + düz veri)                   çevirici, dekoratörler)

shared hiçbir feature'ı içe aktarmaz; hangi sınıfın hangi sözleşmeyi uyguladığı uygulamanın kök modülünde bağlanır.
```

Alt özellikler (her biri dört katmanlı):
```
features/kimlik/
  kullanici/             aç · güncelle · pasife al · yeniden aç · listele · parola bağlantısı üret
  oturum/                giriş · yenile · çıkış · yetkilerim · oturumlarım · oturum kapat
  parola/                parola belirle (bağlantıyla) · parola değiştir · parola ile giriş yöntemi
  tek_kullanimlik_kod/   kod iste · kodu doğrula · kodla giriş yöntemi            (ikinci aşama)
  grup/                  oluştur · adını değiştir · taşı · sil · ağacı oku
  rol/                   oluştur · adını değiştir · sil · izinleri oku
  uyelik/                ver · kaldır · listele
  yetenek/               yaz · yenile · sil · listele
  _shared/               alt özellikler arası ortak: genel sayacı kilitleyen ve sürümleri artıran parça;
                         kişiyi kilitleyip oturumlarını toplu kapatan parça; çekirdek erişim arayüzü;
                         kimlik'in dışarıya açtığı sözleşmelerin bağdaştırıcıları
```

Çekirdek yollar (çürütme 4; kullanıcı 2026-11-24'te ilk listeyi kabul etti, KR-010 Seçim 48). Kimlik ve yetki çekirdeği kendi tablolarını yetenek satırıyla okuyamaz: giriş henüz kimliği olmayan bir istektir ve yetki verisini okuyan parça yetki kapısından geçerse derleme kendini çağırır. Bu yüzden aşağıdaki işler `kimlik`in tablolarına yetki kapısı olmadan, ayrı ve adıyla sayılı bir iç arayüzden erişir; liste kapalıdır, listeye ekleme makineyle denetlenir ve kullanıcıya sorulur.
```
Kabul edilen liste (kullanıcı, 2026-11-24) — bütünüyle çekirdek olan işler
giriş ve yöntemlerin doğrulaması · yenile · çıkış · yetkilerim · bağlantıyla parola belirle · parola değiştir
oturum denetimi (adres uymayınca kapatma dahil) · yetki verisinin ve sürümlerin okunması
kurulum komutu · açılış denetimi (değişmez 18)
```
İkinci tur ilk listenin gövdeyle çeliştiğini gösterdi (bulgu 2): liste "yönetim uçları çekirdek arayüzü kullanamaz" diyordu, ama "kullanıcı aç" kaynak olmayan tabloya yazmak ve yeteneksiz kök üyelik yazmak zorundadır. Düzeltme (kullanıcı, 2026-11-24: "ekle"; KR-010 Seçim 48 eki): liste iş adıyla değil, `_shared` içindeki dar ve adlı parçalarla tanımlanır; yönetim işleyicileri yetki kapısından geçmeye devam eder, çekirdek arayüzü kendileri içe aktaramaz ve yalnız izinli oldukları parçayı çağırır. Üçüncü tur parçaların çağıran listesinin dört işte gövdeyle uyuşmadığını gösterdi (bulgu 1 ve 4); liste aşağıdaki hâle getirildi (kullanıcı, 2026-11-24: "devam"; ajan bunu onay olarak okudu ve kullanıcıya öyle söyledi):
```
Yönetim işlerinin çağırabildiği çekirdek parçalar (dokuz parça)
genel sayaç        genel sayaç satırını kilitler; istenirse artırır
                   (yetenek, grup ve rol yazımı; üyelik ver ve kaldır; pasife al; unut)
kişinin sayısı     yalnız kişinin sayısını artırır; genel sayacı kilitlemez
                   (üyelik ver ve kaldır, pasife al, yeniden aç, unut)
kişi kilidi        kişinin satırını kilitler; istenirse oturumlarını nedeniyle toplu kapatır
                   (parola bağlantısı üret, pasife al, yeniden aç, giriş bilgisini değiştir, unut,
                   SuperAdmin üyeliği verme)
bağlantı           parola bağlantısı üretir, siler; kişi kilidi alınmış olmalıdır
                   (kullanıcı aç, bağlantı üret, giriş bilgisini değiştir, unut, SuperAdmin üyeliği verme)
parola sırrı       kişinin parola özetini siler            (unut, SuperAdmin üyeliği verme)
bekleyen kodlar    kişinin bekleyen giriş kodlarını siler  (giriş bilgisini değiştir, unut, SuperAdmin üyeliği verme)
kök üyelik         yeteneksiz üyelik yazımı ve kapatması   (kullanıcı aç, pasife al, yeniden aç, unut)
oturum temizliği   kişinin oturum satırlarındaki adres ve tarayıcı bilgisini değiştirir, oturum sırlarını siler
                   (yalnız unut)
bütünlük sorusu    yalnız evet ya da hayır döner, satır vermez: bu kişi canlı (Kök, SuperAdmin) üyesi mi;
                   son girebilen SuperAdmin mi; bu grup ve rol canlı mı; bu küme (Kök, SuperAdmin) mi;
                   bu grup ya da rol boş mu; bu taşıma döngü yapar mı
                   (korumalı işler; üyelik ver; yetenek yaz; grup oluştur, taşı, sil; rol sil)
tohum              yalnız göçten çağrılır; yeni kullanıcıyı, kök üyeliği, verilen üyeliği ve sürümleri yazar
                   (ilk SuperAdmin ve sistem aktörleri; KR-008 Seçim 28 eki)
```
- "Bütünlük sorusu"nun nedeni (üçüncü tur 4): bu denetimler yetki kapısından okunursa isteyenin okuma yeteneğine bağlı kalır. Canlılık kapalı tarafa düşer (göremediği grubu yok sayar ve reddeder), ama "boş mu" açık tarafa düşer: `Uyelik:oku` yeteneği dar olan bir yönetici, üyeliğini göremediği dolu grubu "boş" görür ve siler.
- "Tohum" onuncu satırdır ama yönetim işlerinden çağrılmaz; yalnız göçün yoludur.
- Bu, KR-010'daki iki yükümlülüğe adıyla istisnadır ("yetkiyi atlayan repository yolu yoktur"; "altyapı tabloları kaynak değildir, yalnız ortak altyapı kodu erişir") ve o karara Seçim 48 olarak yazıldı.
- Reddedilen: bu işlerin `kimlik`in sistem aktörü olarak yetki kapısından geçmesi (aktörün yetkisini derlemek için de aynı tabloları okumak gerekir; döngü çözülmez).
- "Yalnız kendisi" işaretiyle ilişkisi (ikinci tur): işaretli her uç ya hiçbir tabloya dokunmaz ya da çekirdek listededir; bugünkü üç uç (çıkış, "yetkilerim", parola değiştir) listede adıyla yazılıdır. `KullaniciSorgusu` çekirdek yol değildir; yetki kapısından okur.
- Çekirdek yolların izi (ajan önerisi; ikinci tur 10): değişiklik kaydı "hangi üyelik ve yetenekle" ister (KR-010 Seçim 40), çekirdek yolda ise yetenek yoktur. Çekirdek yolun yazdığı değişiklik kaydı yetenek yerine yolun adını taşır; sır tablolarının değişiklik kaydı değer taşımaz, yalnız "değişti" der. KR-013'e işlenecek.

Bir alt özelliğin dosyaları (örnek `oturum/`; öbürleri aynı kalıbı izler):
```
oturum/
  presentation/     oturum.controller.ts · giris.schema.ts · yenile.schema.ts          (Zod; KR-014)
  application/      giris.command.ts · giris.handler.ts · yenile.* · cikis.* · oturum-kapat.*
                    oturumlarim.query.ts · oturumlarim.handler.ts · yetkilerim.*
  domain/           oturum.ts (kayıt ve kuralları: kapat, döndür, yeniden kullanım)
                    oturum.repository.ts (okuma arayüzü + onu genişleten tam arayüz; KR-011 Seçim 6)
                    belirtec-uretici.port.ts · oturum.events.ts
  infrastructure/   oturum.prisma-repository.ts · belirtec-uretici.rs256.ts
```
- Dosya adları (ajan önerisi; kullanıcı teyidi, 2026-11-24): iş sözcükleri Türkçedir (`giris`, `oturum`, `yenile`); desen ve altyapı sözcükleri İngilizce kalır (`command`, `handler`, `query`, `schema`, `repository`, `controller`, `port`, `acl`, `events`), çünkü bunlar çatının ve desenlerin kendi adlarıdır (KR-011 Seçim 7).

Ortak kodda duran sözleşmeler (`shared/kimlik/`; `kimlik` uygular). Biçimler taslaktır; hepsi düz veri taşır, tek istisna aynı işlemde yazan metodun aldığı işlem nesnesidir (KR-005 Kural 4):
```
OturumDenetimi                                   tüketen: shared/guvenlik (kimlik guard'ı)
  denetle({ oturumId, ipAdresi, tarayiciBilgisi })
    → { gecerli: true,  kullaniciId, kisiSurumu, genelSurum }
    | { gecerli: false, neden: yok | kapali | suresi_doldu | adres_degisti | kullanici_pasif }

YetkiVerisi                                      tüketen: shared/yetki (derleyici)
  surumler(kullaniciId) → { kisiSurumu, genelSurum }
  kisininSatirlari(kullaniciId)
    → { kisiSurumu, genelSurum,
        uyelikler:  [{ uyelikId, grupId, rolId }],
        yetenekler: [{ yetenekId, grupId, rolId, kaynak, eylem,
                       sart, butunKayitlar, butunBirimler, kolonlar, butunKolonlar }],
        altGruplar: { grupId → [altındaki grupların kimlikleri] } }

GirisYontemi                                     tüketen: kimlik'in oturum çekirdeği; uygulayan: kimlik ve proje
  ad                                             'parola' · 'tek_kullanimlik_kod' · projenin yöntemi
  baslatSemasi? · dogrulaSemasi                  yöntemin iki adımının girdi şemaları (KR-014)
  baslat?(girdi)        → void                   iki adımlı yöntemin ilk adımı (kod iste)
  dogrula(girdi)        → { sonuc: tamam, kullaniciId, kanit } | { sonuc: yanlis | kilitli | kapali }
  kesinlestir(islem, kullaniciId, kanit) → tamam | gecersiz      kişinin kilidi altında, oturumla aynı işlemde

KullaniciSorgusu                                 tüketen: öbür feature'lar (kendi ACL'leriyle)
  gorunenAdlar(isteyenId, kullaniciIdleri) → { kullaniciId → görünen ad }
```
- `OturumDenetimi`: adres karşılaştırması ve uymayan oturumun kapatılması `kimlik`in içindedir (kural sahibinde durur); guard yalnız imzası doğrulanmış adres bilgisini verir ve sonucu uygular. Tek okumadır; yalnız adres uymadığında bir yazma yapar (KR-009 Kural 8). Bu çağrı bir çekirdek yoldur.
- `YetkiVerisi`: `surumler`, oturumu olmayan işler içindir (sistem aktörüyle çalışan tüketici, zamanlanmış iş, istek içindeki "sistem aktörü olarak okuma"); onlar da her iş biriminde sürüme bakar (çürütme 8). `kisininSatirlari` sürümleri satırlardan önce okur (çürütme 9): arada bir yetki yazılırsa saklanan kayıt eski sürüm damgasını taşır ve bir sonraki iş biriminde yeniden derlenir; tersi sırada silinmiş bir yetenek yeni damgayla saklanırdı. Derlemeyi ortak koddaki motor yapar; `kimlik` yalnız düz veri verir (ajan seçimi; kullanıcıya bildirildi).
- `GirisYontemi`: sözleşme ortak kodda durur, çünkü projenin kendi yöntemi başka bir feature'da yaşar ve `kimlik`i içe aktaramaz (KR-005 Kural 1). `dogrula` yavaş olabilir; oturum açmaz ve kişiyi kilitlemez, ama yöntemin kendi sayaçlarını yazabilir (deneme sayısı; önceki hâl "yan etkisizdir" diyordu ve `kilitli` sonucuyla çelişiyordu; ikinci tur 12). `kesinlestir` kilit altında kısa bir denetim ya da tek bir yazmadır (çürütme 1 ve 10). `kanit` düz veridir: parolada sırrın doğrulama anındaki `guncelleme_zamani` değeri, kodda kod satırının kimliği. Projenin yöntemi `kesinlestir`i boş bırakırsa çekirdeğin kendi denetimleri (pasif, unutulmuş, sistem aktörü, oturum sınırı) yine tutar; kaybolan yalnız o yöntemin tek kullanımlığı ve sır tazeliğidir ve sözleşme bunu zorlayamaz. Sonuç ayrımlıdır; çekirdek "yanlış", "kilitli" ve "kapalı"yı ayırır, ama dışarıya hepsi için aynı cevabı verir (kayıtlı olmayan ile yanlış parola ayırt edilemez). Kişinin etkin olduğuna ve sistem aktörü olmadığına çekirdek bakar, yöntem değil.
- `KullaniciSorgusu`: isteyenin `Kullanici:oku` yeteneğinden geçer; isteyenin göremediği kişi cevapta yer almaz. Base kapalı doğar: görünen adları herkesin okumasını isteyen proje bunu (Kök, Temel) kümesine yazdığı tohum yeteneğiyle açar (kullanıcı teyidi, 2026-11-24; kabul edilen bedel: açılana kadar "kim yaptı" bilgisi sıradan kullanıcıya boş görünür).
- Açık (çürütme 9; emin olunmayan kısım): üç tabloyu tek anlık görüntüde okumak, ağaç açılımı ve satır kilitleri ham SQL isteyebilir; KR-010 "feature içinde ham SQL ile okuma yapılmaz" der. Prisma 7 ile ham SQL'siz yazılıp yazılamadığı ön koşul adımında denenecek (kişi ve sayaç kilidi ile tek sorgulu oturum denetimi ikinci adımın işidir; deneme ondan önce bitmelidir; ikinci tur). Yazılamıyorsa ham SQL kullanan yerler çekirdek yollar gibi adıyla sayılacak.

Ortak kodda kalan motor: belirteç imzasının doğrulanması ve kimlik guard'ı; adres imzasının doğrulanması; yetki belleği (bellek, Redis, veritabanı sırası); yetenek satırlarını CASL kuralına derleyen derleyici; şartı sorgu koşuluna ve ekranın biçimine çeviren çevirici; repository'nin okuma ve yazma kapısı; dekoratörler ("izin", "herkese açık", "yalnız kendisi").

Uçlar ve izinler (ajan önerisi; adresler yazılmadı, yalnız işler sayıldı). İzin `kaynak:eylem` biçimindedir; kaynak adı model adıdır (KR-008 Seçim 33), her niyet komutu kendi eylemidir (KR-008 Seçim 34).
```
Oturumsuz (herkese açık; deneme sınırı ister)
  parola ile giriş · kod iste · kodu doğrula · yenile · bağlantıyla parola belirle

Kişinin kendi üzerinde, "yalnız kendisi" işaretiyle (oturum gerekir; yetenek aranmaz)
  çıkış · yetkilerim (ekranın kuralları) · parola değiştir

Kişinin kendi üzerinde, yetenek satırıyla (herkesin temel üyeliğine tohumlanır; şart: sahibi isteği yapan)
  oturumlarım (Oturum:oku) · başka cihazdaki oturumumu kapat (Oturum:kapat)

Yönetim (izin gerekir)
  Kullanici   oku · olustur · guncelle · giris_bilgisini_degistir · pasife_al · yeniden_ac
              · parola_baglantisi_uret · unut
  Oturum      oku · kapat
  Grup        oku · olustur · guncelle · tasi · sil
  Rol         oku · olustur · guncelle · sil
  Izin        oku
  Uyelik      oku · olustur · sil
  Yetenek     oku · olustur · yenile · sil
```
- Grup, rol, üyelik ve yetenek yazımı ilk sürümde yalnız (Kök, SuperAdmin) kümesine bağlanabilir (KR-008 Seçim 17); "kullanıcı aç", "pasife al" ve "yeniden aç" o kuralın adıyla istisnalarıdır (Seçim 31 ve 43).
- Hesap ele geçirme yolu (çürütme 3) — kapandı (kullanıcı, 2026-11-24; KR-008 Seçim 47): a. İlk hâlde `Kullanici:guncelle` taşıyan kişi bir SuperAdmin'in telefonunu kendi numarasıyla değiştirip kod isteyerek, `parola_baglantisi_uret` taşıyan kişi SuperAdmin için bağlantı üretip parolayı kendisi belirleyerek SuperAdmin olabiliyordu. Kural: hedef kişi canlı bir (Kök, SuperAdmin) üyeliği taşıyorsa giriş bilgisini değiştirmeyi, bağlantı üretmeyi ve pasife almayı yalnız (Kök, SuperAdmin) üyesi yapar; komutun içinde, hedef kişinin kilidi altında denetlenir. Ek düzeltmeler (ajan önerisi): giriş bilgisini değiştirmek kendi izni olan ayrı bir iştir (`giris_bilgisini_degistir`); giriş bilgisi değişince kişinin oturumları kapanır; bir kişiye (Kök, SuperAdmin) üyeliği verilirken kullanılmamış parola bağlantısı silinir (bu yüzden "üyelik ver" o durumda kişiyi de kilitler).
- "Parola değiştir" eski parolayı sınayan oturumlu bir uçtur ve deneme sınırı ister (çürütme 20); yayın şartı aşağıda buna göre genişletildi.
- Kişinin kendi üzerindeki işler — kapandı (kullanıcı, 2026-11-24; KR-008 Seçim 46): c. Hedefini yalnız oturumdan alan ve parametreyle kayıt seçmeyen uç "yalnız kendisi" işaretini taşır; tablodan kayıt seçen iş yetenek satırından geçer. İşaretli uçlar sayılı bir listedir ve listeye ekleme makineyle denetlenir.
- Adlar (ajan okuması; KR-011 Seçim 7'nin devamı, kullanıcıya bildirildi, ayrıca sorulmadı): eylem adları Türkçedir (`oku`, `olustur`, `guncelle`, `sil` ve niyet eylemleri); uç adresleri feature ve alt özellik adlarından türer; istek ve cevap gövdesindeki alan adları modeldeki alan adlarıdır. Sonuncusu zorunluluktur: ekran aynı kuralları CASL ile değerlendirdiği için kuraldaki alan adı ile ekrana gelen kaydın alan adı aynı olmalıdır (KR-010 Seçim 38).
- Yayın şartı (ajan; KR-009 Seçim 9'daki şartın genişletilmesi): bir sırrı sınayan uçların hiçbiri (oturumsuz uçlar ve "parola değiştir") deneme sınırı tasarlanıp kurulmadan yayına çıkmaz; yerelde ve testte sınırsız çalışabilir. Deneme sınırı kümesi kodla giriş yazılmadan önce kullanıcıyla kararlaştırılacak.
- İlk SuperAdmin (çürütme 15; ikinci tur 6) — kapandı (kullanıcı, 2026-11-24; KR-008 Seçim 28 eki): a. Tohum göçü ilk SuperAdmin kullanıcısını ve üyeliklerini, base'in verdiği tek yardımcıyı çağırarak yazar; yardımcı kullanıcıyı, (Kök, Temel) ve (Kök, SuperAdmin) üyeliklerini ve sürüm sayılarını doğru yazar, sistem aktörleri de onunla yazılır. Yardımcı bir çekirdek parçadır ("tohum"); yalnız göçten çağrılır ve göçün işlemi içinde çalışır, çünkü göç Unit of Work kullanmaz. Yardımcı yalnız yeni kullanıcı yazar: verilen giriş bilgisi zaten varsa hata verir ve hiçbir şey yazmaz (üçüncü tur 2; var olan hesaba SuperAdmin yazsaydı o hesabın oturumu, parolası ve bağlantısı yerinde kalır, parolayı önceden belirlemiş kişi SuperAdmin olurdu). Kilitlenme yolunda göç yeni bir kullanıcıyla yeni bir SuperAdmin yazar. Göçü koşan aracın kendisi tasarlanmadı (üçüncü tur 3): göç dosyasının yeri, işlemi kimin açtığı, uygulanmış göçlerin defteri ve lint'teki yeri yazılı değil; bugünkü lint kuralına göre `features/kimlik/_shared` klasörünü yalnız `kimlik`in kendisi ve kök dosyalar içe aktarabilir. Bu tasarım ikinci adımın ilk yaprağıdır. Parola bağlantısını kurulum komutu üretir ve terminale bir kez basar (KR-009 Seçim 9); komut kullanıcı ya da üyelik yazmaz. Ajanın önerisi ilk SuperAdmin'i komutun yazmasıydı; kullanıcı göçü seçti. Kabul edilen bedel: ilk yöneticinin giriş bilgisi göç dosyasında durur (ajan önerisi, teyide sunulmadı: yardımcı giriş bilgisini parametre alır, proje onu ortam ayarından da okuyabilir); hiçbir SuperAdmin giremezse yeni bir göç yazılıp yayınlanır (KR-008). Bu, "kullanıcı tek yoldan açılır" cümlesinin adıyla sayılı istisnasıdır. Komut iki kez koşarsa ikinci bağlantı ilkini öldürür (değişmez 14). İzde "kim" olarak ne yazılacağı açık.

Yazılmadı: uç adresleri ve şemaları; öbür alt özelliklerin dosya dökümü; olayların adları ve zarfı (KR-012); değişiklik ve erişim kayıtlarının hangi işlerde yazıldığı (KR-013).

## Seçenekler
### Tabloların sahibi
İlk hâlde reddedilen seçenek iki cümleyle ve yalnız "daha az parça" diye anlatılmıştı; çürütme turu bunu adil bulmadı (bulgu 16). İkisinin de kazancı ve bedeli:
- A — Sahibi ortak kod. Kazanç: her istekte çalışan yolda sözleşme ve bağdaştırıcı olmaz; KR-010 Seçim 36 ("oturum ve sürüm altyapı tablosudur, yalnız ortak altyapı kodu erişir") olduğu gibi kalır; BADI'deki düzene yakındır; dosya sayısı azdır. Bedel: kimlik kavramlarının iş kuralları (son SuperAdmin, davet, pasife alma) ortak kodda, bir feature'ın domain katmanı dışında durur; faz 2'de ortak kodu servise bölmek gerekir.
- B — Sahibi `kimlik` feature'ı (kullanıcı seçti, 2026-11-24). Kazanç: `kimlik` kendi tablolarının ve kurallarının sahibi olan bir bounded context olur; kural sahibinde durur. Bedel: her istekte oturum denetimi ve derlemede yetki verisi bir sözleşmenin arkasından geçer (ölçülmedi); dosya sayısı artar; "çekirdek yollar" diye sayılı bir istisna sınıfı doğar; KR-010'un iki cümlesi değişir.
- Dürüst not: "faz 2'de olduğu gibi servise çıkar" kazancı kanıtlanmadı. Oturum denetimi her istekte çağrılır; `kimlik` ayrı servis olursa bu çağrı her istekte ağa çıkar. Çekirdek yolların varlığı A'da da vardır, yalnız adı "ortak altyapı kodu"dur; fark, B'de bu yolların adıyla sayılmak zorunda olmasıdır.
### Oturum bir kaynak mı
İlk hâlde seçenek olarak yazılmamıştı (bulgu 16). Kullanıcının Seçim 46'daki tercihi (tablodan kayıt seçen iş yetenek satırından geçer) oturumu kaynak yapar.
- Kaynak (bugünkü hâl). Kazanç: "oturumlarım" ve oturum kapatma için yeteneksiz ikinci bir okuma yolu açılmaz; yönetici başkasının oturumunu olağan izinle görür ve kapatır. Bedel: sırlar ayrı tabloya ayrılır; oturum satırındaki adres ve tarayıcı bilgisi yetenekle açılabilen kolon olur.
- Kaynak değil. Kazanç: KR-009'daki tek satır ve KR-010 Seçim 36 yerinde kalır. Bedel: "oturumlarım" ve yöneticinin oturum kapatması için yetki kapısının dışında adıyla sayılı iki yol daha gerekir.
### Bu hâlin kendi yapısal seçimleri
İkinci tur bunlar için seçenek yazılmadığını söyledi. İlk ikisini ajan seçti ve kullanıcı 2026-11-24'te teyit etti ("uygun"; üçüncü tur, ikisinin de ikinci adımda kodlanacağını ve teyitsiz olduğunu göstermişti); üçüncüsü ajan seçimidir ve teyide sunulmadı.
- Doğrulamanın yeri. Seçilen: yöntem girdiyi işlemin dışında doğrular, sonra kilit altında "kesinleştir" (iki aşama, `kanit`). Öbür yol: doğrulamayı kişi kilidinin içinde yapmak; `kanit` ve iki aşama kalkar, ama parola özetleme boyunca bir veritabanı bağlantısı ve kişi kilidi tutulur (özetleme süresi ölçülmedi; yavaşsa bağlantı havuzu dolar).
- Kilit olarak kişinin satırı. Seçilen: `kullanici` satırının anahtar dışı güncelleme kilidi. Öbür yol: kişi başına ayrı bir kilit satırı ya da veritabanının danışma kilidi; kullanıcı tablosunu yabancı anahtar çakışmasından tamamen ayırır, ama yeni bir parça ya da ham SQL ister.
- Son döndürme zamanının yeri. Seçilen: `oturum` tablosu ("oturumlarım" son etkinliği gösterir; açık oturum tek tablodan hesaplanır). Öbür yol: sır tablosu; yenileme tek tabloya yazar, ama liste hareketsiz oturumu ayırt edemez.
- B'nin bedeline ek (ikinci ve üçüncü tur): çekirdek liste gövdede ilk yazılandan uzundur; yönetim işleri için dokuz çekirdek parça, göç için bir parça daha gerekir.

## Hata modları
| Ne bozulur | Nasıl fark edilir | Ne kadar yayılır | Ne yapılır |
|---|---|---|---|
| Aynı oturum için iki yenileme aynı anda gelir | ikincisi bir önceki nesille gelir | o oturum | kilit sıraya sokar; pencere içindeyse oturum yaşar (KR-009 Kural 3 ve 4) |
| Yenilemenin cevabı yolda kaybolur | istemci aynı isteği tekrarlar | o oturum | pencere içinde oturum yaşar; ne döneceği açık (Kural 4) |
| Hırsız çerez deposunu kopyalar ve art arda yeniler | gerçek sahibi eski nesille döner | o kişi | imzalı ve nesilli belirteç kaç nesil eski olursa olsun tanınır; bütün oturumlar kapanır (KR-009 Seçim 12) |
| Giriş, parola değişimi ya da pasife almayla yarışır | — | o kişi | giriş kişiyi kilitler ve kilit altında yeniden bakar; kapatmadan sonra oturum kalmaz |
| Girişin cevabı yolda kaybolur | istemci yeniden girer | o kişi | yetim oturum sınırdan bir yer tutar; en eski kapanır kuralı onu sırası gelince düşürür, hareketsizlik sınırı da kapatır |
| Kod tüketilir ama oturum açılamaz | — | o giriş | kod oturumla aynı işlemde tüketilir; işlem düşerse kod yanmaz |
| Redis'e ulaşılamaz | bağlantı hatası | herkes; yalnız yavaşlama | yetki veritabanından derlenir ve bellekte tutulur; oturum etkilenmez |
| Veritabanına ulaşılamaz | oturum denetimi hata verir | herkes | kimlikli istek reddedilir (kapalı düşer); sağlık ucu bildirir |
| Oturum denetimi ya da yetki verisi arayüzü hata atar | istisna | o istek | istek reddedilir; izin verilmiş sayılmaz |
| (Kök, Temel) tohum yetenekleri eksik | "oturumlarım" kayıt döndürmez | herkes; yalnız o iki iş | çıkış, "yetkilerim" ve parola değiştirme çalışır (KR-008 Seçim 46). Göç eksik satırı yazar; yönetici satırı bilerek sildiyse göç dokunmaz, durur ve bildirir (KR-008 Seçim 16), yönetici yeniden yazar |
| Adres imzasının anahtarı iki tarafta farklı | imza doğrulanamaz | herkes | adres bilgisi yok sayılır ve istek reddedilir; iki taraf anahtarı açılışta denetler (KR-009 Kural 9) |
| Bir yetenek satırı derlenemez (bozuk şart) | derleme bildirir | o yeteneği taşıyan kümeler | yetenek derlenmez, kişi o yetenekten yoksun kalır (KR-010) |
| İki cihaz aynı anda giriş yapar | — | o kişi | giriş kişinin satırını kilitler; sınır korunur |
| Aynı kullanıcı adıyla iki "kullanıcı aç" aynı anda gelir | tekil kısıt | o iki istek | biri reddedilir |
| Çok sayıda giriş aynı anda parola özetler | bellek ve süre artar | giriş yapanlar | açık: aynı anda koşan özetleme sayısına sınır; ölçülmedi |
| Bir giriş yöntemi kapatılır | o yöntemle girenler giremez | o yöntemin kullanıcıları | son açık yöntem ve SuperAdmin'siz kalan yöntem kapatılamaz |
| Hiçbir SuperAdmin giremez | yönetim işleri durur | yönetim | tohum göçü üyelik yazar, kurulum komutu bağlantı üretir (KR-008) |
| Kurulum komutu iki kez koşar | — | o kullanıcı | ikinci bağlantı ilkini öldürür; başka etkisi yoktur |
| Pasife alınan kişinin o an süren isteği | — | o istek | süren istek tamamlanır; bir sonraki reddedilir |
| Sunucuların saatleri ayrışır | imza ve belirteç süreleri kayar | bütün istekler | tasarlanmadı (açık) |
| Veritabanı yedekten geri yüklenir | kapatılmış oturumlar dirilir; nesiller geriye gider | herkes | geri yükleme yordamı bütün oturumları kapatır (Redis'teki yetki kayıtlarını temizleyen yordamla birlikte; KR-010). Yapılmazsa her etkin kullanıcının ilk yenilemesi tutarsız nesil ya da sahte hırsızlık alarmı üretir |
| Hırsız çalıntı oturumu yeniler, sonra çıkış yapar | gerçek sahibi kapalı oturuma eski nesille döner | o kişi | istek reddedilir ve güvenlik olayı yazılır; öbür oturumların kapatılması açık (üçüncü adım) |
| Terk edilen oturum hiç yenilenmez | satır kapatılmamış kalır | tablo ve kısmi dizin | "açık" hesabı onu saymaz; satırı temizlik işi kapatır (tasarlanmadı) |
| Genel sayaç satırı yok (göç koşmamış) | yetki yazımı ve her istekteki okuma satır bulamaz | herkes | ikisi de reddedilir (kapalı düşer); göç koşturulur |

## Performans mantığı
- En sık yol, kimlikli istek: 1 sorgu oturumu, kişinin durumunu ve iki sürüm sayısını birlikte okur (birincil anahtarla; veri büyüdükçe sabit kalır). Bu okuma tek bir adlı ham sorgudur (kullanıcı, 2026-11-24; KR-010 Seçim 49): ölçüldü ki model API'siyle aynı okuma 3 ayrı SELECT gönderir, tek ham deyim 1 SELECT. Yetki belleği isabet ederse başka okuma yoktur; ıskalarsa 1 Redis gidişi, o da ıskalarsa sürüm okuması ve ardından satırların okunması (üyelikler, yetenekler, alt gruplar) ile derleme yapılır.
- Yenileme: 1 işlem; kişinin ve oturumun satır kilidi, 2 satır yazması (`oturum`: son döndürme zamanı; `oturum_sirri`: nesil ve özetler). Oturum başına 15 dakikada bir. Kişinin satır kilidi yalnız aynı kişinin eşzamanlı işlerini sıraya sokar.
- Giriş: 1 tekil dizin okuması, 1 parola özetleme (işlemin dışında; süresi ölçülmedi), 1 işlem.
- Yönetim listeleri sayfalıdır; yetki koşulu sorgunun içindedir (KR-010 Seçim 37).
- Büyüme: `oturum` kapalı satırlarla büyür; her istekteki okuma birincil anahtara baktığı için bundan etkilenmez. Kapatılmamışların kısmi dizini ise terk edilmiş oturumlarla büyür; temizlik işi yazılana kadar bu doğrudur (ikinci tur 7; önceki hâl "etkilenmez" diyordu). Ölçülmedi.
- `altGruplar` açılımı grup sayısıyla büyür; yalnız derlemede hesaplanır, istek başına değil.

## Aşamalar
- Tek yönlü: tablo ve kolon adları ile saklanan değerlerin biçimi (veri göçü ister); yenileme belirtecinin biçimi; sözleşmelerin biçimi (tüketen her yeri bağlar). `giris_kodu` tablosu soruları açıkken çizilmedi ve henüz tek yönlü sayılmaz.
- Çift yönlü: alt özelliklerin bölünüşü; dosya düzeni ve adları.
- Sıra (ajan önerisi; plan ağacında kesinleşecek; çürütme 14'e göre düzeltildi):
  1. Ön koşul (ortak kod; bu feature'dan önce): Prisma ve iki veritabanı, Unit of Work'ün iki kapısı, outbox tablosu, yetki motorunun iskeleti. Bu adımda ayrıca denenir: satır kilidinin kipi ve ham SQL'siz alınması (boş güncellemenin Prisma'da gerçekten bir güncelleme deyimi üretmesi, genel sayaç satırı dahil); tekil dizinli bir kolonu (`kullanici_adi`, `telefon`) değiştiren güncellemenin tam satır kilidine düşüp düşmediği ve dizinin kısmi olmasının bunu değiştirip değiştirmediği (üçüncü tur 8; inceleyici emin değil); oturum, kişi ve genel sayacın tek sorguda okunması. İnceleyiciye göre bu adım hemen başlayabilir.
  2. Yürüyen iskelet: tohum göçü koşucusu (ilk yaprak; yeri, işlemi ve uygulanmışlar defteri o yaprakta tasarlanır), tohum göçü ve tohum yardımcısı (kök grup, temel ve SuperAdmin rolleri, izin kataloğu, ilk SuperAdmin, yönetim yetenekleri), kurulum komutu, kullanıcı aç, bağlantıyla parola belirle, parola ile giriş (kilit ve "kesinleştir" adımıyla; sonradan yeniden yazılmasın diye), grup ve rol oluştur, üyelik ver, yetenek yaz, o yetenekle korunan bir ucu iki ayrı birimde çağır, çıkış. Oturum bu adımda adresi yazar ve her istekte denetler; adres imzasının doğrulanması da bu adımdadır ve sınamalarda imzayı test üretir (aracı katman üçüncü adımda gelir; ikinci tur 15). Bu adımın beklediği iki kullanıcı kararı (çekirdek listeye eklemeler; ilk SuperAdmin'i kimin yazdığı) 2026-11-24'te kapandı.
  3. Oturumun sertleşmesi, ince bir aracı katman dilimiyle birlikte: yenileme, cihaz bağı, adres kapısı ve imza, oturum sınırı, yeniden kullanım, hareketsizlik. Adres imzası ve yenileme düzeni gerçek imzalayıcı ve gerçek istemci olmadan sınanmış sayılmaz.
  4. Yönetimin kalanı: yetenek yenileme, pasife alma, giriş bilgisini değiştirme, oturum kapatma, unutma.
  5. Deneme sınırı ve tek kullanımlık kodla giriş.
  6. Aracı katmanın kalanı (Next.js): `<Can>`, ekranlar.

## Doğrulama
KR-008, KR-009 ve KR-010 "Doğrulama" listeleri bu feature'ın sınamalarıdır. Bu tasarımın ekledikleri (öneri, ajan; kod yazılmadı, denetim kimliği yok):
- Sahiplik: ortak kodda feature içe aktarımı 0 (lint kuralı var; `backend/eslint.config.mjs`).
- Sır ayrımı: `Oturum` ve `Kullanici` modellerinin «bütün kolonlar» açılımında özet alanı yoktur; kaynak olmayan modele ilişki üzerinden bakan şart, süzgeç ve sıralama reddedilir.
- Tek sorgu: kimlikli istekte kimlik için çalışan sorgu sayısı 1'dir.
- İşaret listesi: "yalnız kendisi" işaretini taşıyan uçların sayısı listedeki ad sayısına eşittir.
- Çekirdek liste: çekirdek erişim arayüzünü içe aktaran dosyalar sayılı listeyle aynıdır; yönetim uçlarının hiçbiri onu içe aktarmaz, yalnız izinli olduğu çekirdek parçayı çağırır (parça başına çağıran iş listesi denetlenir). "SuperAdmin sorusu" parçası üyelik satırı döndürmez.
- Yarış: parola değişimi ve pasife alma, eşzamanlı bir girişle birlikte koşturulur; sonunda kişinin açık oturumu yoktur.
- Nesil: iki kez döndürülmüş oturumda iki nesil eski belirteç bütün oturumları kapatır; imzasız ya da bozuk belirteç hiçbir oturumu kapatmaz.
- Yükseltme: parolası önceden belirlenmiş ve oturumu açık bir hesaba (Kök, SuperAdmin) üyeliği verilince eski parola ve eski oturum işe yaramaz; yalnız yeni bağlantıyla girilir.
- Ele geçirme: gerekli yetenekleri taşıyan ama SuperAdmin olmayan bir yönetici, bir SuperAdmin'in giriş bilgisini değiştiremez, ona bağlantı üretemez ve onu pasife alamaz; sıradan bir kullanıcıya üçünü de yapabilir (KR-008 Seçim 47).
- Kilit sırası: iki ters sıralı komut çifti eşzamanlı koşturulur; hiçbiri kilitlenme hatasıyla düşmez. İki yönetici birbirine aynı anda bağlantı üretir; ikisi de başarılı olur.
- Parola değişimi yarışı: aynı eski parolayla eşzamanlı iki değişimden yalnız biri başarılı olur.
- Tür: erişim belirteci yenileme ucuna gönderilirse reddedilir ve hiçbir oturum kapanmaz.
- Unutma: son SuperAdmin unutulamaz; unutulan kişinin canlı üyeliği ve açık oturumu kalmaz.
- Ret kalıcılığı: yeniden kullanım, süre ve adres nedeniyle reddedilen yenilemeden sonra oturum satırı kapalıdır ve güvenlik olayı yazılmıştır (ret, işlemi geri almaz).
- Bağlantı yarışı: bağlantı üretme ile aynı kişiye SuperAdmin üyeliği verme eşzamanlı koşturulur; SuperAdmin olmayan isteyen, sonunda geçerli bir bağlantıya sahip değildir.
- Tohum: yardımcı var olan bir giriş bilgisiyle çağrılınca hata verir ve hiçbir şey yazmaz.
- Bütünlük: üyelik okuma yeteneği dar olan bir yönetici, üyeliği olan grubu silemez.
- Girebilen SuperAdmin: bir yöntem kapalıyken kalan tek girebilen SuperAdmin pasife alınamaz.
- Tohum eksikliği: (Kök, Temel) yetenekleri silinmiş ortamda çıkış ve "yetkilerim" çalışır; "oturumlarım" kayıt döndürmez.
- Kapı: sahte bir üçüncü giriş yöntemi, oturum çekirdeğinde dosya değişmeden eklenir (KR-009 ölçüt 5).

## Çürütme
Birinci tur (2026-11-24): bağımsız bir oturum (inceleyici rolü; salt okuma) tasarımın ilk tam hâlini çürüttü. Hüküm: "imzalamam". 20 bulgu: 4 ağır, 12 orta, 4 hafif. İnceleyicinin bildirdiği sınırlar: TS-001'in tamamını ve kanon belgelerini okumadı; hiçbir şey kodla sınanmadı. Ajan her bulguyu belgeyle karşılaştırdı ve hepsini geçerli buldu; reddedilen bulgu yoktur. Düzeltilmiş hâl yeniden incelenmedi.

| # | Ağırlık | Bulgu | Cevap |
|---|---|---|---|
| 1 | ağır | Giriş parolayı işlemin dışında doğrular ve kilit altında yeniden bakmaz; parola değişimi ya da pasife almayla yarışan giriş, kapatmadan sonra oturum bırakır | Düzeltildi: kişinin oturumlarına dokunan her komut kişiyi kilitler; giriş kilit altında durumu ve sırrı yeniden denetler ("kesinleştir") |
| 2 | ağır | Yalnız bir önceki özet saklandığı için iki nesil eski belirteç tanınmaz; art arda yenileyen hırsız yakalanmaz | Kapandı (kullanıcı, 2026-11-24; KR-009 Seçim 12): imzalı ve nesilli yenileme belirteci, `oturum_sirri.nesil` |
| 3 | ağır | Kullanıcı güncelleme ya da bağlantı üretme izni olan kişi, telefonu değiştirerek ya da bağlantı üreterek SuperAdmin olabilir | Kapandı (kullanıcı, 2026-11-24; KR-008 Seçim 47): hedef SuperAdmin ise bu işleri yalnız SuperAdmin yapar; giriş bilgisi ayrı izin, değişince oturumlar kapanır |
| 4 | ağır | Tablolar "yetenekle okunur" deniyor, ama giriş, yenileme, oturum denetimi ve yetki verisi yeteneksiz çalışmak zorunda; bu yollar tanımsız ve KR-010'la çelişiyor | Kapandı (kullanıcı, 2026-11-24; KR-010 Seçim 48): adıyla sayılı, kapalı ve makineyle denetlenen "çekirdek yollar" listesi |
| 5 | orta | Üç ters kilit sırası var; otomatik yeniden deneme yok | Düzeltildi: tek kilit sırası; yenileme de kişiyi kilitler |
| 6 | orta | Değişmezlerin çoğunun tutan mekanizması yazılı değil; somut delikler var (pasif kişiye üyelik, kök üyeliğin kaldırılması, sistem aktörü, sistem satırı işareti, tohum anahtarı) | Düzeltildi: her değişmezin mekanizması yazıldı; `sistem_satiri` kolonu, denetim kısıtları, tohum anahtarı tekilliği eklendi |
| 7 | orta | Yenilemedeki denetimlerin sırası yok; sıra sonucu değiştiriyor | Kapandı (kullanıcı teyidi, 2026-11-24): yedi adımlı sıra; eski nesil cihaz sırrına bakılmadan yeniden kullanımdır |
| 8 | orta | Oturumu olmayan işler sürüm sayılarını ucuz okuyamıyor | Düzeltildi: `YetkiVerisi.surumler` |
| 9 | orta | "Tek anlık görüntü" varsayılan yalıtımda sağlanmaz; ham SQL gerekebilir | Kısmen düzeltildi: sürüm satırlardan önce okunur. Ham SQL gereği açık; ilk parçada denenecek |
| 10 | orta | Giriş yöntemi sözleşmesi yalnız kimlik döndürüyor; kod tüketilip oturum açılamayabilir; yöntemin şeması sahipsiz | Düzeltildi: ayrımlı sonuç, `kesinlestir`, `girdiSemasi` |
| 11 | orta | "Kullanıcı aç" koşulsuz bağlantı üretiyor; yalnız kodla çalışan proje, boş giriş bilgisi ve yöntem kapatma tanımsız | Kapandı (kullanıcı teyidi, 2026-11-24): açık yönteme göre koşullu; `oturum.giris_yontemi`; kapatma kuralları |
| 12 | orta | 30 dakikalık hareketsizlik sınırı tasarımda yok; terk edilen oturum "açık" kalıyor | Düzeltildi: senaryo 8, yenilemenin 4. adımı, "açık"ın tanımı |
| 13 | orta | Unutmada üç alandan fazlası kalıyor; "unutuldu" durumu yok | Kapandı (kullanıcı teyidi, 2026-11-24): tablo tablo liste, `unutulma_zamani`, değişmez 17; iz veritabanındaki kayıtlar ayrıca konuşulacak |
| 14 | orta | Sıra: aracı katman en sonda; iskelette grup ve rol yok; tohum göçü yok; giriş iki kez yazılıyor | Düzeltildi: "Aşamalar" yeniden sıralandı |
| 15 | orta | İlk SuperAdmin'i kurulum komutuna taşımak KR-008 Seçim 28 ile çelişiyor | Düzeltildi: üyeliği tohum göçü yazar; komut yalnız bağlantı üretir |
| 16 | orta | Reddedilen seçenek adil anlatılmamış; oturumun kaynak olması için seçenek yazılmamış | Düzeltildi: "Seçenekler" yeniden yazıldı; kanıtsız kazanç öyle işaretlendi |
| 17 | hafif | Yalnız sistemin yazdığı kolonların mekanizması yok | Düzeltildi: gövdeden kabul edilmeyen kolon listesi |
| 18 | hafif | Şart ve süzgeç ilişki üzerinden özet kolonuna bakabilir | Düzeltildi: kaynak olmayan modele ilişki adımı reddedilir; sınamaya eklendi |
| 19 | hafif | "Tohum göçü düzeltilir" yöneticinin sildiği satırda geçersiz; iki kapatılma nedeni eksik | Düzeltildi |
| 20 | hafif | "Parola değiştir" de deneme sınırı ister; kullanıcı adı kanonu yok; değişmez 5 sistem aktörünü de kapsıyor; `giris_kodu` erken çizilmiş | Düzeltildi; kullanıcı adının yazım kanonu açık kaldı |

İnceleyicinin dört soruya cevabı (özet): tasarım üç yerde çöker (1, 2, 3); düşünülmemiş hata kipleri yukarıdaki tabloya eklendi; en güçlü karşı görüş tabloların ortak kodda kalması ve oturumun kaynak olmamasıdır ve ilk hâlde bastırılmıştı (16); bu hâliyle imzalamaz.

Birinci turun kullanıcıyla kapanan bulguları (2026-11-24): 2, 3 ve 4 kullanıcı seçimiyle; 7, 11, 13 ve `oturum_sirri` ayrımı kullanıcı teyidiyle.

İkinci tur (2026-11-24): ilk turu yapmamış başka bir bağımsız oturum (inceleyici rolü; salt okuma) ikinci hâli çürüttü. Hüküm yine "imzalamam"; gerekçesi: "çekirdek yapı (nesilli belirteç, kişi kilidi, doğrula ve kesinleştir, sayılı çekirdek yollar) tutuyor; ama SuperAdmin'e yükseltme yolu bir biçimde hâlâ açık ve iskeletin ilk komutu, kapalı denen listeyle çelişiyor". İnceleyicinin bildirdiği sınırlar: hiçbir şey kodla sınanmadı; TS-001'in küçük bir bölümünü okudu; veritabanı kilit kipleri kendi bilgisidir, bu depoda denenmedi. Ajan bulguları belgeyle karşılaştırdı ve hepsini geçerli buldu.

Birinci turun 20 bulgusu için ikinci turun hükmü: kapandı 8 (2, 8, 12, 14, 16, 18, 19, 20); kısmen 11 (1, 3, 4, 5, 6, 7, 9, 10, 11, 13, 17); yeni sorun getirdi 1 (15). Yani ajanın birinci turdan sonra "kapandı" diye yazdığı bulguların yarısından fazlası tam kapanmamıştı; kalan parçaları aşağıdaki yeni bulgulardadır.

| # | Ağırlık | Bulgu | Cevap |
|---|---|---|---|
| 1 | ağır | SuperAdmin üyeliği verilirken yalnız kullanılmamış bağlantı siliniyor: kullanıcıyı açan kişi parolayı önceden kendisi belirlemişse, o hesaba SuperAdmin verilince SuperAdmin olur | Kapandı (kullanıcı, 2026-11-24; KR-008 Seçim 47 eki): üyelik verilirken oturumlar kapanır, sır ve bağlantı silinir, veren SuperAdmin yeni bağlantı alır. Kodla girişte telefon açık kaldı |
| 2 | ağır | Kapalı çekirdek liste gövdeyle çelişiyor: "kullanıcı aç", bağlantı üretme, yeteneksiz üyelik yazımı, SuperAdmin okuması ve unutma listede yok; iskeleti bloke eder | Kapandı (kullanıcı, 2026-11-24; KR-010 Seçim 48 eki): liste `_shared` içindeki altı adlı parçayla tanımlanır ("Yapı") |
| 3 | orta | Parola değiştirmede girişteki yarışın aynısı: eski parolayı bilen biri kurbanın değişimini ezebilir | Düzeltildi: kilit altında sır ve oturum yeniden denetlenir |
| 4 | orta | Unutmanın izni yok; üyeliklere dokunmuyor, genel sayacı kilitlemiyor; son SuperAdmin unutulabilir; alanlara ne yazılacağı belirsiz | Düzeltildi: unutma pasife almanın üstüne kuruldu; `Kullanici:unut`; alan değerleri yazıldı. Genişletme teyide sunulmadı |
| 5 | orta | Yenileme sırasında dört açık: kapalı oturuma eski nesil alarmı susturuyor; pencere içi dal cihaz sırrını aşabilir; tür denetimi yok; nesil büyükse tanımsız | Kısmen düzeltildi: tür denetimi, pencere içi dalın 4–6'dan geçmesi, büyük nesil ve güvenlik olayı yazıldı. Kapalı oturuma eski nesilde öbür oturumların kapatılması açık (üçüncü adım; kullanıcı kararı) |
| 6 | orta | Göç ilk SuperAdmin kullanıcısını yazıyor: ikinci kullanıcı açma yolu; kök üyelik ve sürüm göç yazarına kalıyor; telefon kaynak koda giriyor; iskeleti bloke eder | Kapandı (kullanıcı, 2026-11-24; KR-008 Seçim 28 eki): göç yazar, base'in tek yardımcısıyla; bağlantıyı kurulum komutu üretir. Ajanın önerisi komuttu |
| 7 | orta | Süre kapatması yalnız yenilemede; terk edilen oturum hiç kapanmaz; son döndürme zamanı sır tablosunda | Düzeltildi: kolon `oturum`a alındı; "açık" hesap olarak tanımlandı; temizlik işi açık kaldı |
| 8 | orta | Sistem aktörü hedefini reddeden komutların listesi eksik ve iki yerde farklı | Düzeltildi: kullanıcıyı hedef alan bütün komutlar reddeder; üyelikleri yalnız göç yazar |
| 9 | orta | Giriş yöntemi kurallarının tutanı yok | Düzeltildi: açılış denetimi ve komut denetimi (değişmez 18 ve 19); bağlantı yalnız kullanıcı adı doluysa üretilir |
| 10 | orta | Çekirdek yolların iz kaydı tanımsız; iz "hangi yetenekle" ister | Öneri yazıldı: kayıt yetenek yerine yolun adını taşır; sır tabloları değer taşımaz. KR-013'e işlenecek |
| 11 | orta | Kilit kipi yok; tam satır kilidi yabancı anahtar yazmalarıyla çakışır; ilan edilen sıra iki komutta bozuluyor; beş komut işlem sınırlarında yok | Düzeltildi: anahtar dışı güncelleme kilidi; sıra düzeltildi; eksik komutlar yazıldı. Kip denenmedi |
| 12 | hafif | "Doğrula yan etkisizdir" cümlesi kilit sonucuyla çelişiyor; tek şema iki adıma yetmiyor; kanıtın içeriği yok | Düzeltildi |
| 13 | hafif | Değişmez 7'nin kısıtı KR-008'in saklanabilir saydığı satırları reddediyor | Düzeltildi: kısıt yalnız "ikisi birlikte"yi yasaklar |
| 14 | hafif | Giriş bilgisi değişiminin kapatma nedeni yok; bekleyen kodlar silinmiyor | Düzeltildi |
| 15 | hafif | Yedekten dönüş; genel sayaç satırının eksikliği; ikinci adımda adres imzası | Düzeltildi: hata modlarına ve "Aşamalar"a yazıldı |

İnceleyicinin kapanış cümlesi: yeni bulgulardan 1, 2, 3 ve 6 kapanırsa imzalar; kalanlar kendi adımlarına taşınabilir. 3'ü ajan düzeltti. 1, 2 ve 6'yı kullanıcı kapattı (2026-11-24); kullanıcı kararı bekleyen bulgu kalmadı. İnceleyicinin imza şartı olan dört bulgu (1, 2, 3, 6) kâğıt üstünde kapandı; kapanışları henüz bağımsız bir oturumca doğrulanmadı. Bu hâl yeniden incelenmedi.

Üçüncü tur (2026-11-24; dar doğrulama): önceki iki turu yapmamış üçüncü bir bağımsız oturum (inceleyici rolü; salt okuma) üçüncü hâli doğruladı. Hüküm: "düzeltmelerle imzalarım"; ağır yeni bulgu yok. İkinci turun imza şartı olan dört bulgudan 1, 3 ve 6'yı kapanmış, 2'nin iskeleti bloke eden kısmını kapanmış buldu. İkinci turun 15 bulgusu için: kapandı 11 (1, 3, 4, 6, 7, 8, 11, 12, 13, 14, 15; 1 ve 4'te küçük yan yollarla), kısmen 4 (2, 5, 9, 10). İnceleyicinin bildirdiği sınırlar: hiçbir şey kodla sınanmadı; kilit davranışları kendi bilgisidir; KR-005, KR-007, KR-014 ve kanon belgeleri okunmadı. Ajan bulguları belgeyle karşılaştırdı ve geçerli buldu.

| # | Ağırlık | Bulgu | Cevap |
|---|---|---|---|
| 1 | orta | Çekirdek parçaların çağıran listesi dört işte gövdeyle uyuşmuyor; bağlantı üretmede soru kilitten önce sorulursa bağlantı yanlış kişiye çıkar | Kapandı (kullanıcı, 2026-11-24: "devam"): liste dokuz parçaya çıkarıldı, çağıranlar yazıldı; soru kilit altında sorulur |
| 2 | orta | Tohum yardımcısı var olan hesaba SuperAdmin yazarsa giriş sıfırlanmıyor | Düzeltildi: yardımcı yalnız yeni kullanıcı yazar, var olan giriş bilgisinde hata verir |
| 3 | orta | Tohum göçünü koşan araç ve dosyanın yeri tanımsız | Kayda geçti: ikinci adımın ilk yaprağı; tasarımı o yaprakta yapılacak |
| 4 | orta | Bütünlük denetimlerinin okuması hangi yoldan, yazılı değil; kapıdan okunursa "boş mu" açık tarafa düşer | Kapandı (kullanıcı, "devam"): "SuperAdmin sorusu" parçası "bütünlük sorusu"na genişledi |
| 5 | orta | Açılış denetimi uygulamayı durduruyor, ama komutlar "girebilen" SuperAdmin'i saymıyor | Düzeltildi: son SuperAdmin sayımı açık yöntemle girebilenleri sayar; açılış denetimi çekirdek listeye yazıldı |
| 6 | orta | Kapatıp reddeden dallar, ret hata olarak atılırsa işlemin geri almasıyla kapatmayı da siler | Düzeltildi: bu dallar işlemi tamamlar, reddi sonuç değeri olarak döndürür |
| 7 | hafif | KR-009 ve KR-008 bu hâlin gerisinde kaldı (kilit sırası, son döndürme zamanının yeri, tür denetimi, olay yazımı, üçüncü istisna) | Düzeltildi: iki karar dosyası güncellendi |
| 8 | hafif | Küçük tanımsızlar: unutmada pasif işareti; SuperAdmin verirken bağlantının koşulu ve kodlar; zaten SuperAdmin olan hedef; kilit kipi ve tekil dizin; girişte son döndürme zamanı; sayı ve ad tutarsızlıkları | Düzeltildi; kilit kipi ve tekil dizin ön koşul adımındaki denemeye eklendi |

İnceleyicinin kapanış cevabı: birinci adım başlanabilir, bloke eden karar yok; ikinci adımı bekleten kullanıcı kararı yok, yazarın üç tanımı (tohum göçü koşucusu, yardımcının var olan hesaptaki davranışı, bütünlük okumalarının yolu) ve kullanıcının bir teyidi gerekir. Teyit 2026-11-24'te alındı (iki aşamalı doğrulama; kilit olarak kişinin satırı); üç tanımdan ikisi bu hâle yazıldı, tohum göçü koşucusu ikinci adımın ilk yaprağına bırakıldı.
