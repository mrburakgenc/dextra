import 'server-only';
import { headers } from 'next/headers';
import { erisimBelirteciniOku, yenilemeCerezleriVar } from '../oturum/cerezler';
import { type BackendHatasi, hataGovdesiniOku } from './hata';
import { imzaBasliklari } from './imza';

// Backend'e giden her istek buradan geçer (TS-004 Değişmez 2 ve 3): adres ve sır yalnız
// sunucuda okunur, her isteğe imzalı istemci adresi başlıkları eklenir, oturumlu istekte
// erişim çerezindeki belirteç Authorization başlığına konur.

// Ortam değişkenleri: değerleri depoya, hataya ve günlüğe yazılmaz.
const BACKEND_ADRESI = 'BACKEND_ADRESI';
const ARACI_KATMAN_SIRRI = 'ARACI_KATMAN_SIRRI';
const SIR_EN_AZ_UZUNLUK = 32;
// Backend cevap vermezse istek bu süre dolunca bırakılır ve ulaşılamadı sayılır.
const ISTEK_SURE_SINIRI_MS = 10_000;

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

export const ULASILAMIYOR = 'Şu an ulaşılamıyor';

// Ağ hatası, süre sınırının dolması ve JSON olmayan cevap; durum ağ hatasında ve cevap gelmeden süre dolunca 0'dır.
function ulasilamadi(durum: number): BackendSonucu {
  return {
    basarili: false,
    hata: {
      kod: 'ulasilamadi',
      ileti: ULASILAMIYOR,
      ayrinti: null,
      durum,
    },
  };
}

// Backend isteğinin çatıdan bağımsız kısmı; ara katman da bunu kullanır (orada next/headers
// çalışmaz). gelen: tarayıcıdan gelen isteğin başlıkları; belirtec varsa Authorization'a konur.
export async function backendCagrisi(
  istek: Omit<BackendIstegi, 'oturumlu'>,
  gelen: Pick<Headers, 'get'>,
  belirtec: string | undefined,
): Promise<BackendSonucu> {
  const adres = ortamDegiskeni(BACKEND_ADRESI);
  const sir = ortamDegiskeni(ARACI_KATMAN_SIRRI);
  if (sir.length < SIR_EN_AZ_UZUNLUK) {
    throw new Error(
      `${ARACI_KATMAN_SIRRI} en az ${String(SIR_EN_AZ_UZUNLUK)} karakter olmalı`,
    );
  }

  // Yol tek '/' ile başlar; '//' ile başlayan, şema taşıyan ya da başka kökene çözülen yol
  // belirteci ve imzalı başlıkları başka bir kökene götürebileceği için istek atılmadan
  // reddedilir (TS-004 "İlk ekranların sözleşmesi").
  if (!istek.yol.startsWith('/') || istek.yol.startsWith('//')) {
    throw new Error('Backend isteğinin yolu tek "/" ile başlamalı');
  }
  // Bozuk BACKEND_ADRESI yapılandırma hatasıdır; ağ hatasına karışmasın diye fetch'ten önce
  // kurulur. Çatının URL hatası adresi alanlarında taşır; bu yüzden yerine adı söyleyen
  // hata fırlatılır.
  let hedef: URL;
  let kok: URL;
  try {
    kok = new URL(adres);
    if (kok.protocol !== 'http:' && kok.protocol !== 'https:') {
      throw new Error();
    }
    hedef = new URL(istek.yol, kok);
  } catch {
    throw new TypeError(`${BACKEND_ADRESI} geçerli bir http(s) adresi değil`);
  }
  if (hedef.origin !== kok.origin) {
    throw new Error('Backend isteğinin yolu başka bir kökene çözülüyor');
  }

  // İstemci adresi x-forwarded-for başlığının ilk değeridir (TS-004 Yapı).
  const basliklar: Record<string, string> = imzaBasliklari(sir, {
    adres: gelen.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
    tarayici: gelen.get('user-agent') ?? '',
    zaman: Date.now(),
  });
  if (istek.govde !== undefined) {
    basliklar['content-type'] = 'application/json';
  }
  if (belirtec !== undefined) {
    basliklar['authorization'] = `Bearer ${belirtec}`;
  }

  let cevap: Response;
  try {
    cevap = await fetch(hedef, {
      method: istek.yontem,
      headers: basliklar,
      body: istek.govde === undefined ? null : JSON.stringify(istek.govde),
      signal: AbortSignal.timeout(ISTEK_SURE_SINIRI_MS),
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

// Oturumlu istek erişim çerezi yokken backend'e gitmez (TS-004 "Oturumun yenilenmesi"). Yenileme
// ve cihaz çerezi duruyorsa ara katman yenileyememiştir: ulaşılamadı döner, oturum bitti yoluna
// gidilmez ve çerezlere dokunulmaz. Yenilenebilir çift yoksa backend'in vereceği kimlik_gerekli
// sonucu döner; çağıran bugünkü gibi oturum bitti yoluna gider.
export async function backendIstegi(
  istek: BackendIstegi,
): Promise<BackendSonucu> {
  const { oturumlu, ...cagri } = istek;
  const belirtec = oturumlu ? await erisimBelirteciniOku() : undefined;
  if (oturumlu && belirtec === undefined) {
    if (await yenilemeCerezleriVar()) {
      return ulasilamadi(0);
    }
    return {
      basarili: false,
      hata: {
        kod: 'kimlik_gerekli',
        ileti: 'Kimlik doğrulanamadı',
        ayrinti: null,
        durum: 401,
      },
    };
  }
  return backendCagrisi(cagri, await headers(), belirtec);
}
