# Yerel deneme

`node scripts/yerel-deneme.mjs` uygulamanın tamamını yerelde açar; iki kipi vardır.

- **Geçici kip (bayraksız):** yerel PostgreSQL'de `dextra_test_yerel_` önekli iki geçici veritabanı (asıl, iz) açar ve göçleri uygular; belirteç anahtar çiftini ve aracı katman sırrını bellekte üretir; backend'i derleyip tohum ve kurulum komutlarını koşturur; backend'i ve derlenmiş ön yüzü başlatır. Kapanınca iki veritabanı silinir; her koşu sıfırdan başlar.
- **Kalıcı kip (`--kalici`):** geçici veritabanı açmaz, hiçbir veritabanını silmez; yerel `dextra` ve `dextra_iz` veritabanlarının bekleyen göçlerini uygular (uygulanmışsa bir şey yapmaz), tohumu koşturur (yinelenebilir) ve uygulamayı onların üstünde açar. `hazır` satırı kipi ve veritabanlarının adlarını yazar.
- **Kalıcı kipte ne kalır, ne düşer:** veri (kullanıcılar, parolalar, tohum) kapanışta durur. Anahtar çifti her başlatmada yeniden üretildiği için açık oturumlar düşer; yeniden giriş yapılır.
- **`--kurulum`:** yalnız `--kalici` ile birlikte verilir; kurulum komutunu koşturur ve ilk yöneticinin parola belirleme adresini yazar (yeni kod eskisini geçersiz kılar). İlk yöneticinin parolası henüz yoksa (ilk açılışta) gerekir; yoksa kurulum koşmaz, yalnız bir not yazılır.
- **Ortam değişkenleri:** `YEREL_BACKEND_KAPISI` ve `YEREL_ONYUZ_KAPISI` kapıları değiştirir (verilmezse 3001 ve 3100); yazılan adresler ve ön yüzün backend adresi bunları kullanır. Kalıcı kipte `YEREL_DATABASE_URL` ve `YEREL_IZ_DATABASE_URL` ikisi birlikte verilirse `dextra`/`dextra_iz` yerine onlar kullanılır; yalnız biri verilirse betik 1 ile çıkar.
- **Önce:** `docker compose up -d postgres` ve bağımlılıkların kurulu olması (`pnpm install`); seçilen kapılar boş olmalı.
- **Başlatınca:** ilk yöneticinin kullanıcı adı ve parola belirleme adresi (`http://localhost:3100/parola-belirle?kod=...`) yazılır (kalıcı kipte yalnız `--kurulum` ile). `hazır` satırı görülünce ön yüz adresi açılır.
- **Kapatmak:** Ctrl-C (ya da SIGTERM). Süreçler kapanır, betik 0 ile çıkar; geçici kipte iki veritabanı silinir, kalıcı kipte veritabanlarına dokunulmaz. Açılışta bir adım hata verirse süreçler kapanır (geçici veritabanları silinir, kalıcılar durur) ve betik 1 ile çıkar.
- **Hatalı kullanım:** bilinmeyen bayrak, tek başına `--kurulum` ya da iki veritabanı adresinden yalnız biri hiçbir şeye dokunmadan 1 ile çıkar.
- **Neye dokunmaz:** geçici kipte `dextra` ve `dextra_iz` veritabanlarına yazmaz (yalnız veritabanı açıp silmek için bağlanır); anahtar ve sırrı diske ya da ekrana yazmaz; izlenen dosyaları değiştirmez (derleme çıktıları yok sayılan `dist/` ve `generated/` klasörlerine gider). Veritabanını boşaltmak bu betiğin işi değildir.
