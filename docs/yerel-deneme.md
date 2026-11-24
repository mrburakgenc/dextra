# Yerel deneme

`node scripts/yerel-deneme.mjs` uygulamanın tamamını geçici veritabanlarıyla yerelde açar.

- **Ne yapar:** yerel PostgreSQL'de `dextra_test_yerel_` önekli iki geçici veritabanı (asıl, iz) açar ve göçleri uygular; belirteç anahtar çiftini ve aracı katman sırrını bellekte üretir; backend'i derleyip tohum ve kurulum komutlarını koşturur; backend'i 3001'de, derlenmiş ön yüzü 3100'de başlatır.
- **Önce:** `docker compose up -d postgres` ve bağımlılıkların kurulu olması (`pnpm install`); 3001 ve 3100 boş olmalı.
- **Başlatınca:** ilk yöneticinin kullanıcı adı ve parola belirleme adresi (`http://localhost:3100/parola-belirle?kod=...`) yazılır; kod yalnız o geçici veritabanı içindir. `hazır` satırı görülünce `http://localhost:3100` açılır.
- **Kapatmak:** Ctrl-C (ya da SIGTERM). Süreçler kapanır, iki geçici veritabanı silinir, betik 0 ile çıkar. Açılışta bir adım hata verirse açılanlar temizlenir ve betik 1 ile çıkar.
- **Neye dokunmaz:** `dextra` ve `dextra_iz` veritabanlarına yazmaz (yalnız veritabanı açıp silmek için bağlanır); anahtar ve sırrı diske ya da ekrana yazmaz; izlenen dosyaları değiştirmez (derleme çıktıları yok sayılan `dist/` ve `generated/` klasörlerine gider).
- Kapatıldıktan sonra her koşu sıfırdan başlar; geçici veritabanındaki veri saklanmaz.
