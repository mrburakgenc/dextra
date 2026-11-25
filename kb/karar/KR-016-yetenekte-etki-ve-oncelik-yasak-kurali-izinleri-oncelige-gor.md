---
kimlik: KR-016
tur: karar
durum: taslak
surum: 1
baslik: Yetenekte etki ve öncelik: yasak kuralı izinleri önceliğe göre kapatır
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-25
baglam: TS-008
---
Yöneticinin bir eylemi, bir kaydı ya da bir kolonu açıkça yasaklayabilmesi için yeteneğe etki (izin ya da yasak) ve öncelik (0–100) eklendi: yasak, kendisinden yüksek öncelikli olmayan izinleri tuttuğu kayıtlarda ve kolonlarda kapatır; karşılığında "yetenek eklemek yalnız erişim açar" özelliği gider ve yetki motoru, ekran ile iz kayıtları genişler.

## Bağlam
- Kullanıcı (2026-11-25): "adamda 2 yeri aynı yeteneği varsa kazanma durumu vardı priority mevzusu ne oldu"; sorulunca "şimdi tasarlansın" dedi. Yön, ilk taslağın çürütme turundan sonra kullanıcı tarafından seçildi: "Kanondaki gibi: giremez kuralı ve öncelik".
- Bugün yalnız izin veren kural vardır ve kazanan yoktur (ölçüldü, 2026-11-25: `backend/src/shared/yetki/infrastructure/okuma-kapisi.ts`, `yazma-kapisi.ts`). Yetenek kararı (KR-008, taslak) Seçim 9 önceliği ve etkiyi ertelemişti.
- Kanon (`kb/_gelen/ARCHITECTURE.md` satır 429) kuralları izin ve yasak olarak, öncelik sırasıyla derler; ekrandaki yetki kitaplığının doğal davranışı da budur (çürütme turlarında kurulu sürümle ölçüldü).
- Tasarım kaydı TS-008 üç bağımsız çürütme turundan geçti; kullanıcı otuz ayrıntıyı tek tek karara bağladı (TS-008 "Kapanan uçlar"). Karşı görüş kullanıcıya sunuldu: bugün bu base'de yasağın etkileyebileceği canlı satır yoktur (29 yeteneğin hepsi sistem satırıdır; ölçüldü) ve bedel tek yönlüdür; kullanıcı "tasarıma devam" dedi.

## Ölçütler
1. Davranışı sınayan var olan uçtan uca testlerde değişen beklenti sayısı. Hedef: 0. Ölçüm: testlerin koşumu.
2. Yasağı olmayan kişinin okumasındaki ek sorgu sayısı. Hedef: 0. Ölçüm: sorgu sayan test.
3. Sessizce düşen yasak sayısı. Hedef: 0 (bozuk yasağın her biçimi izni kapatır). Ölçüm: bozuk yasak testleri.
4. Kök yöneticinin yasakla kapanan sistem izni sayısı. Hedef: 0. Ölçüm: muafiyet testleri.
5. Sunucu ile ekranın aynı kural ve kayıtta ayrıştığı durum sayısı. Hedef: 0. Ölçüm: eşlik testi.

## Seçenekler
### A — Yasak kuralı ve öncelik
İzin ve yasak iki ayrı etkidir; öncelik hangisinin öne geçtiğini belirler, eşitlikte yasak kazanır. Beş ölçütün hepsi karşılanabilir; bir eylemi, kaydı ya da kolonu açıkça yasaklar. Bedeli: sorguda olumsuzlama, ekranda yasaklar için ikinci bir değerlendirme, ret kaydı ve teşhis ucu.
### B — Önceliği yüksek olan yetenek tek başına geçerli
Kullanıcının ilk seçimiydi; birinci çürütme turu beş engel buldu (boş değerde satır kaybı, derlenmeyen kuralda erişimin genişlemesi, yazmada yarış, ekranda açık düşme) ve bir eylemi yasaklayamıyordu. Kullanıcı bıraktı.
### C — Ertelemek
Bugünkü birleşim kalır; bedeli sıfırdır. Hiçbir kısıtlama senaryosunu karşılamaz. İkinci çürütme turu bunu önerdi; kullanıcı seçmedi.

## Seçim
A. Neden: açık yasak yazılabilir; kanonun ve ekrandaki kitaplığın davranışıyla aynıdır; KR-008 Seçim 9'un ertelediği "kapatma" budur. Vazgeçilen: "yetenek eklemek yalnız erişim açar" özelliği (yasak silinir ya da bozulursa erişim genişleyebilir; bunu kapatan kurallar KU-017 ve "yasakla" iznidir) ve yetki motorunun sadeliği.

## Sonuçlar
- Olumlu: kısıtlama bir izni silmeden yazılabilir; yöneticinin "neden göremiyor" sorusu teşhis ucuyla cevaplanır.
- Olumsuz: yasak bir kara listedir; şemaya eklenen yeni kolon geniş izinle kendiliğinden görünür. Bozuk yasak bir kümenin iznini topluca kapatabilir (göçten önce tarama gerekir). Bugün yasağın etkileyeceği canlı satır yoktur; iş ilk projeye yatırımdır.
- Yükümlülük: uygulanamayan yasak sessizce düşmez (KU-017); kök yöneticinin sistem izinleri yasakla kapatılmaz (KU-018); uç guard'ı yalnız izin kurallarını sayar (KU-019); yeteneğin etkisi değişmez ve yasak yalnız iki biçimde yazılır (KU-020).
- Ortak parça: şart çeviricinin "yasak bu kaydı kesin tutmuyor" koşulu; ekranda yasaklar için özel eşleyici; sunucu ile ekranın eşlik testi.
- Ezilenler: KR-008 Seçim 3 ("satırlar birbirini ezmez": yasak izni kapatır), Seçim 9 (erteleme), Seçim 30 (sistem satırının yanına yazılarak daraltma: kök yönetici için geçersiz); KR-010'un derleme eşlemesi (etki ve öncelik taşır) ve Seçim 40 (ret kaydı ayrı tablodur). Ayrıntı TS-008 "Aşamalar" 0. adımdadır.

## Doğrulama
Ölçüm tarihi 2026-11-25: tasarım (TS-008) üç bağımsız çürütme turundan geçti; kod henüz yoktur. Uygulamada her ölçüt bir testle sınanır (TS-008 "Doğrulama"); yapı denetimine (DN-002) eklenecek mekanik denetim uygulama görevlerinde açılır. Birim: yetenek satırı, uç ve sorgu.

## Varsayımlar
- Veritabanı istemcisinin genel "değil"i boş değerli satırı düşürür, "değil ya da boş" tutar: tek yaprak için ölçüldü (2026-11-25, üçüncü çürütme turu); ağaç ve büyüklük işleçleri için varsayım, ikinci aşamanın başında ölçülecek.
- Satır kilidi beklerken koşul yeniden değerlendirilir: varsayım; 2026-12-31'e kadar, dördüncü aşamanın başında ölçülecek.
- Ekranda yasaklar için özel eşleyici yazılabilir: ikinci çürütme turunda ölçüldü (2026-11-25).
- Yasak sayısının liste süresine etkisi kabul edilebilir düzeyde kalır: varsayım; 2026-12-31'e kadar, son aşamada 1, 10 ve 50 yasakla ölçülecek.

## Geri dönüş
İki kolonun, iki iznin, motorun, ekranın ve teşhisin eklenmesi çift yönlüdür: yasak yazımı son aşamaya kadar uçta ve veritabanı kısıtıyla kapalıdır, o zamana kadar davranış değişmez. Tek yönlü olan yazımın açılmasıdır: yasak satırları yazıldıktan sonra davranış onlara bağlanır. Geri dönüş yordamı: yasak satırları pasife çekilir, öncelikler göçle 0'a çekilir, veritabanı kısıtı geri konur; motor yerinde kalır. Yeniden bakma tetiği: ilk gerçek projede yasağın kullanımı ve son aşamadaki ölçüm.

## İstisna yolu
- Kök yönetici rolünün sistem satırı olan izinleri yasaklardan muaftır (kilitlenmeyi önlemek için).
- Kişisiz işler (sistem aktörü) yetki kapısından geçmeyen çekirdek yolları kullanır; yasaklar onlara uygulanmaz.
- Korunan kaynakların (yetenek, üyelik, rol, grup) yazma eylemlerine yasak yazılamaz.
Bunların dışında istisna yoktur: yasak kişinin bütün üyeliklerindeki izinlere ve bütün eylemlere uygulanır.
