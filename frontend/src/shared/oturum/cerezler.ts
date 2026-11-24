import 'server-only';
import { cookies } from 'next/headers';

// Oturum çerezleri (TS-004 Yapı): betiğe kapalı, SameSite=Lax, Path=/, üretimde Secure.
// Yazma ve silme yalnız Server Action ya da Route Handler içinde çalışır (çatının kuralı).
export const OTURUM_CEREZLERI = {
  erisim: 'dextra_erisim',
  yenileme: 'dextra_yenileme',
  cihaz: 'dextra_cihaz',
} as const;

// Erişim çerezi belirtecin süresi kadar (TS-002 AK-6: 15 dakika), öbür ikisi 7 gün yaşar.
const ERISIM_CEREZI_SURESI_SN = 15 * 60;
const UZUN_CEREZ_SURESI_SN = 7 * 24 * 60 * 60;

// Giriş cevabının çerezlere yazılan kısmı.
export interface GirisBelirtecleri {
  readonly erisimBelirteci: string;
  readonly yenilemeBelirteci: string;
  readonly cihazSirri: string;
}

function secenekler(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
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

export async function oturumCerezleriniSil(): Promise<void> {
  const depo = await cookies();
  for (const ad of Object.values(OTURUM_CEREZLERI)) {
    depo.delete(ad);
  }
}
