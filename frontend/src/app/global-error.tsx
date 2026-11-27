'use client';

// Kök düzenin kendisi fırlatırsa gösterilen en yalın sayfa; kök düzenin yerini aldığı için kendi
// html ve body öğelerini çizer, biçim dosyası yüklenmez. Düğme sayfayı tam yükler; yükleme ara
// katmanı yeniden koşturur. Hatanın iletisi, yığını ve özeti ekrana ve günlüğe yazılmaz.
export default function GenelHataEkrani() {
  return (
    <html lang="tr">
      <body>
        <main id="ana-icerik">
          <p role="alert">Beklenmeyen bir hata oluştu</p>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Yeniden dene
          </button>
        </main>
      </body>
    </html>
  );
}
