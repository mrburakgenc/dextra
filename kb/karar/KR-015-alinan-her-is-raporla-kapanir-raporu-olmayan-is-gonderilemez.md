---
kimlik: KR-015
tur: karar
durum: kabul
surum: 1
baslik: Alınan her iş raporla kapanır; raporu olmayan iş gönderilemez
agirlik: cift-yonlu
tip: surec
tarih: 2026-11-25
---
Ajanın yürüttüğü işler için yazılı rapor zorunlu kılındı ve raporun varlığı push kapısında aranıyor; kullanıcı ne yapıldığını, neyin değiştiğini ve kendisinden ne beklendiğini tek belgeden denetleyebiliyor, her gönderimden önce rapor yazma yükü kabul ediliyor.

## Bağlam
Kullanıcı (2026-11-25, kendi sözü): "bu gece raporu gibi raporların da yazılması şart olsun harness'ta". 2026-11-24 gecesi 104 görev koştu ve kullanıcı sonucu sabah `docs/rapor/2026-11-24-gece-raporu.md` üzerinden denetledi. O rapor kullanıcı o gece ayrıca istediği için yazılmıştı ve görev tablosu geçici bir betikle üretilmişti; araçta raporu isteyen ya da üreten bir parça yoktu (ölçüldü, 2026-11-25: `harness/` altında rapor komutu yok). Görev kayıtları (`.harness/gorev/`) depoya girmez; rapor yazılmazsa neyin, neden ve hangi kararla yapıldığı depoda kalmaz.

## Seçenekler
### A — Rapor zorunlu; tabloyu araç üretir, push kapısı raporu arar
Dalda alınan her görevin (alma commit'inin başlığı `GV-NNN:` ile başlar) bir raporda geçtiği push'tan önce denetlenir; görev tablosu aracın kayıtlarından üretilir, kısa özet ile kullanıcıdan beklenenler elle yazılır. Unutulamaz ve sayılar elle yazılmaz. Bedeli: her gönderimden önce rapor yazılır.
### B — Rapor iş akışının adımıdır ama denetlenmez
İş akışına "rapor yaz" adımı eklenir. Kurulumu ucuzdur; yoğun işte atlanır ve atlandığı fark edilmez (mimari kuralların taslak kaldığı için uygulanmaması aynı türden bir boşluktu).
### C — Raporu araç bütünüyle üretir
Elle yazılan bölüm kalmaz; ama kararların gerekçesi, ajanın hataları ve kullanıcıdan beklenenler kayıtlardan çıkarılamaz, rapor tablodan ibaret kalır.

## Sonuçlar
- Olumlu: her gönderimde ne yapıldığı, kimin hangi kararı verdiği ve kullanıcıdan ne beklendiği depoda durur; görev sayıları elle yazılmaz.
- Olumsuz: tek görevlik küçük iş de rapor ister; kapı yalnız görevle (araçla) alınan işi görür, ana oturumun elle attığı commit'leri görmez.
- Yükümlülük: alınan her görev gönderilmeden önce bir raporda yer alır (KU-016).
- Ortak parça: `harness/rapor.py` (`h.py rapor yeni`, `rapor uret`, `rapor durum`) ve `harness/sablon/rapor.md`.

## İstisna yolu
Rapor zorunluluğu `harness.json` içinde `rapor.zorunlu: false` ile kapatılır; bu ayar korunan ayardır ve değişikliği kullanıcıya sorulur. Taban dalla karşılaştırılamayan depoda (ilk commit, taban dal yok) denetim ölçülemez ve kapı bunu söyler.
