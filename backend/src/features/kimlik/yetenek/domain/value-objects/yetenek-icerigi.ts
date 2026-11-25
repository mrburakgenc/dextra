// Yetenek içeriği değer nesnesi: satırın kayıt ve kolon sınırının alan kuralı depoda yalnız burada
// yazılır (TS-005 Değişmez 2).
import { ret, type Sonuc, tamam } from '../../../../../shared/domain/sonuc.js';
import type { SartOgesi } from '../../../../../shared/kimlik/domain/i-yetki-verisi.contract.js';
import type { IcerikListesi } from './icerik-listesi.js';

// Sınır açık yazılır: işaret ya da içerik. Liste boş olamaz (içerik yoksa null); ikisi de yoksa satır
// saklanır ama kayıt ya da kolon vermez (KR-008 Seçim 5 ve 11; TS-002 değişmez 7).
export interface YetenekIcerigiAlanlari {
  readonly sart: IcerikListesi<SartOgesi> | null;
  readonly butunKayitlar: boolean;
  readonly butunBirimler: boolean;
  readonly kolonlar: IcerikListesi<string> | null;
  readonly butunKolonlar: boolean;
}

declare const yetenekIcerigiMarkasi: unique symbol;

// Kuraldan geçmiş içerik. Marka yalnız tiptedir; onu yalnız yetenekIcerigi() üretir.
export type YetenekIcerigi = YetenekIcerigiAlanlari & {
  readonly [yetenekIcerigiMarkasi]: true;
};

// Ret, kullanıcıya gösterilecek ileti değil, nedenin kodudur; iletiyi çağıran katman seçer.
export type YetenekIcerigiReddi =
  'butun_kayitlar_ve_sart' | 'butun_kolonlar_ve_kolonlar';

// İşaret içerikle birlikte yazılamaz. İki ret birlikte olabilir; hepsi bu sırayla döner.
export function yetenekIcerigi({
  sart,
  butunKayitlar,
  butunBirimler,
  kolonlar,
  butunKolonlar,
}: YetenekIcerigiAlanlari): Sonuc<
  YetenekIcerigi,
  readonly YetenekIcerigiReddi[]
> {
  const retler: YetenekIcerigiReddi[] = [];
  if (butunKayitlar && sart !== null) {
    retler.push('butun_kayitlar_ve_sart');
  }
  if (butunKolonlar && kolonlar !== null) {
    retler.push('butun_kolonlar_ve_kolonlar');
  }
  if (retler.length > 0) {
    return ret(retler);
  }
  return tamam({
    sart,
    butunKayitlar,
    butunBirimler,
    kolonlar,
    butunKolonlar,
  } as YetenekIcerigi);
}
