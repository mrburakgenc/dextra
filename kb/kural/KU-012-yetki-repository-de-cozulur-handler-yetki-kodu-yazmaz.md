---
kimlik: KU-012
tur: kural
durum: taslak
surum: 1
baslik: Yetki repository'de çözülür; handler yetki kodu yazmaz
dayanak: [KR-007@1]
kapsam: [backend/src/features/**/application/**, backend/src/features/**/infrastructure/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: AbilityFactory **sadece Repository'de** inject edilir.
---
İnce yetki repository'de çözülür: repository `AbilityFactory` alır, okuma metotları isteği yapan kullanıcının kimliğini parametre alır ve satır ile alan süzmesini kendisi uygular. Handler yetki kodu yazmaz; `AbilityFactory.buildFor` ve `accessibleBy` handler'da çağrılmaz.

## Neden
Belgedeki gerekçe (satır 180, 327): yetki disiplini guard ve repository ikilisinde toplanır; yetki handler'da çözülürse repository yetkiyi bilmez hâle gelir.

## İhlal örneği
Belgeden: handler'ın `abilityFactory.buildFor(...)` çağırıp koşulu kendisinin kurması (satır 317–329); repository'nin `AbilityFactory` almadan ve kullanıcı kimliği parametresi olmadan sorgu yapması (satır 267–275).

## Uygun örnek
Belgeden: handler `this.repo.findMany(query.criteria, query.requesterId)` çağırır (satır 332–339); repository `accessibleBy` ile sorgu koşulunu ve izinli alanlarla seçimi kendisi uygular (satır 278–303).

## Alım notu
- Kaynak: Kural 3.1, 3.5 ve 3.7 / CASL-05, CASL-07 (satır 182–212, 257–343); belge ikisini "aynı kanonun iki yüzü" diye anar (satır 180). Aynı deseni Pattern 20 (`PATTERNS.md`) anlatır.
- Belgedeki istisna: yazma komutunda kayıt düzeyinde son denetim için `throwUnlessCan` (satır 342–343).
- İstisna adayı (BADI tuzak kaydı T-0397): BADI'de handler içinde yetki nesnesi kuran iki belgeli istisna vardır (kullanıcının kendi yetkisini döndüren sorgu, menü görünürlük süzgeci); bu depo için kullanıcı kararı bekler.
- Desenin beşinci adımı (kişisel alanın maskelenmesi, satır 264) alınmadı; kullanıcı kararı bekler (TS-001 Ç6).
- Belgedeki örnekler repository'yi doğrudan enjekte eder; bu depoda repository'ler Unit of Work'ün `run` ve `read` kapılarından alınır (TS-001 "Yapı", Ç8).
- Belge gelecekteki bir lint kuralını anar (satır 308); hedef denetim düzeyi mekaniktir.
- Kapsam yolu varsayımdır.
- Uyarı (çürütme turu, 2026-11-22; satırlar ajan tarafından okundu): belgedeki uygun örnek olduğu gibi alınamaz. Kullanıcı süzgecini yetki koşulunun üstüne yayar (satır 293), kolon listesini tür adıyla sorar (satır 288), yetki koşulu yoksa boş koşula düşer (satır 287) ve sayım sorgusu süzgeci taşımaz (satır 298). KR-008 taslağı bunların tersini ister; örnek kabulden önce bu depo için yeniden yazılacak.
- Açık (kural cümlesi): cümle yalnız okumayı söyler; yazma yollarındaki denetim KR-008'de tanımlanınca eklenecek.
- Uyarlama notu (2026-11-23; ikinci çürütme turu 53. bulgu): yazmanın tanımı geldi (KR-008 Seçim 10, 18 ve 34; KR-010 Seçim 26 ve 37) ve yetki motoru iki katmandır: altta CASL, üstte bu deponun derleyicisi (KR-010 Seçim 38; 2026-11-24'te düzeltildi, önceki not "CASL değildir" diyordu). Kural cümlesi, örnekler ve dayanak (`KR-008`, `KR-010`) kabulden önce buna göre yeniden yazılacak; `AbilityFactory` ve `accessibleBy` yeniden geçerli adaylardır, kanondaki bellekte kayıt denetimi (`throwUnlessCan`) alınmaz.
