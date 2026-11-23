---
kimlik: KU-008
tur: kural
durum: taslak
surum: 1
baslik: Her feature kendi içinde Clean Architecture'dır; bağımlılık içe doğru akar
dayanak: [KR-005@1]
kapsam: [backend/src/features/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: Her feature kendi klasorunde **4-Layer Clean Architecture VSA + Pragmatic CQRS** disiplini uygular.
---
Her feature kendi içinde Clean Architecture'dır; katmanları domain, application, infrastructure ve presentation'dır (`interface` adı kullanılmaz). Bağımlılık içe doğru akar: presentation application'ı, application domain'i kullanır; infrastructure domain'deki arayüzleri gerçekler; domain dış katmanı ve çatı kodunu (NestJS, Prisma) içe aktarmaz.

## Neden
- Kullanıcı (2026-11-21): her feature kendi içinde bir Clean Architecture olacak; "interface" katman adı değildir, başka bir şeydir.
- Ad için belgedeki gerekçe (`ARCHITECTURE.md` satır 137): `interface` TypeScript anahtar sözcüğüdür ve repository arayüzleriyle karışır.
- Bağımlılık yönünün gerekçesi belgede yazmıyor; kullanıcıya sorulacak.

## İhlal örneği
Belgeden (`IRON_RULES_BACKEND.md` satır 1172–1174): `domain/user.entity.ts` içinde `import { PrismaClient } from '@prisma/client'`.

## Uygun örnek
Belgeden (`IRON_RULES_BACKEND.md` satır 1176–1184): domain `IUserRepository` arayüzünü tanımlar, infrastructure'daki `PrismaUserRepository` onu gerçekler.

## Alım notu
- Kaynaklar: Kural 12.1 ve 12.2 / MOD-02 (`IRON_RULES_BACKEND.md` satır 1076, 1087, 1167–1185), Mimari Değişmez 2 (`ARCHITECTURE.md` satır 846–855), Pattern 24 (`PATTERNS.md`).
- Katman adı için kaynak cümle (`IRON_RULES_BACKEND.md` satır 1087): "`interface/` adi YASAK — `presentation/` ZORUNLU."
- Kaynakta bayat kalan yerler (ham kaynak düzenlenmez; kullanıcının eklenti deposunda düzeltilmesi gerekir): `ARCHITECTURE.md` satır 849 katmanı "Interface" diye anar; satır 146–156'daki çizim "Interface Layer" yazar ve "Üst -> Alt" yönüyle domain'i infrastructure'ın üstüne koyar, bu da domain → infrastructure diye okunur ve MOD-02 ile çelişir.
- Shared concern'leri için belge aynı disiplini ister ("mini-Clean Architecture", `ARCHITECTURE.md` satır 892 ve 1063); kapsamı shared'e genişletmek kullanıcı kararıdır.
- Kapsam yolu varsayımdır; hedef denetim düzeyi mekaniktir.
