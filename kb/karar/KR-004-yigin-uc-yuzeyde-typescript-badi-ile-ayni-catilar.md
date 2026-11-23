---
kimlik: KR-004
tur: karar
durum: taslak
surum: 1
baslik: Yığın: üç yüzeyde TypeScript, BADI ile aynı çatılar
agirlik: tek-yonlu
tip: mimari
tarih: 2026-11-21
baglam: TS-001
---
Birçok projede kullanılacak base için üç yüzeyde TypeScript ve BADI ile aynı çatılar (NestJS + Prisma, Next.js, Expo) seçildi; tek dil, tek araç zinciri ve BADI ile iki yönlü bilgi aktarımı kazanılıyor, .NET'in performans payından ve backend'de derleyicinin zorladığı sınırdan vazgeçiliyor.

> Öğretici mod notu: bu taslak kullanıcının 2026-11-21 oturumundaki sözlerinden derlendi. "EKSİK" yazan yerler kullanıcının henüz söylemediği, "öneri (ajan)" yazan yerler ajanın önerip kullanıcının henüz onaylamadığı kısımlardır.

## Bağlam
- Base birçok projede kullanılacak; üç yüzeyi var (backend, web, mobil); feature tabanlı ve sınırları net olacak (TS-001).
- Depo aynı zamanda bilgi tabanı iskeletini denemek için kum havuzudur; zaman baskısı yoktur, adım adım ilerlenecektir (kullanıcı beyanı).
- BADI'nin mimarisi ve tasarım desenleri referans alınır (modular monolith, dikey dilim mimarisi); özellikleri burada yeniden yazılmayabilir. Yan amaç BADI'nin eksiğini net görmek ve yaklaşan bakım dönemine girdi üretmektir (kullanıcı beyanı). Desen ancak aynı çatılarla yan yana okunabilir.
- Kodu ajan yazar, kullanıcı inceler (kullanıcı beyanı).
- Kullanıcı TypeScript kodunda akışı izleyebiliyor, sözdizimine tam hâkim değil; C# yazabiliyor (kullanıcı beyanı).
- Web arayüzü her seçenekte TypeScript'tir; karar asıl olarak backend dilini ve çatı ailesini belirler.
- BADI'nin yığını ölçüldü: NestJS + Prisma, Next.js + React, Expo + React Native; üç ayrı pnpm projesi, paylaşılan paket yok (TS-001, "BADI'nin yığını").

## Ölçütler
Kullanıcının konuşmada öne çıkardığı ölçütler, söylenme sırasıyla. EKSİK: her ölçütün sayılı hedefi kullanıcıdan alınmadı.
Önem sırası (ajan çıkarımı; iki kez soruldu, kullanıcı teyit etmedi): BADI ile simetri, net sınırlar, incelenebilirlik, öğrenme, performans.
- İncelenebilirlik: kullanıcı yazılan kodu okuyup akışı izleyebilmeli. Hedef ve ölçüm: EKSİK.
- BADI ile simetri: aynı çatılar, bilgi iki yönde taşınmalı. Hedef ve ölçüm: EKSİK.
- Öğrenme: kullanıcı TypeScript'e daha hâkim olmak istiyor. Hedef ve ölçüm: EKSİK.
- Performans: kullanıcı "benim için önemli" dedi. Hedef yük ve gecikme: EKSİK.
- Net sınırlar: feature'lar arası yasak bağımlılık kurulamamalı. Hedef ve ölçüm: EKSİK.

## Seçenekler
Ayrıntı ve kaynaklar TS-001 "Seçenekler" bölümündedir.
### A — TypeScript her yerde, BADI ile aynı çatılar
İncelenebilirlik: kullanıcı akışı izleyebiliyor. Simetri: tam. Öğrenme: kullanıcının istediği dil. Performans: üç seçeneğin en düşüğü; BADI ölçeğinde yeterli sayılıyor (varsayım). Sınır: paket ve lint düzeyinde araçla zorlanır.
### B — Backend Rust
İncelenebilirlik: kullanıcının Rust okuma düzeyi bilinmiyor. Simetri: yok. Performans: bellek ve kuyruk gecikmesinde en iyi (dış kaynak, zayıf). Sınır: derleyici zorlar. Derleme süresi en uzun; Rust bu makinede kurulu değil.
### C — Backend .NET (C#)
İncelenebilirlik: kullanıcının en iyi bildiği dil. Simetri: yok. Performans: veritabanlı testte en üst sıra (dış kaynak, zayıf). Sınır: backend'de derleyici zorlar, web ve mobilde yine araç gerekir. İki araç zinciri ve kod üretimiyle sözleşme paylaşımı ister.

## Seçim
A seçildi (kullanıcı, 2026-11-21).
- Neden: amaç BADI'nin simetriği bir yapı; kullanıcı TypeScript'te akışı izleyebiliyor ve bu dilde ilerlemek istiyor; tek dil ve tek araç zinciri daha az parça demek.
- Kapsam: çatılar BADI ile aynı kalır, BADI'de eksik olanlar giderilir (tek workspace, ortak sözleşme paketi, daha sıkı sınırlar). Bu giderimlerin her biri ayrı karardır; bu karar yalnız dili ve çatı ailesini sabitler.
- Vazgeçilen: C'nin performans payı ve backend'de derleyici sınırı; B'nin bellek kullanımı ve tip sıkılığı.
- Sürümler (kullanıcı, 2026-11-24): çatı ailesi BADI ile aynıdır, ama ana sürümler en yeni kararlı sürümlerdir — NestJS 12, Prisma 7 (8 kararlı olana kadar) ve Next.js, Expo ile BullMQ'nun güncel kararlı sürümleri. Ajanın önerisi BADI ile aynı ana sürümlerdi (NestJS 11); kullanıcı en yeni kararlı sürümleri seçti. Reddedilen: aday sürümler dahil en yeniler (Prisma 8'de veritabanı işlemi arayüzü değişir ve KR-011 ona yaslanır). Kabul edilen bedel: BADI'deki desenlerin bir kısmı NestJS 12'de uymayabilir; değişiklik listesi okunmadı. Kesin sürüm numaraları iskelet kurulurken ölçülecek (eldeki ölçüm 2026-11-21 tarihlidir: NestJS 12.6, Prisma 7.10.1 kararlı ve 8.0 aday).

## Sonuçlar
- Olumlu: üç yüzey tek dil ve tek araç zinciriyle yürür; BADI'de öğrenilen buraya, burada denenen BADI'ye taşınır.
- Olumsuz: performans payı en düşük seçenek; feature sınırını derleyici değil araç zorlar; akış düzeyinde inceleme tip düzeyindeki hatayı kaçırabilir.
- Yükümlülük: öneri (ajan), kullanıcı onayı bekliyor; onaylanınca kural taslağı açılır.
  - Backend, web ve mobil kodu TypeScript ile yazılır.
  - Derleyici ve lint en sıkı ayarda tutulur ve commit kapısı olarak koşar (inceleme açığının karşılığı).
- Ortak parça: henüz yok.

## Doğrulama
EKSİK: denetim kimliği ya da ölçüm tarihi yok.
Öneri (ajan): yürüyen iskelet (tek feature, üç yüzeyde uçtan uca) kurulup ölçülür. Birim: yüzey; her yüzeyde derleme, tip denetimi ve lint kapısının yeşil koşması ve performans hedefinin ölçülmesi.

## Varsayımlar
Tarihler yeniden bakma tarihidir; öneri (ajan), kullanıcı değiştirebilir.
- Hedef yük BADI'nin bugünkü ölçeğini aşmaz; varsayım, 2026-12-21'e kadar kullanıcıdan sayı alınacak.
- Node bu ölçekte yeterlidir (dayanak: BADI aynı yığınla canlıda çalışıyor; gecikme ölçülmedi); varsayım, 2026-12-21'e kadar yürüyen iskelette ölçülecek.
- Kullanıcı ajanın yazdığı TypeScript kodunu akış düzeyinde inceleyebilir; varsayım (kullanıcı beyanı), 2026-12-21'e kadar ilk incelemelerde sınanacak.
- BADI'nin çatıları ve sürümleri: ölçüldü (2026-11-21, package.json).
- NestJS 12, BADI'de NestJS 11 ile kullanılan desenleri (guard, dekoratör, komut ve sorgu ayrımı, BullMQ sarmalayıcısı) taşır; değişiklik listesi okunmadı; varsayım, 2026-12-21'e kadar iskelet kurulurken sınanacak.
- Bu makinede .NET SDK kurulu, Rust kurulu değil: ölçüldü (2026-11-21).

## Geri dönüş
Öneri (ajan), kullanıcı onayı bekliyor.
- Bedel: kod yazılmadan önce geri dönüş bedelsizdir; yürüyen iskeletten sonra bedel, yazılmış backend kodunun yeniden yazılmasıdır ve her yeni feature ile büyür.
- Yeniden bakma tetiği: yürüyen iskelet ölçümünde performans hedefi tutmazsa, ya da kullanıcı incelemede akışı izleyemediğini görürse.

## İstisna yolu
EKSİK: kullanıcı konuşmadı.
Öneri (ajan): TypeScript'in yetmediği dar bir iş çıkarsa (ör. ağır işlemci işi), o iş için ayrı karar yazılır; bu karar ezilmeden başka dilde kod eklenmez.
