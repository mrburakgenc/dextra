import { createHmac, timingSafeEqual } from 'node:crypto';

// İstemci adresi imzası (TS-002 AK-8; KR-009 Kural 9): aracı katman istemcinin adresini,
// tarayıcı bilgisini ve zaman damgasını paylaşılan sırla HMAC-SHA256 ile imzalayıp başlıkta verir.

export const ISTEMCI_BASLIKLARI = {
  adres: 'x-istemci-adresi',
  tarayici: 'x-istemci-tarayici',
  zaman: 'x-istemci-zaman',
  imza: 'x-istemci-imza',
} as const;

// Ortam değişkeni: aracı katmanla paylaşılan HMAC sırrı (en az 32 karakter). Değeri depoya yazılmaz.
export const ARACI_KATMAN_SIRRI_DEGISKENI = 'ARACI_KATMAN_SIRRI';
export const ARACI_KATMAN_SIRRI_EN_AZ_UZUNLUK = 32;
// Zaman damgası şimdiden en çok bu kadar eski ya da ileride olabilir.
export const IMZA_PENCERESI_MS = 60_000;

export interface IstemciAlanlari {
  readonly adres: string;
  readonly tarayici: string;
  // Unix zamanı, milisaniye (Date.now()).
  readonly zaman: number;
}

export type AdresGecersizlikNedeni = 'eksik' | 'bicim' | 'imza' | 'zaman';

export type AdresDogrulamaSonucu =
  | { readonly gecerli: true; readonly istemci: IstemciAlanlari }
  | { readonly gecerli: false; readonly neden: AdresGecersizlikNedeni };

// İmzalanan metnin tek tanımı. Alanlar şu sırayla, aralarına "\n" (LF) konarak birleştirilir:
//   adres + "\n" + tarayici + "\n" + zaman
// zaman ondalık tamsayı yazımıdır (milisaniye; baştaki sıfır yok). Metin UTF-8 olarak imzalanır;
// imza küçük harfli onaltılık (64 karakter) yazılır. HTTP başlık değeri LF taşıyamadığı için
// ayırıcı alanlar arasında belirsizlik doğurmaz.
function imzaMetni(alanlar: IstemciAlanlari): string {
  return [alanlar.adres, alanlar.tarayici, String(alanlar.zaman)].join('\n');
}

export function istemciImzasiUret(
  sir: string,
  alanlar: IstemciAlanlari,
): string {
  return createHmac('sha256', sir)
    .update(imzaMetni(alanlar), 'utf8')
    .digest('hex');
}

type Basliklar = Readonly<Record<string, string | string[] | undefined>>;

export class IstemciAdresiDogrulayici {
  private readonly sir: string;

  // Sır kurulurken okunur; eksik ya da kısa sır burada hata verir.
  constructor(ortam: Readonly<Record<string, string | undefined>>) {
    const sir = ortam[ARACI_KATMAN_SIRRI_DEGISKENI];
    if (sir === undefined || sir === '') {
      throw new Error(`${ARACI_KATMAN_SIRRI_DEGISKENI} ortam değişkeni eksik`);
    }
    if (sir.length < ARACI_KATMAN_SIRRI_EN_AZ_UZUNLUK) {
      throw new Error(
        `${ARACI_KATMAN_SIRRI_DEGISKENI} en az ${String(ARACI_KATMAN_SIRRI_EN_AZ_UZUNLUK)} karakter olmalı`,
      );
    }
    this.sir = sir;
  }

  // Hata atmaz; geçerliyse imzalı alanları, değilse nedeni döner.
  dogrula(basliklar: Basliklar): AdresDogrulamaSonucu {
    const adres = basliklar[ISTEMCI_BASLIKLARI.adres];
    const tarayici = basliklar[ISTEMCI_BASLIKLARI.tarayici];
    const zamanYazisi = basliklar[ISTEMCI_BASLIKLARI.zaman];
    const imza = basliklar[ISTEMCI_BASLIKLARI.imza];
    if (
      typeof adres !== 'string' ||
      typeof tarayici !== 'string' ||
      typeof zamanYazisi !== 'string' ||
      typeof imza !== 'string'
    ) {
      return { gecerli: false, neden: 'eksik' };
    }
    if (!/^(0|[1-9][0-9]{0,15})$/.test(zamanYazisi)) {
      return { gecerli: false, neden: 'bicim' };
    }
    const zaman = Number(zamanYazisi);
    if (!Number.isSafeInteger(zaman)) {
      return { gecerli: false, neden: 'bicim' };
    }
    const alanlar: IstemciAlanlari = { adres, tarayici, zaman };
    const beklenen = Buffer.from(istemciImzasiUret(this.sir, alanlar), 'utf8');
    const gelen = Buffer.from(imza, 'utf8');
    // Uzunluk gizli değildir (her zaman 64); eşit uzunlukta karşılaştırma sabit sürelidir.
    if (gelen.length !== beklenen.length || !timingSafeEqual(gelen, beklenen)) {
      return { gecerli: false, neden: 'imza' };
    }
    if (Math.abs(Date.now() - zaman) > IMZA_PENCERESI_MS) {
      return { gecerli: false, neden: 'zaman' };
    }
    return { gecerli: true, istemci: alanlar };
  }
}
