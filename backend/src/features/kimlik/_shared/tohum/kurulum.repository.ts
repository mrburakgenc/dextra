// Çekirdek repository: ilk kurulum göçünün genel sayaç, grup, rol, izin ve yetenek satırlarını yetki
// kapısından geçmeden yazar (KR-010 Seçim 48'in adıyla istisnası; "tohum" çekirdek parçası).
// Kullanıcı ve üyelik yazmaz; onları tohum yardımcısı yazar. Yalnız kurulum göçü kullanır.
import {
  RepoBelirteci,
  type RepoIstemcisi,
} from '../../../../shared/database/registrar.js';
import type { SartOgesi } from '../../../../shared/kimlik/yetki-verisi.contract.js';

// Genel sayaç tek satırdır; kimliği yalnız 1 olabilir (yetki_surumu_tek_satir_denetim).
const GENEL_SAYAC_ID = 1;

export interface YeniYetenek {
  id: string;
  grupId: string;
  rolId: string;
  izinId: string;
  // Boşsa kolon boş kalır (bütün kayıtlar işaretiyle birlikte yazılamaz).
  sart: readonly SartOgesi[] | null;
  butunKayitlar: boolean;
  butunBirimler: boolean;
  butunKolonlar: boolean;
  sistemSatiri: boolean;
  tohumAnahtari: string;
  koken: 'goc';
}

export interface KurulumRepo {
  // Genel sayaç satırını yazar (sayaç veritabanının varsayılanıyla 0); satır varsa birincil
  // anahtar reddeder.
  genelSayacEkle(): Promise<void>;
  grupEkle(grup: {
    id: string;
    ad: string;
  }): Promise<{ olusturmaZamani: Date }>;
  rolEkle(rol: { id: string; kod: string; ad: string }): Promise<void>;
  izinEkle(izin: { id: string; kaynak: string; eylem: string }): Promise<void>;
  // Kolon dizisi yazılmaz, boş kalır (bütün kolonlar işaretiyle birlikte yazılamaz).
  yetenekEkle(yetenek: YeniYetenek): Promise<{ olusturmaZamani: Date }>;
}

// Okuma görünümü boştur: kurulum göçü işlem dışında okumaz.
export const KURULUM_REPO = new RepoBelirteci<object, KurulumRepo>(
  'KurulumRepo',
);

export function kurulumRepo(istemci: RepoIstemcisi): KurulumRepo {
  return {
    genelSayacEkle: async () => {
      await istemci.yetkiSurumu.create({ data: { id: GENEL_SAYAC_ID } });
    },
    grupEkle: (grup) =>
      istemci.grup.create({ data: grup, select: { olusturmaZamani: true } }),
    rolEkle: async (rol) => {
      await istemci.rol.create({ data: rol, select: { id: true } });
    },
    izinEkle: async (izin) => {
      await istemci.izin.create({ data: izin, select: { id: true } });
    },
    yetenekEkle: ({ sart, ...yetenek }) =>
      istemci.yetenek.create({
        data: {
          ...yetenek,
          ...(sart !== null && {
            sart: sart.map(({ alan, islec, deger }) => ({
              alan,
              islec,
              deger,
            })),
          }),
        },
        select: { olusturmaZamani: true },
      }),
  };
}
