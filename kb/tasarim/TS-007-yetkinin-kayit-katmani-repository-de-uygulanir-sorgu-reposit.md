---
kimlik: TS-007
tur: tasarim
durum: kabul
surum: 1
baslik: Yetkinin kayıt katmanı repository'de uygulanır: sorgu repository'de, süzgeç yetki yüzünden
agirlik: cift-yonlu
tarih: 2026-11-25
---
Yetkinin kayıt düzeyi (hangi satır, hangi kolon) repository'nin içinde uygulanır: Prisma sorgusunu repository yazar, süzgeci yetki yüzünden alır; denetleyicideki izin dekoratörü ve guard kaba kararı vermeye devam eder.

## Sorun
Kullanıcı (2026-11-25, kendi sözleri): "kanka bu repositoryleri bakıyorum da prisma kodu yok lan bunlarda" ve "bu kusur mevzusunu kapatmamız lazım controllerda ilk guard decorator sonrasında repositoryde instance katmanı demiştim sana bunları".

Ölçülenler (2026-11-25):
- Yönetim alt özelliklerinin 12 repository dosyası (6 okuma, 6 yazma) Prisma çağrısı taşımıyor; 33 çağrının hepsi ortak yetki kapısına kaynak adıyla gidiyor (`kapi.liste(istemci, 'Rol', …)`; liste 9, tek 6, olustur 5, guncelle 3, niyet 6, sil 4).
- Prisma sorguları iki ortak dosyada duruyor: `backend/src/shared/yetki/infrastructure/okuma-kapisi.ts` (293 satır) ve `yazma-kapisi.ts` (436 satır). Kapı modelin vekilini kaynak adından dizgeyle buluyor ve kayıtları genel bir tiple döndürüyor; Prisma'nın tablo tipleri repository'ye ulaşmıyor.
- Okuma dosyalarının adı `.prisma-repository.ts` ama içlerinde Prisma yok; yazma dosyaları `.kapi-repository.ts`.
- Kaba karar yerinde: her uç izin dekoratörü taşıyor (örnek: `rol.controller.ts` içinde altı uçta `@Izin(...)`) ve guard onu sınıyor.
- Kanon (`kb/_gelen/IRON_RULES_BACKEND.md` Kural 3.1, 3.5, 3.7; KU-012 taslağı): guard kaba kararı verir; ince karar repository'dedir: repository yetkiyi alır, satır süzgecini sorgunun koşuluna ve izinli kolonları seçime kendisi ekler; işleyici yetki kodu yazmaz.
- Sapmanın kaynağı ajan kararı AK-19'dur (TS-002): "feature repository'leri kaynak tablolara yalnız kapıdan erişir". Güvence (süzgecin unutulamaması) sağlandı; kanondaki biçim, okunabilirlik ve tipler kayboldu.

- Amaç: denetleyicide izin dekoratörü (kaba karar; var), repository'de kayıt katmanı ve Prisma sorgusu (ince karar; taşınacak).
- Kapsam dışı: yetkinin anlamı DEĞİŞMEZ (KR-008, KR-010: şartlar, yer tutucular, kolon indirgeme, şartlı yazma, iki hâl kuralı, değişiklik kaydı, erişim kaydı); uçların cevapları değişmez; çekirdek repository'ler (yetkiden bağımsız sistem işleri) zaten doğrudan Prisma yazar ve dokunulmaz.
- Başarının ölçüsü: kapıdan geçen 12 dosyanın her birinde Prisma vekili çağrısı vardır ve süzgeç o çağrının içinde görünür; var olan uçtan uca testler beklentileri değişmeden geçer; yapı denetimi yeni biçimi sınar.

## Kısıtlar
- Davranış değişmez: uçların adresleri, durum kodları, gövdeleri, iletileri, değişiklik kaydı notları ve erişim kaydı birikimi aynıdır.
- Yetki motorunun kuralları tek yerde kalır: kuralların seçimi (kaynak, eylem, bakılan kolonlar), satır süzgecinin kurulması (AK-52 dahil), kolon kümelerinin birleştirilmesi, şartlı kilit, iki hâl kuralı ve değişiklik kaydı notu repository'lere KOPYALANMAZ.
- İşleyici yetki kodu yazmaz (KU-012); yetki parametre değildir, istek bağlamındaki derlenmiş yetkiden alınır (bugünkü gibi).
- Domain katmanı Prisma'nın ürettiği tipleri içe aktarmaz.
- Geçiş boyunca her adımda depo yeşildir: taşınmamış alt özellikler eski yüzle çalışmaya devam eder.

## Yapı
### Okuma
Repository sorguyu kendisi yazar; o kaynağın okuma süzgecini yetki yüzünden alır. Hedef biçim (adlar kalıp görevinde kesinleşir):

```ts
async roller(siralama, sayfa) {
  const yetki = okuma.yetki('Rol', { bakilan: siralama.map((s) => s.alan) }); // kayıt katmanı
  const satirlar = await vt.rol.findMany({
    where: { AND: [{ silinmeZamani: null }, yetki.satirlar] }, // hangi satırlar
    orderBy: [...sirala(siralama), { id: 'asc' }],
    skip: sayfa.atla,
    take: sayfa.al,
    select: yetki.kolonlar, // hangi kolonlar
  });
  return yetki.kayitlar(satirlar, (where, select) => vt.rol.findMany({ where, select }));
}
```

- `yetki.satirlar`: okuma kurallarının koşullarından kurulan satır süzgeci (kanondaki `accessibleBy` karşılığı); kuralı olmayan kişide hiçbir satıra uymaz.
- `yetki.kolonlar`: kuralların ortak kolon kümesinin seçimi (kanondaki `buildSelect` karşılığı); kimlik her zaman seçilir.
- `yetki.kayitlar(...)`: kurallar farklı kolon kümeleri veriyorsa sayfadaki kimlikler için kural başına yeniden okur (deyimi repository verir), sonuçları kayıt kimliğinde birleştirir ve erişim kaydı birikimini yazar. Okuma bu çağrıyla biter; çağrılmadan dönen satır yetkiden geçmiş sayılmaz.
- `bakilan`: çağıranın süzdüğü ve sıraladığı kolonlar; o kolonu göremeyen kural okumaya katılmaz (bugünkü kural: süzme ve sıralama görünmeyen kolonu ele vermez).
- Kayıtlar, alt özelliğin domain'inde tanımlı bir görünüm tipiyle döner: kimlik zorunlu, öbür alanlar isteğe bağlıdır (kişinin göremediği kolon kayıtta yoktur).

### Yazma
Yazma deyimini repository yazar; sıra ve güvence motorda kalır. Hedef biçim:

```ts
adDegistir(islem, isAdi, id, ad) {
  return this.yazma.guncelle(islem, isAdi, 'Rol', id, { ad },
    (vt, where, veri) => vt.rol.updateMany({ where, data: veri })); // where: kimlik + yeteneğin şartı
}
```

- Motor adayları dener, satırı yeteneğin şartıyla kilitler, eski hâli okur, değişen alanları ve kolon sınırını denetler; yazma deyimini repository'nin işleviyle, kendi verdiği koşul ve veriyle koşturur; iki hâl kuralını ve değişiklik kaydı notunu kapatır.
- Oluşturma, silme ve niyet eylemleri aynı biçimdedir: deyim repository'de, koşul ve veri motordan.

### Adlar, denetim ve geçiş
- Dosyalar `<ad>-okuma.prisma-repository.ts` ve `<ad>-yazma.prisma-repository.ts` olur; `.kapi-repository.ts` adı kalkar.
- Yapı denetimi: adında `prisma-repository` geçen dosyada Prisma vekili çağrısı vardır; çekirdek olmayan feature repository'sindeki her okuma deyimi yetki süzgecini taşır (metin düzeyinde sınama); kaynak adıyla çalışan eski yüz feature'lardan çağrılmaz.
- Geçişte eski yüz (`liste`, `tek`, `olustur`, `guncelle`, `niyet`, `sil`) yeni yüzün üstünde ince bir sarmalayıcı olarak kalır (tek gerçekleme). Bütün alt özellikler taşınınca sarmalayıcı kaynak kodundan çıkar ve motoru sınayan testlerin yardımcısı olur; o testlerin beklentileri değişmez.

## Seçenekler
### 1. Kayıt katmanının yeri
- A (seçildi; kullanıcının yönü) — Repository'de: sorgu ve süzgeç repository'de görünür, tipler gelir, birleştirmeli sorgu yazılabilir; kanondaki biçim. Bedel: süzgeci sorguya eklemek artık yazanın işidir; unutulursa veri sızar. Karşılığı: yapı denetimi kuralı ve kısıtlı kullanıcı testleri.
- B — Ortak kapıda (bugünkü; AK-19): unutulamaz; ama repository boş bir aktarma katmanıdır, sorgu görünmez, tipler kaybolur.

### 2. Kolon indirgeme
- A (seçildi; kullanıcı teyidi, 2026-11-25: "Bugünkü gibi: kayıt başına") — Bugünkü anlam korunur: her kayıt yalnız onu gören kuralların kolonlarını taşır; birleştirme ortak işlevde kalır, yeniden okuma deyimini repository verir.
- B — Kanondaki gibi tür başına tek kolon listesi: tek sorgu, daha sade; ama bir kaydı gören kural başka kuralın kolonlarını da göstermiş olur (KR-010'un ikinci çürütme turu bunu reddetti).

### 3. Yazmada sıra
- A (seçildi; kullanıcı teyidi, 2026-11-25: "Motor sıralasın") — Motor sıralar, deyimi repository verir: adım unutulamaz. Kilit, eski hâl ve görünürlük sorguları motorun içinde, modelin vekili addan bulunarak yapılır; repository yalnız kaynağa yazan deyimi verir (kalıp görevinin incelemesi bu yorumu kullanıcıya bıraktı; kullanıcı kod örneğini görerek onayladı).
- B — Repository sıralar (kilitle, yaz, kapat): deyim daha doğal okunur; bir adımı unutmak yetkisiz yazmaya ya da kayıtsız değişikliğe yol açar.

### 4. Geçiş
- A (seçildi; kullanıcı teyidi, 2026-11-25: "Adım adım, sarmalayıcıyla") — Eski yüz ince sarmalayıcı olarak kalır, alt özellikler tek tek taşınır, sonunda sarmalayıcı koddan çıkar.
- B — Tek seferde: ara durum kalmaz; iş büyür ve kırılan testin nedeni zor bulunur.

### Öncelik (kapsam dışı; ayrı tasarım)
Kullanıcı kolon sorusunda önceliği sordu (2026-11-25: "adamda 2 yeri aynı yeteneği varsa kazanma durumu vardı priority mevzusu ne oldu"). Bugün kazanan yoktur: okumada yeteneklerin satırları birleşir, yazmada ilk oluşturulan yetenek kayda geçer; öncelik ve etki (girebilir / giremez) KR-008 Seçim 9 ile ertelenmişti. Kullanıcı "şimdi tasarlansın" dedi: ayrı bir tasarım kaydı yazılır ve kullanıcı onaylamadan kod başlamaz. Bu kaydın işi (kayıt katmanının yeri) öncelikten bağımsız ilerler.

## Aşamalar
1. Kalıp: yetki yüzünün yeni okuma ve yazma biçimi, rol alt özelliği ve yapı denetimi kuralları (eski yüz sarmalayıcı olarak durur).
2. Grup · 3. Kullanıcı · 4. Üyelik · 5. Yetenek · 6. Oturumun yönetim okuması ve yazması (her biri kalıba göre).
7. Eski yüzün kaynak kodundan çıkması, yapı denetiminin sıkılaşması, bilgi tabanının güncellenmesi (AK-19'un yerini bu kayıt alır).

## Doğrulama
- Her adımda etkilenen uçtan uca testler beklentileri değişmeden geçer (dosyalar yoluyla); motoru sınayan testler (`test/yetki-kapisi-okuma.e2e-spec.ts`, `test/yetki-kapisi-yazma.e2e-spec.ts`, `test/kimlik-yetki.e2e-spec.ts`, `test/erisim-kaydi.e2e-spec.ts`) her adımda geçer.
- Yapı denetimi her adımdan sonra koşar; son adımda eski biçimli dosya kalmaz.
- Son adımdan sonra gerçek tarayıcıda kısıtlı kullanıcı denemesi yinelenir (yalnız kendi grubu, yalnız ad kolonu).

## Çürütme
Bağımsız çürütme turu koşmadı: yön kullanıcınındır, davranış değişmez ve iş geri alınabilir (çift yönlü). Kalıp görevinin bağımsız incelemesi ile değişmeyen uçtan uca testler bu işi görür. Bilinen risk Seçenek 1-A'nın bedelidir.
