---
kimlik: KU-013
tur: kural
durum: taslak
surum: 1
baslik: requesterId istek gövdesinden okunmaz
dayanak: [KR-007@1]
kapsam: [backend/src/features/**/application/**, backend/src/shared/cqrs/**]
baglama: kapsam
bicim: kural
kesinlik: olagan
denetim_duzey: gozden-gecirme
bakis: 2026-12-21
kaynak: kb/_gelen/IRON_RULES_BACKEND.md
alinti: `requesterId` body'den ASLA okunmaz, `@IsEmpty()` ile reddedilir
---
`requesterId` istek gövdesinden okunmaz: komut ve sorgu sınıfları `BaseCommand` ya da `BaseQuery`'den türer, alan gövdede gelirse doğrulama reddeder ve değeri global `CommandRequesterInterceptor` yazar.

## Neden
Belgedeki gerekçe (satır 1143): alan gövdeden okunursa saldırgan kendi seçtiği kimliği gönderebilir. Taban sınıftan türemeyen komutu interceptor yakalayamaz (satır 1156).

## İhlal örneği
Belgeden: komutta `@IsString() requesterId: string` (satır 1140–1144); taban sınıf yerine `implements ICommand` (satır 1154–1157).

## Uygun örnek
Belgeden: `extends BaseCommand` ve alanda `@IsEmpty(...)` (satır 1132–1138); interceptor kök modülde global bağlanır (satır 1162).

## Alım notu
- Kaynak: Kural 5.5 / SEC-10, SEC-11 (satır 1127–1165).
- Interceptor'ın yeri belgede `shared/cqrs/infrastructure/command-requester.interceptor.ts`'tir (satır 1165).
- Açık (kuralın ikinci yarısı): BADI tuzak kaydı T-0394'e göre interceptor'ın komuta ulaşması orada güvenilmez bulunmuş, pratikte kimlik controller'da açıkça alınıp komuta yazılıyor. NestJS belgesi (request lifecycle, okundu 2026-11-21) interceptor'ın pipe'tan önce çalıştığını söyler. Değerin nasıl yazılacağı (interceptor mı, controller'da açık atama mı) kullanıcı kararıdır; bu depoda ölçülmedi.
- Kapsam yolu varsayımdır; hedef denetim düzeyi mekaniktir.
