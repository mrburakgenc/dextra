---
kimlik: KR-001
tur: karar
durum: kabul
surum: 1
baslik: Kurallar ve kararlar bu depoda zincir olarak tutulur
agirlik: cift-yonlu
tip: surec
tarih: 2026-11-20
---
Proje kuralları için koda bağlı ve denetlenen bir zincir seçildi; kuralın uygulanıp uygulanmadığı görünür oluyor, her karar ve kural için yazma yükü kabul ediliyor.

## Bağlam
Yalnız belgede duran bir kuralın koda ne kadar uygulandığı bilinmez; kayıp ancak ölçülünce görülür ve o zamana kadar büyür.

## Seçenekler
### A — Koda bağlı zincir ve kapılar
Karar, kural, kapsam ve denetim birbirine bağlanır; kopan halka commit ve push'ta yakalanır.
### B — Serbest metin kural dosyaları
Yazması kolaydır; neyin uygulandığı ölçülemez ve dosyalar zamanla birbiriyle çelişir.

## Sonuçlar
- Olumlu: bir dosyaya hangi kuralın uygulandığı ve bir kuralın hangi karardan geldiği hesaplanır.
- Olumsuz: her kural dayanak, kapsam ve denetim düzeyi ister.
- Yükümlülük: kabulü yalnız kullanıcı verir (KU-001); kapılar atlanmaz (KU-002).
- Ortak parça: `harness/h.py`.

## İstisna yolu
Kapı yanlış alarm veriyorsa atlanmaz; kural ya da denetim düzeltilir. Acil durumda kapıyı yalnız kullanıcı, kendi terminalinde ve bilerek atlar; nedenini yazılı bırakır.
