# Yerel deneme

`node scripts/yerel-deneme.mjs` uygulamanın tamamını yerelde açar; iki kipi vardır.

- **Geçici kip (bayraksız):** yerel PostgreSQL'de `dextra_test_yerel_` önekli iki geçici veritabanı (asıl, iz) açar ve göçleri uygular; belirteç anahtar çiftini ve aracı katman sırrını bellekte üretir; backend'i derleyip tohum ve kurulum komutlarını koşturur; backend'i ve derlenmiş ön yüzü başlatır. Kapanınca iki veritabanı silinir; her koşu sıfırdan başlar.
- **Kalıcı kip (`--kalici`):** geçici veritabanı açmaz, hiçbir veritabanını silmez; yerel `dextra` ve `dextra_iz` veritabanlarının bekleyen göçlerini uygular (uygulanmışsa bir şey yapmaz), tohumu koşturur (yinelenebilir) ve uygulamayı onların üstünde açar. `hazır` satırı kipi ve veritabanlarının adlarını yazar.
- **Kalıcı kipte göçten önce yasak taraması:** göçler uygulanmadan önce derlenmiş tarama komutu (`pnpm -C backend yasak-tarama`; `backend/src/yasak-tarama.ts`) koşar: canlı yasakları koşan kodun şemasıyla karşılaştırır, yalnız okur. Tarama uygulamayı açtığı için kalıcı kipte anahtar çifti (3) ve derleme (4a) göçlerden önce yapılır; sıra 1, 3, 4a, 1b (tarama), 2, 4b… olur. Bozulacak yasak yoksa (ya da yetenek tablosu ya da tablonun `giremez` ve `oncelik` kolonları henüz yoksa; ilk kurulumdaki boş veritabanı gibi) tek satırlık sonucu yazılır ve betik devam eder. Bozulacak yasak varsa göçler **uygulanmaz**: her yasak (yetenek kimliği, kaynak, eylem, neden) listelenir, "listedeki her yasağı düzeltin ya da silin, sonra betiği yeniden başlatın" yazılır ve betik 1 ile durur. Geçici kipte (boş veritabanı) tarama koşmaz. Komut elle de koşturulabilir: bozulacak yasak yoksa (yetenek tablosu hiç yoksa da) 0, varsa 2, tarama hata verirse 1 ile çıkar. Elle koşu için uygulamanın açılışta istediği ortam değişkenlerinin hepsi verilir; biri eksikse komut 1 ile çıkar: `DATABASE_URL`, `IZ_DATABASE_URL`, `KIMLIK_IMZA_OZEL_ANAHTAR`, `KIMLIK_IMZA_ACIK_ANAHTAR` (PEM biçiminde RSA anahtar çifti) ve `ARACI_KATMAN_SIRRI`.
- **Kalıcı kipte ne kalır, ne düşer:** veri (kullanıcılar, parolalar, tohum) kapanışta durur. Anahtar çifti her başlatmada yeniden üretildiği için açık oturumlar düşer; yeniden giriş yapılır.
- **`--kurulum`:** yalnız `--kalici` ile birlikte verilir; kurulum komutunu koşturur ve ilk yöneticinin parola belirleme adresini yazar (yeni kod eskisini geçersiz kılar). İlk yöneticinin parolası henüz yoksa (ilk açılışta) gerekir; yoksa kurulum koşmaz, yalnız bir not yazılır.
- **Ortam değişkenleri:** `YEREL_BACKEND_KAPISI` ve `YEREL_ONYUZ_KAPISI` kapıları değiştirir (verilmezse 3001 ve 3100); yazılan adresler ve ön yüzün backend adresi bunları kullanır. Kalıcı kipte `YEREL_DATABASE_URL` ve `YEREL_IZ_DATABASE_URL` ikisi birlikte verilirse `dextra`/`dextra_iz` yerine onlar kullanılır; yalnız biri verilirse betik 1 ile çıkar.
- **Önce:** `docker compose up -d postgres` ve bağımlılıkların kurulu olması (`pnpm install`); seçilen kapılar boş olmalı.
- **Başlatınca:** ilk yöneticinin kullanıcı adı ve parola belirleme adresi (`http://localhost:3100/parola-belirle?kod=...`) yazılır (kalıcı kipte yalnız `--kurulum` ile). `hazır` satırı görülünce ön yüz adresi açılır.
- **Kapatmak:** Ctrl-C (ya da SIGTERM). Süreçler kapanır, betik 0 ile çıkar; geçici kipte iki veritabanı silinir, kalıcı kipte veritabanlarına dokunulmaz. Açılışta bir adım hata verirse süreçler kapanır (geçici veritabanları silinir, kalıcılar durur) ve betik 1 ile çıkar.
- **Hatalı kullanım:** bilinmeyen bayrak, tek başına `--kurulum` ya da iki veritabanı adresinden yalnız biri hiçbir şeye dokunmadan 1 ile çıkar.
- **Neye dokunmaz:** geçici kipte `dextra` ve `dextra_iz` veritabanlarına yazmaz (yalnız veritabanı açıp silmek için bağlanır); anahtar ve sırrı diske ya da ekrana yazmaz; izlenen dosyaları değiştirmez (derleme çıktıları yok sayılan `dist/` ve `generated/` klasörlerine gider). Veritabanını boşaltmak bu betiğin işi değildir.

## Sunucu tarafı kapı

Geliştiricinin makinesindeki kapılar (git kancaları) atlatılabilir; aynı denetimler GitHub'da da koşar. İki iş akışı vardır (`.github/workflows/`). Bunların PR'ı birleştirmeyi engellemesi (main dalının koruma kuralı) ve ajanın GitHub'da hangi kimlikle çalıştığı kullanıcının GitHub ayarıdır; bu depodan kurulmaz.

- **`kapi.yml`:** main'e açılan her PR'da ve main'e her push'ta koşar; gizli değer kullanmaz, belirteci yalnız okur. Dört işi vardır:
  - `zincir`: `python3 harness/h.py denetle --dal` (pre-push kancasının koşturduğu komutun aynısı).
  - `arac-testleri`: `harness/test/test_*.py` dosyalarının her birini tek başına koşturur; hepsi koşar, kalanlar sonda adlarıyla yazılır.
  - `arka-yuz`: `docker compose up -d --wait postgres redis`, ardından `pnpm -C backend test` ve `pnpm -C backend test:e2e`.
  - `on-yuz`: `pnpm -C frontend test`.
- **`ozet.yml`:** main'e açılan PR'da `pull_request_target` ile koşar. Taban dalın kodu çalışır; PR'ın ucu çalışma ağacına çekilmez, yalnız git nesnesi olarak getirilir. `python3 harness/h.py ozet --taban origin/<taban dal> --uc pr/<PR numarası>` çıktısını PR'a tek yorum olarak yazar; sonraki koşular aynı yorumu yeniler.

**Aynı komutlar yerelde:**

```sh
python3 harness/h.py denetle --dal
for dosya in harness/test/test_*.py; do python3 "$dosya" || echo "KALDI: $dosya"; done
docker compose up -d --wait postgres redis
pnpm -C backend test && pnpm -C backend test:e2e
pnpm -C frontend test
python3 harness/h.py ozet --taban main
```

**Özet yorumu ne gösterir:** `ozet` ortak atadan uca kadarki farkı yalnız git nesnelerinden okur (commit edilmemiş değişiklik girmez, uçtaki kod çalışmaz); karar vermez, kapı değildir. Üç bölümü vardır, boş bölümde "yok" yazar:

1. *Kabule geçen düğümler:* uçta `kabul` olup tabanda kabul olmayan düğümler (`taslak → kabul`; uçta yeni eklenmişse `yeni → kabul`) ve sürümleri. `durum:` satırı elle çevrilmiş bir düğüm burada görünür. Baş bloğu okunamayan düğüm de burada "okunamadı" diye geçer.
2. *Kabul edilmiş düğümde değişiklik:* sürümü değişen (`1 → 2`), gövdesi değişip sürümü artmayan ("sürüm artmadı"), kabulden çıkan ya da silinen kabul düğümleri.
3. *Kapı dosyalarında değişiklik:* `harness/**`, `.claude/**`, `.github/**`, `harness.json`, `AGENTS.md`, `CLAUDE.md`, ESLint, TypeScript ve Vitest ayarları, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` ve tabandaki `harness.json`'un `korunan_ayar` desenleri; her biri eklendi, değişti ya da silindi diye.

`--taban` verilmezse taban dal uçtaki `harness.json`'dan okunur, yani uç onu değiştirebilir; güvenilmeyen uçta taban açıkça verilir.

**Görev oturumunun ortamı ve MCP (`harness.json`, `gorev` altında):**

- `gorev.ortam_izinli`: görev oturumuna, hazırlık komutuna ve ön kontrole geçen ortam değişkenleri. Sonu `*` ile biten öğe ön ektir (`LC_*`). Ayarda yazmıyorsa varsayılan liste geçerlidir: `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `TMPDIR`, `LANG`, `LC_*`, `TERM`, `TZ`; ayarda yazıyorsa varsayılanın yerine geçer. `CLAUDE` ile başlayan değişkenler listede olsa da oturuma geçmez; oturuma ayrıca `HARNESS_GOREV`, `HARNESS_KOK` ve `HARNESS_ROL` verilir. Listede olmayan bir değişken (örneğin üst kabuktaki bir belirteç) işçiye de inceleyiciye de ulaşmaz.
- `gorev.mcp_roller`: `gorev.mcp` sunucularının hangi rollerdeki oturuma verileceği; varsayılan `["uygulayici"]`, yani inceleme oturumu MCP sunucusu almaz. İki rol sayılırsa ikisi de alır, boş listede hiçbiri almaz.

**Makineye özel değişken:** yalnız bu makinede gereken bir değişken (örneğin `SSH_AUTH_SOCK`) depoya girmeyen `harness.yerel.json` dosyasıyla eklenir. Dosya ana çalışma ağacının kökünde durur ve `.gitignore`'dadır:

```json
{ "gorev": { "ortam_izinli": ["SSH_AUTH_SOCK"] } }
```

Buradaki liste ayardaki (ya da varsayılan) listeye eklenir, onu daraltmaz. Aynı dosyadaki `gorev.yol` klasörleri görev komutlarının `PATH`'inin başına eklenir.
