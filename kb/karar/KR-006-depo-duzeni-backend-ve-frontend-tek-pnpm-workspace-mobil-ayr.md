---
kimlik: KR-006
tur: karar
durum: taslak
surum: 1
baslik: Depo düzeni: backend ve frontend tek pnpm workspace, mobil ayrı kök
agirlik: cift-yonlu
tip: mimari
tarih: 2026-11-21
baglam: TS-001
---
Depo düzeni için backend ve frontend tek pnpm workspace'te, mobil ayrı pnpm kökünde tutulur (klasör adları BADI ile aynı: `backend/`, `frontend/`, `mobile/`); backend ve frontend'in paket sınırı ile ortak lint ve derleyici ayarı kazanılıyor, mobil için ayrı kurulum ve ayrı kilit dosyası bedeli kabul ediliyor.

## Bağlam
- Üç yüzey vardır: backend (NestJS), frontend (Next.js), mobil (Expo) (KR-004, taslak).
- BADI'de üç proje ayrı pnpm köküdür; her birinin kendi `pnpm-workspace.yaml` ve kilit dosyası vardır (ölçüldü, 2026-11-21).
- BADI mobilinde `nodeLinker: hoisted` zorunlu çıkmış: izole kurulumda Metro bir geçişli modülü çözemeyip paketlemeyi durdurmuş (BADI `mobile/pnpm-workspace.yaml` içindeki 11.09.2026 notu; okundu 2026-11-21).
- Expo belgesi (docs.expo.dev/guides/monorepos, okundu 2026-11-21): izole bağımlılık SDK 54'ten beri desteklenir ama her paket çalışmaz; sorun çıkarsa deponun kökündeki `pnpm-workspace.yaml` içinde `nodeLinker: hoisted` yapılır; monorepo'da tek React sürümü önerilir.
- BADI'de frontend React `^19.3.0`, mobil React `19.1.0` (tam sürüm) kullanır (ölçüldü, 2026-11-21).
- Kullanıcının kanonu yüzeyler arasında ortak çalışma zamanı kodu istemez (VAL-02); workspace'in kazancı ortak lint ve derleyici ayarı ile tek kurulumdur.
- Kullanıcının ilk eğilimi üç yüzeyin tek workspace'te olmasıydı; sorun gösterildikten sonra 2026-11-21'de bu düzeni seçti.

## Seçenekler
### A — Backend ve frontend tek workspace, mobil ayrı kök
- Bağlayıcı ayarı (`nodeLinker`) kökte verildiği için mobilin düz kurulum ihtiyacı backend ve frontend'e taşınmaz; ikisi izole kurulumda kalır ve bildirilmemiş bağımlılığı içe aktaramaz.
- Ortak lint ve derleyici ayarı iki yüzey için tek yerde durur.
- Mobil kendi React sürümünü ve kendi kilit dosyasını taşır.
### B — Üç ayrı kök (BADI'nin aynısı)
- BADI ile tam simetri; komutlar ve kurulum BADI'deki gibidir.
- Ortak lint ve derleyici ayarı üç yerde tekrar eder; elle eşlenir.
### C — Üç yüzey tek workspace
- Tek kurulum, tek kilit dosyası.
- Mobil düz kurulum isterse ayar kökte verilir; backend ve frontend de düz kuruluma geçer ve paket sınırı zayıflar.
- Tek düz ağaçta iki React sürümü çakışma riskidir; tek sürüme zorlamak web'in React yükseltmesini mobilin React Native sürümüne bağlar.

## Seçim
A (kullanıcı, 2026-11-21).
- Neden: C'deki sınır gevşemesi ve React sürümü çakışması; B'ye göre ortak ayar tek yerde durur.
- Vazgeçilen: BADI ile tam simetri (B) ve tek kurulum (C).

## Sonuçlar
- Olumlu: backend ve frontend arasında paket düzeyinde sınır; ortak ayar tek yerde.
- Olumlu (ajan çıkarımı): mobil gerekmeyen bir projede `mobile/` klasörü workspace'e dokunmadan çıkarılır.
- Olumsuz: iki kurulum ve iki kilit dosyası; mobil workspace paketlerini `workspace:` ile kullanamaz; backend ve frontend tek kilit dosyasını paylaşır, BADI'nin proje başına kurulum düzeni buraya aynen taşınmaz.
- Yükümlülük: kural doğurmaz; klasör haritası yapı düğümleriyle verilir.
- Ortak parça: kökte backend ve frontend'in paylaştığı lint ve derleyici taban ayarı; mobil ayarı elle eşlenir.

## Varsayımlar
- Bu düzen bu depoda denenmedi; varsayım, 2026-12-21'e kadar yürüyen iskelette kurulum, derleme ve lint ile denenecek.
- Kendi `pnpm-workspace.yaml` dosyası olan `mobile/`, üst klasördeki workspace'ten bağımsız kök olarak davranır; varsayım, 2026-12-21'e kadar aynı denemede doğrulanacak.
- Yüzeylerin iç klasör düzeni bu kararın kapsamında değildir; backend için KR-005'teki varsayım geçerlidir (`backend/src/features`, `backend/src/shared`).

## Geri dönüş
Bedel: workspace dosyasının değişmesi ve kilit dosyalarının yeniden üretilmesi; kural kapsam yolları değişmez (klasör adları aynı kalır).
Yeniden bakma tetiği: Expo'nun izole kurulumunun bu depoda sorunsuz çalıştığı gösterilirse ya da yüzeyler arasında ortak paket ihtiyacı karara bağlanırsa.

## İstisna yolu
- Bir projede mobil yoksa `mobile/` klasörü açılmaz; karar o projede backend ve frontend için aynen uygulanır.
- Mobilin workspace'e alınması bu kararı ezen yeni bir kararla yapılır.
