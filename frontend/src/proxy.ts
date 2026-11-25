import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { backendCagrisi } from './shared/backend/istek';
import {
  ERISIM_CEREZI_SURESI_SN,
  OTURUM_CEREZLERI,
  secenekler,
  UZUN_CEREZ_SURESI_SN,
} from './shared/oturum/cerezler';

// Ara katman (Next.js 16'da "proxy"; sayfadan ve işten önce Node.js çalışma zamanında koşar).
// Oturumun sessiz yenilenmesi (TS-004 "Oturumun yenilenmesi"; TS-002 AK-49 madde 7): erişim
// çerezi yokken yenileme ve cihaz çerezi varsa backend'den yeni çift alınır. Sunucu bileşeni
// çerez yazamadığı için çerezi hem süren isteğe hem cevaba yazabilen tek yer burasıdır.
// Eşzamanlı istekler için kilit yoktur: backend aynı eski belirteçle 10 saniye içinde gelen
// isteğe aynı çifti verir (AK-49 madde 3).

const YenilemeCevabi = z.object({
  erisimBelirteci: z.string(),
  yenilemeBelirteci: z.string(),
});

export async function proxy(istek: NextRequest): Promise<NextResponse> {
  const cerezler = istek.cookies;
  const yenileme = cerezler.get(OTURUM_CEREZLERI.yenileme)?.value;
  const cihaz = cerezler.get(OTURUM_CEREZLERI.cihaz)?.value;
  if (
    cerezler.has(OTURUM_CEREZLERI.erisim) ||
    yenileme === undefined ||
    cihaz === undefined
  ) {
    return NextResponse.next();
  }

  // Adres yalnız BACKEND_ADRESI'nden kurulur; imza başlıkları backend isteğinin tek yerinden
  // gelir. Belirteçler ve cihaz sırrı günlüğe yazılmaz.
  const sonuc = await backendCagrisi(
    {
      yol: '/kimlik/oturum/yenile',
      yontem: 'POST',
      govde: { yenilemeBelirteci: yenileme, cihazSirri: cihaz },
    },
    istek.headers,
    undefined,
  );

  if (sonuc.basarili) {
    const yeni = YenilemeCevabi.parse(sonuc.govde);
    // Süren isteğin çerez başlığı değişir; sayfa aynı istekte yeni belirteci görür.
    cerezler.set(OTURUM_CEREZLERI.erisim, yeni.erisimBelirteci);
    cerezler.set(OTURUM_CEREZLERI.yenileme, yeni.yenilemeBelirteci);
    const cevap = NextResponse.next({ request: { headers: istek.headers } });
    cevap.cookies.set(
      OTURUM_CEREZLERI.erisim,
      yeni.erisimBelirteci,
      secenekler(ERISIM_CEREZI_SURESI_SN),
    );
    cevap.cookies.set(
      OTURUM_CEREZLERI.yenileme,
      yeni.yenilemeBelirteci,
      secenekler(UZUN_CEREZ_SURESI_SN),
    );
    return cevap;
  }

  // Yenilenemeyen oturum biter (TS-004 Değişmez 5).
  if (sonuc.hata.kod === 'kimlik_gerekli') {
    const cevap = NextResponse.redirect(new URL('/giris', istek.url));
    for (const ad of Object.values(OTURUM_CEREZLERI)) {
      cevap.cookies.delete(ad);
    }
    return cevap;
  }

  // Ulaşılamadı ya da öbür hatalar (5xx dahil): geçici arıza oturumu düşürmez; çerezlere
  // dokunulmaz, istek sürer.
  return NextResponse.next();
}

// Açık sayfalar (/giris, /parola-belirle), /oturum-bitti, çatının iç yolları (/_next/) ve
// durağan dosyalar (favicon.ico gibi) ara katmanın dışında kalır. Durağan dosya uzantı
// listesiyle tanınır: çatı panel sayfasının RSC isteğini ".rsc" sonekiyle de eşler; "noktalı
// her yol" kuralı o isteği dışarıda bırakırdı.
export const config = {
  matcher: [
    '/((?!(?:giris|parola-belirle|oturum-bitti)(?:/|$)|_next/|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|txt|xml|webmanifest|css|js|map|woff2?|ttf)$).*)',
  ],
};
