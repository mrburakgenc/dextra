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
denetim_duzey: mekanik
denetim_ref: [DN-002]
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: Her feature kendi klasorunde **4-Layer Clean Architecture VSA + Pragmatic CQRS** disiplini uygular.
---
Her feature kendi içinde Clean Architecture'dır; katmanları domain, application, infrastructure ve presentation'dır (`interface` adı kullanılmaz). Bağımlılık içe doğru akar: presentation application'ı, application domain'i kullanır; infrastructure domain'deki arayüzleri gerçekler; domain dış katmanı içe aktarmaz.

## Neden
- Kullanıcı (2026-11-21): her feature kendi içinde bir Clean Architecture olacak; "interface" katman adı değildir, başka bir şeydir.
- Ad için kanondaki gerekçe (`ARCHITECTURE.md` satır 137): `interface` TypeScript anahtar sözcüğüdür ve repository arayüzleriyle karışır.
- Kullanıcı (2026-11-23; KR-005): kuralı olmayan basit alt özellik de dört katmanı taşır; DDD tam sağlanmalı ve kurallar tam geçmelidir.

## İhlal örneği
Kanondan (`IRON_RULES_BACKEND.md` satır 1172–1174): `domain/user.entity.ts` içinde `import { PrismaClient } from '@prisma/client'`. Bu depoda karşılığı: `backend/src/features/kimlik/rol/domain/` altındaki bir dosyanın `@nestjs/common` ya da Prisma'nın ürettiği tipleri içe aktarması.

## Uygun örnek
`backend/src/features/kimlik/rol/domain/repositories/i-rol.repository.ts` arayüzü tanımlar; `backend/src/features/kimlik/rol/infrastructure/repositories/rol-okuma.prisma-repository.ts` onu gerçekler; işleyici (`application/queries/rol-listele/rol-listele.handler.ts`) yalnız arayüzü tanır.

## Bu depodaki denetim
Yapı denetimi (DN-002; `backend/src/shared/yapi/infrastructure/yapi-denetimi.ts`) her alt özelliğin katman klasörlerini, iş klasörlerini ve katmanlar arası yasak içe aktarmaları sınar; lint sınırı aynı yönü ayrıca sınar. Alt özelliklerin klasör düzeninin ayrıntısı TS-005'tedir.

## Alım notu
- Kaynak: `IRON_RULES_BACKEND.md` satır 1076–1184 ve `ARCHITECTURE.md` satır 95–139.
- Denetim ortak kodu ve feature içi ortak klasörü de sınar; kuralın kapsam yolu yalnız feature'lardır.

## Açık uçlar
- AU-1: Bağımlılık yönünün gerekçesi kanon belgesinde yazmıyor; kuralın "Neden" bölümüne kullanıcının gerekçesi yazılacak.
- AU-2: Uygulama katmanı bugün ortak kodun altyapı klasöründen iki somut sınıfı alıyor (Unit of Work, outbox yazıcısı; 2026-11-25 raporu 8.3). Kanon bunlar için uygulama katmanında arayüz ister; ayrı iş olarak yapılacak mı?
