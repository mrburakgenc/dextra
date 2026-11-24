import 'server-only';
import { headers } from 'next/headers';
import { erisimBelirteciniOku } from '../oturum/cerezler';
import { type BackendHatasi, hataGovdesiniOku } from './hata';
import { imzaBasliklari } from './imza';

// Backend'e giden her istek buradan geçer (TS-004 Değişmez 2 ve 3): adres ve sır yalnız
// sunucuda okunur, her isteğe imzalı istemci adresi başlıkları eklenir, oturumlu istekte
// erişim çerezindeki belirteç Authorization başlığına konur.

// Ortam değişkenleri: değerleri depoya, hataya ve günlüğe yazılmaz.
const BACKEND_ADRESI = 'BACKEND_ADRESI';
const ARACI_KATMAN_SIRRI = 'ARACI_KATMAN_SIRRI';
const SIR_EN_AZ_UZUNLUK = 32;

export interface BackendIstegi {
  // '/' ile başlar; BACKEND_ADRESI'ne eklenir.
  readonly yol: string;
  readonly yontem: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly govde?: unknown;
  readonly oturumlu: boolean;
}

export type BackendSonucu =
  | { readonly basarili: true; readonly durum: number; readonly govde: unknown }
  | { readonly basarili: false; readonly hata: BackendHatasi };

function ortamDegiskeni(ad: string): string {
  const deger = process.env[ad];
  if (deger === undefined || deger === '') {
    throw new Error(`${ad} ortam değişkeni eksik`);
  }
  return deger;
}

// Ağ hatası ve JSON olmayan cevap; durum ağ hatasında 0'dır.
function ulasilamadi(durum: number): BackendSonucu {
  return {
    basarili: false,
    hata: {
      kod: 'ulasilamadi',
      ileti: 'Şu an ulaşılamıyor',
      ayrinti: null,
      durum,
    },
  };
}

export async function backendIstegi(
  istek: BackendIstegi,
): Promise<BackendSonucu> {
  const adres = ortamDegiskeni(BACKEND_ADRESI);
  const sir = ortamDegiskeni(ARACI_KATMAN_SIRRI);
  if (sir.length < SIR_EN_AZ_UZUNLUK) {
    throw new Error(
      `${ARACI_KATMAN_SIRRI} en az ${String(SIR_EN_AZ_UZUNLUK)} karakter olmalı`,
    );
  }

  // İstemci adresi x-forwarded-for başlığının ilk değeridir (TS-004 Yapı).
  const gelen = await headers();
  const basliklar: Record<string, string> = imzaBasliklari(sir, {
    adres: gelen.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
    tarayici: gelen.get('user-agent') ?? '',
    zaman: Date.now(),
  });
  if (istek.govde !== undefined) {
    basliklar['content-type'] = 'application/json';
  }
  if (istek.oturumlu) {
    const belirtec = await erisimBelirteciniOku();
    if (belirtec !== undefined) {
      basliklar['authorization'] = `Bearer ${belirtec}`;
    }
  }

  // Bozuk BACKEND_ADRESI yapılandırma hatasıdır; try dışında kurulur ki ağ hatasına karışmasın.
  const hedef = new URL(istek.yol, adres);
  let cevap: Response;
  try {
    cevap = await fetch(hedef, {
      method: istek.yontem,
      headers: basliklar,
      body: istek.govde === undefined ? null : JSON.stringify(istek.govde),
    });
  } catch {
    return ulasilamadi(0);
  }

  // Gövdesiz cevap (204 gibi) null gövdedir; JSON olmayan gövde ulaşılamadı sayılır.
  let govde: unknown = null;
  try {
    const metin = await cevap.text();
    if (metin !== '') {
      govde = JSON.parse(metin);
    }
  } catch {
    return ulasilamadi(cevap.status);
  }

  if (cevap.ok) {
    return { basarili: true, durum: cevap.status, govde };
  }
  return { basarili: false, hata: hataGovdesiniOku(govde, cevap.status) };
}
