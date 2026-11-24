import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { errors, jwtVerify, SignJWT, type JWTPayload } from 'jose';

// Belirteçler (TS-002 AK-6; KR-009 Seçim 12): jose ile RS256 imzalı iki tür belirteç.
// Erişim belirteci kullanıcıyı ve oturumu, yenileme belirteci ayrıca nesli taşır;
// ikisi de türünü `tur` alanında taşır ve biri öbürünün yerine kabul edilmez.

export const ERISIM_BELIRTECI_SURESI_SN = 15 * 60;
export const YENILEME_BELIRTECI_SURESI_SN = 7 * 24 * 60 * 60;

// Ortam değişkenleri: imzalama için RSA özel anahtarı ve doğrulama için açık anahtar,
// ikisi de PEM. Değerleri depoya yazılmaz.
export const OZEL_ANAHTAR_DEGISKENI = 'KIMLIK_IMZA_OZEL_ANAHTAR';
export const ACIK_ANAHTAR_DEGISKENI = 'KIMLIK_IMZA_ACIK_ANAHTAR';

const ALGORITMA = 'RS256';
// İmza anahtarının en küçük boyu (TS-002 AK-28).
export const EN_AZ_ANAHTAR_BITI = 2048;

export type BelirtecTuru = 'erisim' | 'yenileme';

export interface ErisimIcerigi {
  readonly kullaniciId: string;
  readonly oturumId: string;
}

export interface YenilemeIcerigi extends ErisimIcerigi {
  readonly nesil: number;
}

export type GecersizlikNedeni = 'imza' | 'sure' | 'tur' | 'bicim';

interface Gecersiz {
  readonly gecerli: false;
  readonly neden: GecersizlikNedeni;
}

export type DogrulamaSonucu<T> =
  { readonly gecerli: true; readonly icerik: T } | Gecersiz;

type Ortam = Readonly<Record<string, string | undefined>>;

function anahtarOku(
  ortam: Ortam,
  degisken: string,
  oku: (pem: string) => KeyObject,
): KeyObject {
  const pem = ortam[degisken];
  if (pem === undefined || pem.trim() === '') {
    throw new Error(
      `${degisken} ortam değişkeni eksik (PEM biçiminde RSA anahtarı beklenir)`,
    );
  }
  let anahtar: KeyObject;
  try {
    anahtar = oku(pem);
  } catch (hata) {
    throw new Error(
      `${degisken} okunamadı: PEM biçiminde RSA anahtarı beklenir`,
      {
        cause: hata,
      },
    );
  }
  if (anahtar.asymmetricKeyType !== 'rsa') {
    throw new Error(`${degisken} bir RSA anahtarı değil`);
  }
  return anahtar;
}

export class BelirtecServisi {
  private readonly ozelAnahtar: KeyObject;
  private readonly acikAnahtar: KeyObject;

  // Anahtarlar kurulurken okunur; eksik ya da bozuk anahtar burada hata verir. Özel anahtar en az
  // 2048 bit olmalı ve açık anahtar onun çifti olmalıdır (AK-28); hata anahtarın içeriğini taşımaz.
  constructor(ortam: Ortam) {
    this.ozelAnahtar = anahtarOku(
      ortam,
      OZEL_ANAHTAR_DEGISKENI,
      createPrivateKey,
    );
    this.acikAnahtar = anahtarOku(
      ortam,
      ACIK_ANAHTAR_DEGISKENI,
      createPublicKey,
    );
    const bit = this.ozelAnahtar.asymmetricKeyDetails?.modulusLength ?? 0;
    if (bit < EN_AZ_ANAHTAR_BITI) {
      throw new Error(
        `${OZEL_ANAHTAR_DEGISKENI} en az ${String(EN_AZ_ANAHTAR_BITI)} bit olmalı; ${String(bit)} bit`,
      );
    }
    if (!createPublicKey(this.ozelAnahtar).equals(this.acikAnahtar)) {
      throw new Error(
        `${OZEL_ANAHTAR_DEGISKENI} ile ${ACIK_ANAHTAR_DEGISKENI} bir anahtar çifti değil`,
      );
    }
  }

  erisimBelirteciUret(icerik: ErisimIcerigi): Promise<string> {
    return this.imzala(
      { oturum: icerik.oturumId, tur: 'erisim' },
      icerik.kullaniciId,
      ERISIM_BELIRTECI_SURESI_SN,
    );
  }

  yenilemeBelirteciUret(icerik: YenilemeIcerigi): Promise<string> {
    return this.imzala(
      { oturum: icerik.oturumId, nesil: icerik.nesil, tur: 'yenileme' },
      icerik.kullaniciId,
      YENILEME_BELIRTECI_SURESI_SN,
    );
  }

  async erisimBelirteciDogrula(
    belirtec: string,
  ): Promise<DogrulamaSonucu<ErisimIcerigi>> {
    const sonuc = await this.dogrula(belirtec, 'erisim');
    if (!('yuk' in sonuc)) return sonuc;
    const { sub, oturum } = sonuc.yuk;
    if (typeof sub !== 'string' || typeof oturum !== 'string') {
      return { gecerli: false, neden: 'bicim' };
    }
    return { gecerli: true, icerik: { kullaniciId: sub, oturumId: oturum } };
  }

  async yenilemeBelirteciDogrula(
    belirtec: string,
  ): Promise<DogrulamaSonucu<YenilemeIcerigi>> {
    const sonuc = await this.dogrula(belirtec, 'yenileme');
    if (!('yuk' in sonuc)) return sonuc;
    const { sub, oturum, nesil } = sonuc.yuk;
    if (
      typeof sub !== 'string' ||
      typeof oturum !== 'string' ||
      typeof nesil !== 'number' ||
      !Number.isSafeInteger(nesil)
    ) {
      return { gecerli: false, neden: 'bicim' };
    }
    return {
      gecerli: true,
      icerik: { kullaniciId: sub, oturumId: oturum, nesil },
    };
  }

  private imzala(
    yuk: JWTPayload,
    kullaniciId: string,
    sureSn: number,
  ): Promise<string> {
    return new SignJWT(yuk)
      .setProtectedHeader({ alg: ALGORITMA })
      .setSubject(kullaniciId)
      .setIssuedAt()
      .setExpirationTime(`${String(sureSn)}s`)
      .sign(this.ozelAnahtar);
  }

  // İmza, algoritma ve süre jose'de denetlenir; tür burada. Hata atılmaz, neden döner.
  private async dogrula(
    belirtec: string,
    tur: BelirtecTuru,
  ): Promise<{ readonly yuk: JWTPayload } | Gecersiz> {
    let yuk: JWTPayload;
    try {
      ({ payload: yuk } = await jwtVerify(belirtec, this.acikAnahtar, {
        algorithms: [ALGORITMA],
      }));
    } catch (hata) {
      return { gecerli: false, neden: nedenBul(hata) };
    }
    if (yuk['tur'] !== tur) return { gecerli: false, neden: 'tur' };
    return { yuk };
  }
}

function nedenBul(hata: unknown): GecersizlikNedeni {
  if (hata instanceof errors.JWTExpired) return 'sure';
  // İmzasız (alg none) ya da RS256 dışı algoritmayla gelen belirteç imza nedeniyle reddedilir.
  if (
    hata instanceof errors.JWSSignatureVerificationFailed ||
    hata instanceof errors.JOSEAlgNotAllowed
  ) {
    return 'imza';
  }
  if (hata instanceof errors.JOSEError) return 'bicim';
  throw hata;
}
