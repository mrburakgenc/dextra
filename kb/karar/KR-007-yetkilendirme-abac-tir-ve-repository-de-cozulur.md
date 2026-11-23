---
kimlik: KR-007
tur: karar
durum: taslak
surum: 1
baslik: Yetkilendirme ABAC'tır ve repository'de çözülür
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-21
baglam: TS-001
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: **Tek mod: ABAC.** Bi-Modal kavrami v11 refactor'da kaldirildi.
---
Yetkilendirme için tek mod olarak ABAC seçildi ve ince yetki repository'de çözülür: guard kaba denetimi yapar, repository satır ve alan düzeyini uygular, handler yetki kodu yazmaz; yetki disiplini iki yerde toplanır, karşılığında her repository yetki motoruna bağımlı olur ve okuma metotları isteği yapan kullanıcının kimliğini parametre alır.

> Alım notu: bu taslak `kb/_gelen/IRON_RULES_BACKEND.md` belgesinden alındı (bölüm 2, 3, 4, 5.5, 18, 19) ve `kb/_gelen/IRON_RULES_SHARED.md` bölüm 5 ile karşılaştırıldı. "Belgede yok" yazan yerler kullanıcıya sorulacak; "öneri (ajan)" yazan yerler onay bekler.

> Uyarlama notu (2026-11-23; ikinci çürütme turu 50–52. bulgular): bu taslak kanondan alındığı hâliyle duruyor ve KR-008 ile KR-010'daki kullanıcı seçimleriyle dört yerde çelişiyor; kabulden önce yeniden yazılacak. (1) Yetki motoru CASL değildir (KR-010 Seçim 38); CASL, `AbilityFactory`, `accessibleBy` ve `throwUnlessCan` ifadeleri kanon alıntısıdır. (2) Yazmada kayıt denetimi "nadir istisna" değil, her yazmanın parçasıdır ve yetenek yetenek yapılır (KR-008 Seçim 10 ve 18, KR-010 Seçim 37). (3) "Rol ataması eksikse 403" cümlesi eksiktir: rol tek başına izin vermez, yetenek satırı gerekir. (4) İstek içi yetki belleği "kurala çevrilmeyenler"de duruyor; KR-010 onu "kim adına" ve "hangi sürüm" ile anahtarlı olarak zorunlu kılar.

## Bağlam
- Kanon tek mod tanımlar: her feature repository'de çözülen ABAC kullanır; iki modlu yapı, RBAC geri dönüşü ve `roles.includes` kalıntısı yoktur (satır 172–174).
- Guard (PoliciesGuard) kaba denetim yapar: eylem ve kaynak türü eşleşmezse 403 döner; alan ve koşul hesaplamaz (satır 177, 184–187).
- Repository ince denetimi yapar: `AbilityFactory` alır, `accessibleBy` ile sorgu koşulu ekler, izinli alanlarla seçim yapar, yazma yollarında kayıt düzeyinde denetler (satır 178).
- Handler yetki kodu yazmaz (satır 179).
- Eksik kayıt varsayılan olarak reddedilir: kaynak kaydı, izin ya da rol ataması eksikse 403 (satır 216–221).
- Kullanıcı (2026-11-21): shared'den sonra kurulacak ilk yapı ABAC'tır; yetki sisteminin ana dekoratörleri shared'de durur (TS-001).
- Kullanıcı (2026-11-21): yetki matrisi bu kümede tam olarak yeniden değerlendirilecek; ayrıntılı yapılacaklar oradan çıkacak.
- Kullanıcı (2026-11-21): yapı grup → rol → izin → koşul (nitelik) zinciridir; koşul izinde durur ve ABAC esnekliği oradan gelir. Ayrıntı ve açık noktalar TS-001 "Veri modeli" bölümündedir; bu karar yalnız yetkinin nerede çözüldüğünü söyler, veri modeli ayrı karar konusudur. Veri modeli taslağı KR-008'dir; orada koşul izin kataloğunda değil, izni gruba ve role bağlayan yetenek satırında durur (kullanıcı, 2026-11-22).
- BADI backend'inde CASL kuruludur (ölçüldü, 2026-11-21, package.json).
- Unit of Work seçimi (TS-001 "Yapı"): repository'ler `run` ve `read` kapılarından alınır; kanon örnekleri eski biçimle (`this.uow.transaction`, doğrudan enjeksiyon) yazılmıştır.

## Ölçütler
Belgede yok. Kullanıcıya sorulacak.
Öneri (ajan): yetki kodu içeren handler sayısı 0; yetki dekoratörü taşımayan endpoint sayısı 0.

## Seçenekler
### A — Tek mod ABAC, repository'de çözülür (belgedeki yapı)
Guard kaba, repository ince, handler temiz.
### B — İki modlu yapı (ABAC ve RBAC geri dönüşü)
Belge v11'de kaldırıldığını söyler (satır 172, 249–255); gerekçesini yazmaz, "audit'te dokümante" der (o belge alınmadı).
### C — Yetki handler'da çözülür
Belge yasaklar (CASL-07, satır 310–313); gerekçe olarak yalnız örnekteki not vardır: repository yetkiyi bilmez hâle gelir (satır 327).

## Seçim
A (belgedeki yapı; kullanıcı 2026-11-21'de kanonun tamamını uygun buldu).
- Neden: belgede yalnız sonuç cümlesi var — yetki disiplini guard ve repository ikilisindedir, handler temizdir (satır 180).
- Neyden vazgeçildiği belgede yok; kullanıcıya sorulacak.

## Sonuçlar
- Olumlu: belgede yok.
- Olumsuz: belgede yok. Öneri (ajan): her repository yetki motoruna bağımlıdır; okuma metotları kullanıcı kimliği parametresi taşır.
- Yükümlülük: guard sırası sabittir (KU-010); her endpoint tam bir yetki dekoratörü taşır (KU-011); yetki repository'de çözülür, handler yetki kodu yazmaz (KU-012); `requesterId` gövdeden okunmaz (KU-013); rol kalıtımı yoktur (KU-014); izin değişikliği sürümlü göçle yapılır (KU-015).
- Kurala çevrilmeyenler (ayar, test ya da yetki matrisi değerlendirmesi adayı): yeni endpoint için kaynak kaydı + izin + rol üçlüsü (satır 214–221), `Action`/`Resource` sabit biçimi (satır 351–374), istek başına ability önbelleği (CASL-08), hassas endpoint'e özel hız sınırı (satır 457–473), RS256 imza, HttpOnly cookie, refresh token'ın hash'li saklanması, Redis'li hız sınırı (`IRON_RULES_SHARED.md` satır 338–348).
- Alınmayanlar: rol ve kaynak adları, token süreleri ve eşzamanlı oturum sayısı (proje ayarı), `src-v2` yolları, eklentinin kendi hook'u.
- Kullanıcı kararı bekleyen: repository deseninin beşinci adımı kişisel alanı maskelemeyi söyler (satır 264); kullanıcının 2026-11-17 talimatı gereği alınmadı (TS-001 Ç6).
- Ortak parça (belgedeki adlar): `shared/authorization` altında dekoratörler, PoliciesGuard, AbilityFactory, FieldFilterHelper, ResourceRegistry.

## Doğrulama
Belgede yok; denetim kimliği ve ölçüm tarihi henüz yok. Belge gelecekteki bir lint kuralını anar (satır 308).
Öneri (ajan): Birim: uç (endpoint) ve handler.

## Varsayımlar
- Klasör yolları KR-005 ve KR-006 taslaklarına dayanır (`backend/src/features`, `backend/src/shared/authorization`); varsayım, 2026-12-21'e kadar yürüyen iskelette kesinleşecek.
- CASL bu depoda da kullanılır; varsayım, 2026-12-21'e kadar yığın kurulumunda kesinleşecek.
- Yetki koşullarının baktığı kullanıcı nitelikleri bu base için belirlenmedi (belgede `groupPath` örneği var); varsayım: yetki matrisi değerlendirmesinde belirlenir, 2026-12-21'e kadar.

## Geri dönüş
Belgede yok. Kullanıcıya sorulacak: geri almanın bedeli ve yeniden bakma tetiği.

## İstisna yolu
Belgedeki istisnalar:
- Kimlik ve yetki gerektirmeyen uç (sağlık denetimi, webhook): `@Public()` ile `@SkipPolicies()` birlikte ve gerekçe yorumuyla (satır 234, 387–388).
- Yazma komutunda kayıt düzeyinde son denetim için `throwUnlessCan` kullanılabilir; belge "nadir, dokümante edilmiş" der (satır 342–343).

Bunların dışındaki sapma için belgede yol yok; kullanıcıya sorulacak.

## Kaynakta bulunan tutarsızlıklar
Ham kaynak düzenlenmez; düzeltme kullanıcının eklenti deposunda yapılır.
- AUTH-03 örneğinde outbox satırı transaction kapandıktan sonra yazılır (satır 1949–1958); TXN-03 aynı transaction'da yazılmasını şart koşar (satır 561–568).
- CASL-08 örneğinde ability önbelleği kullanıcı kimliğine bakmadan istekteki ilk sonucu döndürür (satır 436–445); aynı istekte başka bir kullanıcı için çağrı durumunu belge söylemez. BADI tuzak kaydı T-0534 bunun orada yaşandığını yazar (hook hatırlatması, 2026-11-21).
- SEC-10 gövdedeki `requesterId`'yi doğrulamayla reddeder, SEC-11 değeri global interceptor'a yazdırır (satır 1129–1165); NestJS belgesine göre interceptor pipe'tan önce çalışır (okundu 2026-11-21), BADI tuzak kaydı T-0394 mekanizmanın orada güvenilmez bulunduğunu yazar. Bu depoda ölçülmedi (KU-013).
