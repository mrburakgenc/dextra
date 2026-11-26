---
name: kod-tasarimi
description: Kod tasarımı için ortak sözlük (modül, arayüz, derinlik, dikiş, bağdaştırıcı, kaldıraç, yerellik) ve silme testi. Yeni bir parça ya da soyutlama eklerken, bir arayüzü biçimlendirirken, incelemede "gereğinden karmaşık mı" sorusunu cevaplarken ya da başka bir skill bu sözlüğe ihtiyaç duyduğunda kullan.
argument-hint: <isteğe bağlı: tasarlanacak ya da değerlendirilecek parça>
---

Şu parçayı bu sözlükle değerlendir: $ARGUMENTS

Amaç **derin** parçadır: küçük bir arayüzün arkasında çok davranış. Çağıran az şey öğrenip çok iş yaptırır,
bakımcı değişikliği tek yerde yapar, test aynı arayüzden girer. Terimler aşağıdaki anlamlarıyla ve hep aynı sözcükle
kullanılır; "bileşen", "servis", "API" gibi eş anlamlılara kayılmaz, çünkü ortak dilin bütün değeri tutarlılıktır.

## Sözlük

- **Modül**: arayüzü ve gerçeklemesi olan her parça. Ölçekten bağımsızdır: bir işlev, sınıf, paket ya da birkaç katmanı
  kesen bir dilim olabilir.
- **Arayüz**: çağıranın modülü doğru kullanmak için bilmesi gereken her şey. Tip imzasıyla bitmez: değişmezler, çağrı
  sırası, hata kipleri, gereken ayar ve başarım özellikleri de arayüzdür.
- **Derinlik**: küçük arayüzün arkasındaki davranış miktarı. Arayüz gerçeklemesi kadar karmaşıksa modül **sığdır**.
  Derinlik satır oranı değildir; gerçeklemeyi şişirmek modülü derinleştirmez.
- **Dikiş**: davranışın içeri girmeden gözlendiği ve değiştirilebildiği sınır; modülün arayüzünün durduğu konum. Dikişin nereye konacağı, arkasına ne konacağından ayrı bir karardır.
- **Bağdaştırıcı**: dikişte duran, arayüzü karşılayan somut gerçekleme. Rolü anlatır (hangi yuvayı doldurduğunu),
  içeriği değil: Prisma repository'si de bellek içi sahte de bağdaştırıcıdır.
- **Kaldıraç**: çağıranın derinlikten kazancı; az bilgiyle çok iş yaptırması. Tek gerçekleme N çağıranda ve M testte
  karşılığını verir.
- **Yerellik**: bakımcının derinlikten kazancı; bir değişikliğin, hatanın ve doğrulamanın tek yerde kalması. Bir kez
  düzelt, her yerde düzelmiş olsun.

## İlkeler

- **Silme testi.** Parçayı sildiğini düşün. Karmaşıklık bir yerde toplanır mı, yoksa yalnız yer mi değiştirir? Silince
  karmaşıklık birkaç çağırana dağılıp çoğalıyorsa parça işini görüyordur; silince karmaşıklık yok oluyorsa ya da
  olduğu gibi tek bir yere taşınıyorsa parça yalnız aktaran bir aracıdır, eklenmez.
- **Arayüz test yüzeyidir.** Çağıran ve test aynı dikişten geçer. Arayüzün arkasına uzanarak sınamak istiyorsan
  modülün biçimi büyük olasılıkla yanlıştır. Test iç yapı değişince değil, davranış değişince kırılmalıdır.
- **Tek bağdaştırıcı varsayımsal dikiştir, iki bağdaştırıcı gerçek dikiştir.** Dikişin iki yanında gerçekten değişen
  bir şey (çoğu zaman üretim ve test) yoksa araya arayüz koymak yalnız dolaylılıktır.
- **Derinlik arayüzün özelliğidir.** Derin bir modülün içi küçük, değiştirilebilir parçalardan oluşabilir; onlar
  arayüze çıkarılmaz. Testlerinin kullandığı iç dikişi yalnız test istiyor diye dışarı açma.

## Bu deponun kurallarıyla ilişkisi

- **KU-008 zorunludur.** Her feature'ın katmanları (presentation, application, domain, infrastructure) ve kanonun
  zorunlu kıldığı repository arayüzleri bu skill'in değerlendirmesine girmez. Bir repository arayüzünün tek Prisma
  gerçeklemesi olması onu "varsayımsal dikiş" yapmaz: o dikişi kural koyar, sen kaldırmazsın.
- **Silme testi ve tek bağdaştırıcı ilkesi katman sınırına uygulanmaz**; katmanın içinde işçinin kendi eklediği
  parçalara uygulanır: yeni bir yardımcı sınıf, sarmalayıcı, fabrika, strateji arayüzü, ara tip.
- **KU-005 geçerlidir.** Tek yerde kullanılan soyutlama eklenmez. Bu skill KU-005'i gevşetmez; ona ölçü verir: silme
  testinden geçmeyen ve tek bağdaştırıcılı soyutlama KU-005'in yasakladığı şeydir.
- Kural ile bu skill çelişirse kural geçerlidir; çelişkiyi bildir.

## Ne zaman

- Yeni bir modül, sarmalayıcı, arayüz ya da ara katman eklemek üzeresin.
- Bir arayüzü biçimlendiriyorsun: kaç işlev, hangi parametreler, hangi hata kipleri.
- İncelemede "kıdemli bir mühendis bunu gereğinden karmaşık bulur mu" sorusunu cevaplıyorsun.
- `mimari-tara` sürtünme arıyor ve adayları bu dille yazacak.

## Ne zaman değil

- KU-008'in katman klasörlerini ya da kanonun repository arayüzlerini tartışmak için: onlar kuraldır, bu skill değil.
- Alan kavramlarının adını koymak için: o sözlük bilgi tabanındaki kavram düğümlerindedir.

## Adımlar

1. Parçanın arayüzünü yaz: çağıranın bilmesi gereken her şey, tip imzasının ötesiyle birlikte.
2. Arayüzü gerçeklemeyle karşılaştır: arayüz gerçekleme kadar karmaşıksa parça sığdır. İşlev sayısı azaltılabilir mi,
   parametreler sadeleşebilir mi, daha çok karmaşıklık içeri gizlenebilir mi?
3. Silme testini uygula ve sonucunu tek cümleyle yaz: "silinirse X, Y ve Z'de tekrar eder" ya da "silinirse yalnız
   yer değiştirir".
4. Dikiş öneriyorsan iki yanındaki bağdaştırıcıları say. Bir tane varsa ve dikiş KU-008'den gelmiyorsa ekleme.
5. Testin nereden gireceğini söyle: arayüzden mi, yoksa arayüzün arkasından mı? Arkasından giriyorsa biçimi yeniden düşün.
6. Görev oturumundaysan kararı bitiş kaydının `kararlar` alanına bu terimlerle yaz: "X'i ayrı modül yapmadım; silme
   testi: yalnız yer değiştiriyordu".

## Yapma

- Sözlük terimlerinin yerine eş anlamlı kullanma; incelemede "servis" ile "modül" ayrı şeylermiş gibi okunur.
- Yalnız test edilebilsin diye saf bir işlev ayırma; hata çoğu zaman onun nasıl çağrıldığındadır ve yerellik kaybolur.
- Tek bağdaştırıcı için arayüz, fabrika ya da strateji kurma (KU-008'in zorunlu kıldıkları dışında).
- Derinlik uğruna istenmemiş davranış ekleme; derinlik var olan davranışı küçük arayüzün arkasına almaktır (KU-005).
- Çalışan kodu bu sözlükle "iyileştirmek" için görev dışına çıkma (KU-006); gördüğün sığ parçayı bulgu olarak yaz.

## İlgili skill'ler

- `mimari-tara`: bu sözlükle kodun tamamında sürtünme arar.
- `test-yaz`: "arayüz test yüzeyidir" ilkesinin uygulandığı yer; testin sınırını orada seçersin.
- `tasarla`: bir derinleştirme adayı geri alması pahalı bir karara dönüşüyorsa.

## Sınırlar

Bu bir sözlük ve yargı aracıdır; hiçbir şeyi ölçmez ve hiçbir kapıyı kırmızı yapmaz. Silme testi bir düşünce
deneyidir: sonucunu iki model farklı okuyabilir, bu yüzden gerekçe cümlesiyle yazılır ve incelemede sorgulanır.

Kaynak: mattpocock/skills `codebase-design` (SKILL.md ve DEEPENING.md, commit 6f7f783), MIT lisanslı; metin kopyalanmadı, fikir Türkçeye ve bu deponun kurallarına uyarlandı.
