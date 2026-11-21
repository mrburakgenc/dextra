---
kimlik: KR-002
tur: karar
durum: taslak
surum: 1
baslik: Her iş kendi çalışma ağacında yapılır ve onu yapmayan bir oturumca incelenir
agirlik: cift-yonlu
tip: surec
tarih: 2026-11-20
---
Ajanla yapılan işler için çalışma ağacı yalıtımı ve bağımsız inceleme seçildi; yarım ya da hatalı iş ana ağaca ulaşmıyor ve "bitti" beyanı ölçümle doğrulanıyor, her iş için ayrı ağaç, birleştirme adımı ve ikinci bir oturumun maliyeti kabul ediliyor.

## Bağlam
Aynı klasörde çalışan oturumlar birbirinin yarım işini görür ve bozar; işi yapanın kendi işini onaylaması ise kararın uygulanıp uygulanmadığını göstermez.

## Seçenekler
### A — Her oturum ve görev kendi çalışma ağacında; iş ölçülür, incelenir, sonra alınır
Oturumlar birbirini etkilemez; neyin değiştiği git farkından ölçülür; planın işareti ölçümden gelir.
### B — Herkes ana ağaçta çalışır, işi yapan "bitti" der
Kurulumu yoktur; paralel işler çakışır, kapsam dışı değişiklik ve uygulanmayan kural ancak sonradan fark edilir.

## Sonuçlar
- Olumlu: paralel oturumlar güvenle çalışır; her işin dalı, raporu ve inceleme kaydı vardır.
- Olumsuz: iş ancak commit edilmiş hâlin üstüne kurulur; her iş bir birleştirme ve bir inceleme oturumu ister.
- Yükümlülük: ana ağaçta düzenleme yapılmaz (KU-003); iş incelenmeden alınmaz ve kayıtlar elle yazılmaz (KU-004).
- Ortak parça: `harness/gorev.py`, `harness/plan.py`.

## İstisna yolu
Git deposu olmayan ya da ilk commit'i atılmamış klasörde ağaç kuralı uygulanamaz; kapı o zaman sessizdir ve bunu oturum başında söyler. İnceleme, kullanıcı `harness.json` içinde `gorev.inceleme` değerini `istege-bagli` yaparsa atlanabilir; ağaç kuralı `oturum_agaci: kapali` ile kapatılır. İkisi de kullanıcının bilerek verdiği karardır.
