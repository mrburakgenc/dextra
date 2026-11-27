import 'server-only';
import { cookies } from 'next/headers';

// Oturum çerezleri (TS-004 Yapı): betiğe kapalı, SameSite=Lax, Path=/, geliştirme dışında Secure.
// Yazma ve silme yalnız Server Action ya da Route Handler içinde çalışır (çatının kuralı).
export const OTURUM_CEREZLERI = {
  erisim: 'dextra_erisim',
  yenileme: 'dextra_yenileme',
  cihaz: 'dextra_cihaz',
} as const;

// Erişim çerezi belirteçten (TS-002 AK-6: 15 dakika) kısa yaşar ki süresi dolmuş belirteç
// backend'e gitmesin; çerezin yokluğu ara katmana "yenile" der (TS-004). Öbür ikisi 7 gün yaşar.
export const ERISIM_CEREZI_SURESI_SN = 14 * 60;
export const UZUN_CEREZ_SURESI_SN = 7 * 24 * 60 * 60;

// Giriş cevabının çerezlere yazılan kısmı.
export interface GirisBelirtecleri {
  readonly erisimBelirteci: string;
  readonly yenilemeBelirteci: string;
  readonly cihazSirri: string;
}

// Ara katman yenilenen çerezleri aynı özniteliklerle yazar.
export function secenekler(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Güvenli taraf: NODE_ENV tanımsız ya da beklenmeyen değerdeyse de Secure yazılır.
    secure: process.env.NODE_ENV !== 'development',
    maxAge,
  } as const;
}

export async function oturumCerezleriniYaz(
  giris: GirisBelirtecleri,
): Promise<void> {
  const depo = await cookies();
  depo.set(
    OTURUM_CEREZLERI.erisim,
    giris.erisimBelirteci,
    secenekler(ERISIM_CEREZI_SURESI_SN),
  );
  depo.set(
    OTURUM_CEREZLERI.yenileme,
    giris.yenilemeBelirteci,
    secenekler(UZUN_CEREZ_SURESI_SN),
  );
  depo.set(
    OTURUM_CEREZLERI.cihaz,
    giris.cihazSirri,
    secenekler(UZUN_CEREZ_SURESI_SN),
  );
}

export async function erisimBelirteciniOku(): Promise<string | undefined> {
  const depo = await cookies();
  return depo.get(OTURUM_CEREZLERI.erisim)?.value;
}

// Yenileme ve cihaz çerezi birlikte duruyor mu: ara katman oturumu yalnız ikisi varken yeniler.
export async function yenilemeCerezleriVar(): Promise<boolean> {
  const depo = await cookies();
  return (
    depo.get(OTURUM_CEREZLERI.yenileme) !== undefined &&
    depo.get(OTURUM_CEREZLERI.cihaz) !== undefined
  );
}

export async function oturumCerezleriniSil(): Promise<void> {
  const depo = await cookies();
  for (const ad of Object.values(OTURUM_CEREZLERI)) {
    depo.delete(ad);
  }
}
