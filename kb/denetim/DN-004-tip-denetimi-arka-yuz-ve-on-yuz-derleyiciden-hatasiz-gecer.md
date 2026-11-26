---
kimlik: DN-004
tur: denetim
durum: kabul
surum: 1
baslik: Tip denetimi: arka yüz ve ön yüz derleyiciden hatasız geçer
cesit: komut
komut: node backend/node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json && cd frontend && NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next typegen && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
---
Arka yüzde ya da ön yüzde derleyicinin (TypeScript) tip hatası verdiği değişikliği yakalar.

## Nasıl koşar
Baş bloktaki komut deponun kökünde kabukla koşar; `pnpm` gerektirmez (TS-009 AK-10). İki projenin `typecheck` betiğinin yaptığının aynısıdır; ön yüzde önce yol tipleri üretilir (`next typegen`). Elle: `python3 harness/h.py denetim kos DN-004`. Yeni açılmış çalışma ağacında iki önkoşul vardır, yoksa komut kalır: bağımlılıklar kurulu olmalı (`pnpm install --offline --frozen-lockfile`) ve arka yüzün veritabanı istemcisi üretilmiş olmalı (`pnpm -C backend prisma:generate`; veritabanına bağlanmaz). Push kapısında koşması için bu düğümün ve KU-021'in kabul edilmiş olması gerekir.

Ölçüm (2026-11-26, bu depo, önkoşullar sağlanmış): arka yüz 2,5 saniye, ön yüz 2,9 saniye; ikisi de çıkış kodu 0. Kullanıcının sınırı 60 saniyedir (TS-009 AU-4).

## Kırmızı örnek
Bir işlevin imzası değişir ama çağıran dosya eski bağımsız değişkenle kalır: derleyici dosyayı, satırı ve hata kodunu yazar, komut sıfırdan farklı kodla çıkar.

## Yeşil örnek
Bugünkü ana dal: iki projede de tip hatası yok, komut 0 ile çıkar (yukarıdaki ölçüm).
