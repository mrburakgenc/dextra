---
kimlik: KR-017
tur: karar
durum: taslak
surum: 1
baslik: Kapılar sunucuda da koşar: denetimler ve testler ajanın makinesinin dışında yinelenir
agirlik: cift-yonlu
tip: surec
tarih: 2026-11-27
---
Push kapısının koşturduğu denetimler ve bütün test kümeleri her PR'da ve ana dalın her itişinde GitHub'da yeniden koşar ve PR'a taban dalın koduyla üretilen bir özet yazılır; kapının ajanın makinesinde atlatılması görünür olur, bedeli GitHub'a bağımlılık ve bakılacak ikinci bir kapıdır.

## Bağlam
Kullanıcı (2026-11-27, ileti): "Dextra denetim raporu.md gerekenleri yap planı çıkart"; plan sunulunca "yürüt". Dış denetim raporu (2026-11-27, denetlenen commit `fdbceef`) altı bulgu saydı; ikisi yüksek önemdeydi ve ikisi de aynı çözüme çıkıyordu: sunucu tarafında çalışan bir kapı.

Ölçülenler (ana oturum, 2026-11-27, `fdbceef` üzerinde; aksi yazılmadıkça koda kendisi baktı):
- Kapılar yalnız geliştiricinin makinesinde koşuyordu: `harness/hook/git/pre-commit` zincir denetimini, `pre-push` zincir denetimini ve dört denetim komutunu (DN-001 … DN-004) koşturur. Depoda `.github/` yoktu.
- Testler hiçbir kapıda koşmuyordu: arka yüzde 100 test dosyası, ön yüzde 33, araçta 23 dosyada 815 test. Kapıdaki tek test dosyası yapı denetiminin spec'iydi (DN-002).
- Ana oturum sınırsız komut ve düzenleme iznine sahiptir (`.claude/settings.json`); "dosyayı komutla yazmaz" yasağı yalnız görev oturumunda geçerlidir. Onay kayıtları `.harness/onay/` altında düz dosyadır ve `.harness/` düzenlemesi kapıdan geçer. `denetle`, bir düğümün kabul durumunu hiçbir onay kaydına bağlamaz: dosyadaki `durum:` satırını elle çeviren değişiklik zincir denetiminden geçer.
- Kanca, kapı atlatan bayrağın yalnız tam yazımını yakalıyordu; kısaltmalar geçiyordu (bulgu 3; GV-168 ile kapandı). GV-168'in incelemeleri aynı kancada üç atlatma daha buldu ve bunlar açık duruyor: bash'in `$'...'` tırnağı, komut takma adı, yorum satırındaki satır devamı.
- Depo GitHub'da herkese açıktır; `main` dalının koruma kuralı yoktur; bu makinedeki `gh` deponun sahibinin hesabıyla açıktır (`gh api` ile ölçüldü).

Kısıtlar: KU-001 ve KU-002 (kabulü kullanıcı verir; kapılar atlanmaz) bugün ajanın iyi niyetine ve yerel kancaya dayanır. KU-021 "depoda sürekli tümleştirme yoktur" gözlemini taşır; o cümle bir yasak değil, o günün ölçümüdür.

## Seçenekler
### A — Sunucu tarafı kapı: GitHub'ın koşucusunda iki iş akışı
Teknik: sürekli tümleştirme; özet için güvenilen tabandan çalıştırma (`pull_request_target`). Kapı iş akışı PR'da ve ana dalın itişinde zincir denetimini, dört denetim komutunu ve arka yüz, ön yüz, araç testlerini koşturur; özet iş akışı kabule geçen düğümleri ve kapı dosyalarındaki değişikliği taban dalın koduyla PR'a yazar. Kazanç: testler ilk kez bir kapıda koşar; yerel kapıyı atlatan değişiklik PR'da kırmızı ya da görünür olur; kanca için yazılacak her yeni desenin yükü azalır. Bedel: GitHub'a bağımlılık; iki iş akışı dosyası yeni bir bakım ve saldırı yüzeyidir (özet iş akışı yazma yetkili belirteçle koşar); kapı ancak dal koruma kuralıyla zorunlu olur ve o kural kodla değil GitHub ayarıyla kurulur.
### B — Yalnız yerel kapıları sertleştirmek
Teknik: kancada daha geniş desen, onay kayıtlarının imzalanması, `denetle`'nin kabul durumunu onay kaydına bağlaması. Kazanç: dış bağımlılık yok. Bedel: güven kökü ajanın makinesinde kalır; sınırsız komut izni olan bir oturum kapının kodunu da ayarını da değiştirebilir. Desenle sertleştirme bitmeyen bir iştir: GV-168 üç atlatmayı kapattı, incelemeleri üç yenisini buldu. Testler yine hiçbir kapıda koşmaz (kullanıcının yerel kapı için süre sınırı 60 saniyedir; TS-009 AU-4).
### C — Kendi barındırılan koşucu ya da ayrı bir makinede elle koşum
Kazanç: GitHub'ın koşucusuna bağımlılık yok, yerel hizmetlere erişim kolay. Bedel: makinenin bakımı; herkese açık depoda kendi barındırılan koşucu, PR'dan gelen kodu o makinede çalıştırır; elle koşum unutulduğu gün koşmamış olur (KU-021'in gerekçesi).

## Seçim
A. Kullanıcı planı gördükten sonra yürüttü (2026-11-27, "yürüt") ve işi gönderip PR açmayı seçti (soru penceresi, "Gönder ve PR aç"). B reddedilmedi, yetersiz bulundu: bulgu 3 için yine yapıldı (GV-168), ama kalıcı çözüm sayılmadı. C, herkese açık depoda PR kodunu kendi makinede çalıştırdığı için bırakıldı.

## Sonuçlar
- Olumlu: arka yüz, ön yüz ve araç testleri her PR'da koşar; kabule geçen düğüm ve kapı dosyasındaki değişiklik PR'da adıyla görünür; yerel kanca atlatılsa da değişiklik sunucudaki kapıdan geçmek zorundadır.
- Olumsuz: GitHub kesintisinde kapı koşmaz; iş akışları ayrıca bakım ister; kapı, dal koruma kuralı kurulana kadar zorunlu değil yalnız görünürdür.
- Yükümlülük: ana dala, sunucu tarafı kapının işleri geçmeden birleştirilmez (KU-022).
- Ortak parça: `.github/workflows/kapi.yml`, `.github/workflows/ozet.yml`, `python3 harness/h.py ozet` ve iş akışlarını metin olarak sınayan `harness/test/test_is_akisi.py` (GV-170, GV-171).

## Doğrulama
`harness/test/test_is_akisi.py` iş akışı dosyalarını sınar (13 test; 2026-11-27'de geçti). İş akışlarının GitHub'daki ilk gerçek koşusu bu karar yazılırken henüz görülmedi; görülünce tarihi ve sonucu rapora yazılır.

## Varsayımlar
- Varsayım (2026-11-27, ölçülmedi): herkese açık depoda GitHub'ın barındırdığı koşucular ücretsizdir.
- Varsayım (2026-11-27, ölçülmedi): koşucuda docker compose, python3 ve gh kuruludur; `postgres:19-alpine` ve `redis:8-alpine` imajları çekilebilir.
- Ölçüldü (2026-11-27): depo herkese açık, `main` korumasız.

## Geri dönüş
İki iş akışı dosyası silinir ve KU-022 ezilir; taşınacak veri yoktur. Yeniden bakma tetiği: depo özele çevrilirse (koşucu süresi ücretli olur) ya da kapının süresi bir PR'ı 15 dakikadan uzun bekletirse (varsayım; ölçülmedi).

## İstisna yolu
Sunucu tarafı kapı koşamıyorsa (GitHub kesintisi, koşucunun bozulması) birleştirme bekler. Beklenemeyecek işte birleştirme kararını yalnız kullanıcı verir ve nedenini PR'a yazar; ajan kapı kırmızıyken ya da koşmamışken birleştirmeyi önermez. Kapıyı geçirmek için iş akışı, test ya da denetim gevşetilmez (KU-002, KU-021).

### Ajan kararları
- AK-1 Ağırlık çift yönlüdür: iş akışları dosyadır, silinince eski duruma dönülür; taşınacak veri ve dışarıya verilmiş söz yoktur.
- AK-2 Kapı iş akışı arka yüzün e2e testlerini de koşturur: KU-011'in açılış denetimi yalnız uygulama açılınca çalışır ve o testlerin dışında hiçbir yerde koşmaz.
- AK-3 Özet ayrı bir iş akışında ve `pull_request_target` ile üretilir: aynı iş akışında üretilseydi PR, özeti üreten kodu da değiştirebilirdi. Bedeli, o iş akışının yazma yetkili belirteçle koşması ve PR'dan gelen kodu hiç çalıştırmamak zorunda olmasıdır; bunu `test_is_akisi.py` sınar.
- AK-4 Eylemler sürüm etiketine değil commit özetine sabitlenir: etiketi sonradan değiştirilen eylem depoya giremez; bedeli güncellemenin elle yapılmasıdır.
- AK-5 Bu karar için ayrı bir tasarım kaydı açılmadı: karar çift yönlüdür, seçenekler ve ölçümler bu düğümde ve EP-014'ün raporundadır (`docs/rapor/2026-11-27-denetim-raporunun-bulgulari-sunucu-tarafi-kapi-ve-aracin-ser.md`).
- AK-6 Karar, iş yapıldıktan sonra yazıldı: EP-014 kullanıcının "yürüt" sözüyle bu düğüm olmadan yürüdü. Sıra tersti; düğüm, yapılanı kullanıcının kabulüne sunar.

## Açık uçlar
- AU-1: Ana dal için koruma kuralı kurulacak mı ve hangi koşullarla: PR zorunlu, kapının dört işi zorunlu kontrol, onay zorunlu?
- AU-2: Ajan GitHub'da hangi kimlikle çalışacak: deponun sahibinin hesabıyla mı, birleştirme yetkisi olmayan ayrı bir hesap ya da belirteçle mi?
