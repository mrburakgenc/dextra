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
denetim_duzey: mekanik
denetim_ref: [DN-002]
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: AbilityFactory **sadece Repository'de** inject edilir.
---
İnce yetki repository'de çözülür: repository sorgusunu kendisi yazar, satır süzgecini ve kolon seçimini yetki yüzünden alıp sorguda uygular ve okumayı yetki yüzünün birleştirme çağrısıyla kapatır; yazmada deyimi repository verir, sırayı yetki motoru yürütür. Yetki parametre değildir, istek bağlamındaki derlenmiş yetkiden alınır. İşleyici yetki kodu yazmaz.

## Neden
- Kanon (`IRON_RULES_BACKEND.md` satır 180, 327): yetki disiplini guard ve repository ikilisinde toplanır; yetki işleyicide çözülürse repository yetkiyi bilmez hâle gelir.
- Kullanıcı (2026-11-25): "controllerda ilk guard decorator sonrasında repositoryde instance katmanı". Aynı gün ölçülen sapma (repository'lerin sorgu yazmayıp ortak kapıya kaynak adıyla gitmesi) TS-007 ile geri alındı.

## İhlal örneği
- İşleyicinin yetki süzgecini kendisi kurması ya da derlenmiş yetkiye bakarak karar vermesi.
- Repository'nin süzgeçsiz okuması: `istemci.rol.findMany({ where: { silinmeZamani: null } })`.
- Süzgeçle okuyup birleştirme çağrısını yapmadan dönmesi (kolon indirgeme ve erişim kaydı atlanır).

## Uygun örnek
`backend/src/features/kimlik/rol/infrastructure/repositories/rol-okuma.prisma-repository.ts`: `where` içinde `yetki.satirlar`, `select` içinde `yetki.kolonlar`, sonunda `yetki.kayitlar(...)`. Yazma: `rol-yazma.prisma-repository.ts` deyimi verir, `deyimleGuncelle` sırayı yürütür. İşleyici yalnız repository'yi çağırır.

## Bu depodaki denetim
Yapı denetimi (DN-002) çekirdek olmayan feature repository'lerinde her okuma deyiminin süzgeci taşıdığını ve birleştirme çağrısıyla kapandığını sınar. Yetkiden bağımsız sistem işleri (giriş, oturum doğrulama, yetki verisinin derlenmesi) çekirdek repository'lerdedir ve bu kuralın dışındadır (KR-010 Seçim 48: liste kapalıdır).

## Alım notu
- Kaynak: Kural 3.1, 3.5 ve 3.7 / CASL-05, CASL-07 (`IRON_RULES_BACKEND.md` satır 182–212, 257–343); Pattern 20 (`PATTERNS.md`).
- Kanondan farklar ve gerekçeleri TS-007'dedir (kabul, 2026-11-25): kanondaki `AbilityFactory` ve kullanıcı kimliği parametresi yerine istek bağlamı; kanondaki tür başına tek kolon listesi yerine kayıt başına kolonlar (kullanıcı teyidi); kanondaki bellekte kayıt denetimi (`throwUnlessCan`) yerine şartlı yazma (KR-008, KR-010).
- Geçiş: 2026-11-25 itibarıyla rol yeni biçimdedir; grup, kullanıcı, üyelik, yetenek ve oturumun yönetim repository'leri eski kapı yüzünün sarmalayıcısıyla çalışır ve sırayla taşınır (EP-010).

## Açık uçlar
- AU-1: Kişinin kendi kurallarını döndüren uç (`GET kimlik/oturum/yetkilerim`) derlenmiş yetkiyi denetleyicide istek bağlamından okuyup döndürür. Bu, "işleyici yetki kodu yazmaz" kuralının adıyla istisnası mıdır (kanonun kaynağındaki benzer iki istisna gibi), yoksa kuralın kapsamı dışında mı sayılır?
- AU-2: Kanondaki desenin beşinci adımı kişisel alanın maskelenmesidir (satır 264); alınmadı (TS-001 Ç6). Kullanıcı aksini söyleyene kadar maskeleme yoktur.
