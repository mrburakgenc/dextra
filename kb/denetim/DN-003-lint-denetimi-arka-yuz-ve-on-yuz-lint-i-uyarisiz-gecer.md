---
kimlik: DN-003
tur: denetim
durum: kabul
surum: 1
baslik: Lint denetimi: arka yüz ve ön yüz lint'i uyarısız geçer
cesit: komut
komut: cd backend && node node_modules/eslint/bin/eslint.js . --max-warnings=0 && cd ../frontend && node node_modules/eslint/bin/eslint.js . --max-warnings=0
---
Arka yüzde ve ön yüzde lint'in tek bir uyarı ya da hata bıraktığı değişikliği yakalar; feature'lar ve katmanlar arası içe aktarma sınırları da bu lint'in içindedir.

## Nasıl koşar
Baş bloktaki komut deponun kökünde kabukla koşar; `pnpm` gerektirmez (yalnız `node` ve kurulu bağımlılıklar; TS-009 AK-10). İki projenin `lint` betiğinin yaptığının aynısıdır (`eslint . --max-warnings=0`). Elle: `python3 harness/h.py denetim kos DN-003`. Bağımlılıklar kurulu değilse (yeni açılmış çalışma ağacı) komut `node_modules` bulunamadığı için kalır: önce `pnpm install --offline --frozen-lockfile`. Push kapısında koşması için bu düğümün ve KU-021'in kabul edilmiş olması gerekir (taslak denetim kapıda koşmaz).

Ölçüm (2026-11-26, bu depo, bağımlılıklar kurulu): arka yüz 7,2 saniye, ön yüz 4,6 saniye; ikisi de çıkış kodu 0. Kullanıcının sınırı 60 saniyedir (TS-009 AU-4).

## Kırmızı örnek
`backend/src/features/kimlik/rol/` altındaki bir dosyanın `features/kimlik/kullanici/` altından doğrudan içe aktarma yapması ya da kullanılmayan bir değişken: lint dosyayı ve kuralın adını yazar, komut sıfırdan farklı kodla çıkar.

## Yeşil örnek
Bugünkü ana dal: iki projede de uyarı ve hata yok, komut 0 ile çıkar (yukarıdaki ölçüm).
