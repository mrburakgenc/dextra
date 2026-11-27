---
kimlik: DN-002
tur: denetim
durum: kabul
surum: 1
baslik: Yapı denetimi: alt özellikler ve ortak kod kanondaki katman düzenindedir
cesit: komut
komut: node backend/node_modules/vitest/vitest.mjs run --root backend src/shared/yapi/infrastructure/yapi-denetimi.spec.ts
---
Backend'in alt özelliklerinde ve ortak kodunda kanondaki katman düzeninden (TS-005) sapan dosyayı ve yasak içe aktarmayı yakalar.

## Nasıl koşar
Baş bloktaki komut deponun kökünde koşar; `pnpm` gerektirmez (yalnız `node` ve kurulu bağımlılıklar). Elle: `python3 harness/h.py denetim kos DN-002`. Denetimin kendisi `backend/src/shared/yapi/infrastructure/yapi-denetimi.ts` dosyasıdır; `backend/src/features/*/` altındaki her alt özelliği, `features/kimlik/_shared` klasörünü ve `backend/src/shared` altındaki her konuyu sınar ve sınadıklarını adlarıyla yazar. Push kapısında koşması için bu düğümün ve KU-008'in kabul edilmiş olması gerekir (taslak denetim kapıda koşmaz).

## Ek maddeler (2026-11-27; GV-172)
Aynı spec dört maddeyi daha sınar; komut değişmedi. q: `app.module.ts` içindeki guard bağlamalarının sırası ve `features` altında guard bağlaması (KU-010). r: `features` altındaki her ucun üç yetki işaretinden tam birini taşıması (KU-011). s: `features/**/application/**` ve `presentation/**` altında isteği yapanı gösteren ad (`requesterId`, `isteyenId`; KU-013). t: `features` altında guard, hata süzgeci ya da genel süzgeç, interceptor, pipe bağlaması (KU-009'un bir bölümü). Ölçüm (2026-11-27, bu depo): 110 test, 38 uç, ihlal 0, 0,5 saniye.

## Kırmızı örnek
`backend/src/features/kimlik/rol/application/rol-olustur.handler.ts` (işleyici kendi `commands/<iş>/` klasöründe değil) ya da `domain/` altındaki bir dosyanın `@nestjs/common` içe aktarması: denetim dosyayı ve çiğnenen maddeyi adıyla bildirir, komut 1 ile çıkar.

## Yeşil örnek
`backend/src/features/kimlik/rol/application/commands/rol-olustur/rol-olustur.handler.ts`, yanında `rol-olustur.command.ts` ve `rol-olustur.result.ts`; arayüz `domain/repositories/i-rol.repository.ts` içinde: denetim geçer (2026-11-25 ölçümü: 7 alt özellik, 12 konu, 45 test, ihlal 0).
