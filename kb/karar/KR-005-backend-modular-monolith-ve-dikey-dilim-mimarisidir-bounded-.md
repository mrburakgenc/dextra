---
kimlik: KR-005
tur: karar
durum: taslak
surum: 1
baslik: Backend modular monolith ve dikey dilim mimarisidir; bounded context = feature
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-21
baglam: TS-001
kaynak: kb/_gelen/ARCHITECTURE.md
alinti: W0NDERSUPERIOR'da `features/<feature>/` bir **Bounded Context**'tir.
---
Backend için modular monolith ve dikey dilim mimarisi (VSA) seçildi: her feature bir bounded context'tir ve kendi içinde Clean Architecture ile kurulur (domain, application, infrastructure, presentation); özellikler birbirinden yalıtılır ve tek uygulama olarak dağıtılır, karşılığında feature'lar arası her ihtiyaç shared üzerinden bir sözleşmeyle kurulmak zorundadır.

> Alım notu: bu taslak `kb/_gelen/ARCHITECTURE.md` belgesinden alındı (satır 48–157). "Belgede yok" yazan yerler belgenin söylemediği, kullanıcıya sorulacak kısımlardır; "öneri (ajan)" yazan yerler onay bekler.

## Bağlam
- Kullanıcının kanonu backend'i "Modular Monolith + Vertical Slice Architecture" olarak tanımlar (satır 70) ve DDD bounded context'ini VSA feature'ı ile eşler (satır 50).
- Kullanıcı (2026-11-21): her feature kendi içinde bir Clean Architecture olacak; yani katmanlar uygulama genelinde değil, her feature'ın içinde kurulur. Kanondaki karşılığı: "Her feature kendi klasorunde **4-Layer Clean Architecture VSA + Pragmatic CQRS** disiplini uygular." (`IRON_RULES_BACKEND.md` satır 1076).
- Katman adı `presentation`'dır; `interface` adı kullanılmaz (`IRON_RULES_BACKEND.md` satır 1087).
- Her bounded context en az bir sub-feature içerir; sub-feature'sız düz `features/<feature>/application/` yasaktır (satır 95–97).
- Use-case dosyaları (komut ya da sorgu, handler, sonuç, test) aynı klasörde durur (satır 134).
- Kullanıcı (2026-11-23): kuralı olmayan basit alt özellik de dört katmanı taşır. Gerekçesi: DDD tam sağlanmalı, olay güdümlü tasarım (EDD) gelebilir, yapı sağlam olmalı ve kurallar tam geçmelidir. Reddedilen: katmanların karmaşıklığa göre seçilmesi (her alt özellikte "bu basit mi" kararı insana ya da ajana kalır; basit alt özellik büyüyünce kod taşınır). Kanondaki tek istisna (kendi entity'si olmayan orkestrasyon alt özelliği) yerinde durur.
- Kullanıcı bu depoda BADI'nin mimarisini ve desenlerini referans almak istiyor; mikroservis bu fazın kapsamı dışıdır (TS-001 "Sorun"); kullanıcı 2026-11-23'te onun faz 2 olduğunu söyledi.
- Belgedeki yollar `backend/src-v2/...` biçimindedir; BADI'de ölçülen düzen `backend/src/features` ve `backend/src/shared`'dir (TS-001).

## Ölçütler
Belgede yok. Öneri ajanındır; kullanıcı 2026-11-23'te teyit etti:
1. Feature'lar arası doğrudan içe aktarma sayısı. Hedef: 0.
2. ACL dışından yapılan sözleşme çağrısı sayısı. Hedef: 0.
3. Eksik katmanlı alt özellik sayısı (kanondaki ince alt özellik istisnası hariç). Hedef: 0.
- Çıkarılan ölçü: "yeni feature eklenirken ortak kodda değişen dosya sayısı 0"; her yeni sözleşme ortak koda dosya eklediği için kendi kuralımızla çelişiyordu. Yerine yürüyen iskelette ölçülecek: yeni bir feature eklenirken base'in hangi dosyalarına dokunmak gerekir; hedef o ölçümden sonra konur.

## Seçenekler
Belge yalnız seçilen yapıyı anlatır; reddedilen seçenek ve gerekçe yazmaz.
### A — Modular monolith + dikey dilim (belgedeki yapı)
Tek uygulama; her feature kendi katmanlarıyla bir dilimdir; feature'lar birbirini içe aktarmaz.
### B — Mikroservis
Reddedilmedi, ertelendi. Kullanıcı (2026-11-23): mikroservis faz 2'dir; modular monolith ve dikey dilim bu işin temelidir; ABAC ve diğer sistemler burada sağlam oturtulur, sonra yapı adım adım mikroservise taşınır. Belgede yok.
### C — Yatay katmanlı tek uygulama
Bütün controller'lar, servisler ve repository'ler tür bazında klasörlenir. Belgede yok. Neden seçilmedi (öneri ajan; kullanıcı teyidi, 2026-11-23): bir özelliği değiştirmek her tür klasörüne dokunmayı gerektirir ve özellikler arası sınır denetlenemez; kullanıcının "özellikler birbirini bozmadan ayrı ayrı geliştirilsin" isteğini karşılamaz.

## Seçim
A (belgedeki yapı; kullanıcı 2026-11-21'de kanonun tamamını uygun buldu).
- Neden (kullanıcı, 2026-11-21): özellikler birbirini bozmadan ayrı ayrı geliştirilsin.
- Neyden vazgeçildi (öneri ajan; kullanıcı teyidi, 2026-11-23): feature'ların bugünden ayrı ayrı ölçeklenip dağıtılması (faz 2'ye ertelendi); feature'lar arası doğrudan çağrının kolaylığı (her ihtiyaç sözleşme ve ACL ister); basit alt özelliklerde az dosya.

Feature'lar arası erişim (öneri ajan; kullanıcı 2026-11-23'te teyit etti: "uygun"; hiçbiri denenmedi, yürüyen iskelette sınanacak). Kanonun dört yolu geçerlidir (`IRON_RULES_EVENTS.md` EVT-00: senkron ön koşul için shared arayüz sözleşmesi, dış sistem için ACL, "olduktan sonra" için outbox üzerinden olay, çok adımlı iş için saga). Kural 1 ve 2 kanondur; 3–7 bu deponun ekidir ve gerekçesi kullanıcının faz 2 hedefidir.
```
shared/<konu>/…sözleşme.ts                 arayüz + düz veri tipleri
features/<sahip>/…bağdaştırıcı.ts          sözleşmeyi uygular; iş kodu buradadır
features/<tüketen>/
  _shared/domain/<x>.port.ts               tüketenin kendi diliyle arayüz
  _shared/infrastructure/<sahip>.acl.ts    ACL: sözleşmeyi çağırır, veriyi ve hatayı çevirir
  <alt özellik>/application/…              yalnız port'u tanır
```
- Kural 1 (kanon). Feature başka feature'ı içe aktarmaz (KU-007).
- Kural 2 (kanon). Sözleşme iş konusuyla adlandırılır ve sahibini anmaz; feature dışarıya yalnız sözleşmenin belirtecini verir.
- Kural 3. Başka feature'da yazma iki yoldan olur: "ikisi birlikte olmalı ya da hiç" ise aynı veritabanı işleminde, "olduktan sonra şu da olsun" ise olayla. Aynı işlemde yazarken işlem nesnesi sözleşmeye açıkça verilir; tüketen feature karşı tarafın repository'sini kendisi alamaz (belirtecini içe aktaramaz). Kullanıcı (2026-11-23): bütün repository'ler tek Unit of Work'e kayıtlı olduğu için aynı işlemde yazmada sorun yoktur. Ajanın ilk önerisi yalnız olayla yazmaktı; kullanıcı almadı. Kabul edilen bedel: servis ayrıldığı gün aynı işlemde yazan her çağrı olaya ya da saga'ya çevrilir.
- Kural 4. Sözleşme düz veri alır ve verir; kayıt sınıfı ve Prisma tipi geçmez. Tek istisna, aynı işlemde yazan metodun aldığı işlem nesnesidir.
  - Genişletme (kullanıcı, 2026-11-24; KR-011 Seçim 10): işlem içindeyken okuma kapısı hata verdiği için, işlem içinden çağrılan okuma sözleşme metodu da işlem nesnesini alır. İstisna artık "aynı işlemde çalışan metot"tur, yazan ya da okuyan.
- Kural 5. Her tablo tek feature'ındır; başka feature o tabloyu sorgulamaz ve ilişki üzerinden çekmez, kimlikle başvurup ayrıntıyı sözleşmeden ister. Veritabanındaki yabancı anahtar yerinde kalır. Bedel: listede başka feature'ın bilgisi için toplu bir sözleşme çağrısı gerekir (ölçülmedi).
- Kural 6. Yetki şartındaki ilişki adımı yalnız aynı feature'ın tablosuna gider (KR-008 Seçim 4'e ek sınır).
- Kural 7. Feature dışarıya yalnız kendi ACL'i üzerinden ulaşır: ACL feature'ın `_shared/` klasöründe durur, feature'ın kendi diliyle yazılmış bir arayüzü (port) uygular, ortak koddaki sözleşmeyi çağırır ve veriyi ile hatayı çevirir; alt özelliklerin iş kodu sözleşmeyi doğrudan çağırmaz. Kullanıcı (2026-11-23): "ACL'yi şu an istiyorum, bu yapıda onsuz olmaz". Ajanın ilk önerisi çeviricinin varsayılan olarak yazılmamasıydı; kullanıcı reddetti. Bedel: feature'lar arası her ihtiyaç dört dosya ister.
- Kazanç (ajan): bir feature'ın dışarıya bütün bağımlılıkları ve aynı işlemde yazan çağrıları ACL dosyalarından sayılır; faz 2'nin taşıma listesi budur. Feature servise çıkınca aynı sözleşmeyi kanondaki dış sistem ACL'i uygular ve tüketen kod değişmez (öngörü).
- Ad: kanon "ACL" adını dış sistem bağdaştırıcısı için kullanır (`shared/external/<vendor>/`, sekiz sorumluluk); buradaki ikinci bir türdür (feature ACL'i).
- Açık: Kural 7'nin makineyle denetimi denenmedi; kanonun olay sınırı kuralı (EVT-11) okunmadı; ortak koddaki sözleşmelerin base'e mi projeye mi ait sayılacağı ve ölçütün bunları nasıl sayacağı yazılmadı.

## Sonuçlar
- Olumlu: belgede yok.
- Olumsuz: belgede yok. Basit bir alt özellik de dört katmanın dosyalarını taşır (kullanıcı 2026-11-23'te bu bedeli kabul etti); belgedeki "ince sub-feature" istisnası bunu yalnız kendi entity'si olmayan alt özellik için hafifletir.
- Yükümlülük: feature'lar birbirini doğrudan içe aktarmaz (KU-007); her feature kendi içinde Clean Architecture'dır ve bağımlılık içe akar (KU-008); çapraz kesen yetenekler yalnız shared'de yaşar (KU-009).
- Yükümlülük (kanonda yok; kullanıcı 2026-11-23'te teyit etti; kural taslağı açılacak): shared hiçbir feature'ı içe aktarmaz; bağımlılık yalnız feature'dan ortak koda akar.
- Yükümlülük adayları (kural taslakları açılacak): "Feature'lar arası erişim" bloğundaki Kural 3–7.
- Ortak parça: belgede yok. Öneri (ajan): içe aktarma sınırını denetleyen lint ayarı ve yeni feature için klasör şablonu.

## Doğrulama
Belgede yok; denetim kimliği ve ölçüm tarihi henüz yok.
Öneri (ajan): içe aktarma sınırı lint'i kurulunca denetim düğümü açılır. Birim: içe aktarma satırı (import).
Öneri (ajan; kullanıcının "kurallar tam geçmeli" sözünden, 2026-11-23): alt özellik klasöründe dört katmanın varlığını denetleyen mekanik bir denetim. Birim: alt özellik klasörü.

## Varsayımlar
- Klasör düzeni BADI'deki gibidir (`backend/src/features`, `backend/src/shared`); varsayım, 2026-12-21'e kadar klasör düzeni kararıyla kesinleşecek.
- BADI backend'inde eslint-plugin-boundaries kurulu: ölçüldü (2026-11-21, package.json).
- Aynı araç bu depoda sınır ihlalini yakalar; varsayım, 2026-12-21'e kadar yürüyen iskelette denenecek.

## Geri dönüş
Belgede yok. Öneri ajanındır; kullanıcı 2026-11-23'te teyit etti: yatay katmanlı düzene dönmek bütün dosyaların taşınmasıdır ve pahalıdır (bu yüzden karar tek yönlüdür); karara yeniden bakma zamanı faz 2'ye geçiş kararıdır. Eşik sayısı belirlenmedi.
- İleri yol (kullanıcı, 2026-11-23): faz 2'de yapı adım adım mikroservise taşınır; bu karar o taşımanın temelidir.
- Taşımayı zorlaştıracağı bilinen üç nokta (ajan; hiçbiri çözülmedi, hiçbiri denenmedi): feature'lar arası aynı veritabanı işleminde yazma (servis ayrılınca dağıtık işlem olur); feature'lar arası veritabanı ilişkisi ve yetki şartındaki ilişki adımı (KR-008 Seçim 4; şartı tek veritabanı değerlendirir, KR-010 Seçim 37); tek şema dosyası.

## İstisna yolu
Belgedeki istisnalar (satır 139):
- Çok küçük bounded context tek sub-feature ile başlar; sub-feature yine de bir klasördür.
- Kendi entity'si olmayan, yalnız orkestrasyon yapan sub-feature için `domain/` ve `infrastructure/` isteğe bağlıdır.

Bunların dışında geçici sapma yoktur; sapma gerekiyorsa önce bu karar değiştirilir (öneri ajan; kullanıcı teyidi, 2026-11-23; dayanağı kullanıcının "kurallar tam geçmeli" sözü).
