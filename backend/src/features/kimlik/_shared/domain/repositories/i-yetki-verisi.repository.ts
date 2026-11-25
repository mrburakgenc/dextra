// Çekirdek repository: yetki verisini ve sürümleri yetki kapısından geçmeden okur (TS-002 "Çekirdek
// yollar": yetki verisinin ve sürümlerin okunması; KR-010 Seçim 48'in adıyla istisnası). Yalnız
// okur. Gerçeklemesi infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';
import type {
  UyelikSatiri,
  YetenekSatiri,
  YetkiSurumleri,
} from '../../../../../shared/kimlik/domain/i-yetki-verisi.contract.js';

export interface GrupDugumu {
  readonly id: string;
  readonly ustGrupId: string | null;
}

// Saklandığı gibi okunan yetenek: şartın biçimi henüz doğrulanmamıştır (TS-002 AK-37).
export type SaklananYetenek = Omit<YetenekSatiri, 'sart'> & {
  readonly sart: unknown;
};

export interface YetkiVerisiOkumaRepo {
  // Kişi ya da genel sayaç satırı yoksa Prisma'nın "kayıt yok" hatası atılır.
  surumler(kullaniciId: string): Promise<YetkiSurumleri>;
  // Kişinin silinmemiş üyelikleri.
  uyelikler(kullaniciId: string): Promise<UyelikSatiri[]>;
  // Verilen (grup, rol) çiftlerinden birine bağlı silinmemiş yetenekler, izniyle (KR-008 Seçim 44:
  // grup ve rol aynı üyelikten gelir). Boş şart null saklanır ve null döner.
  yetenekler(
    ciftler: readonly Pick<UyelikSatiri, 'grupId' | 'rolId'>[],
  ): Promise<SaklananYetenek[]>;
  // Silinmişler dahil grupların tamamı (KR-008 Seçim 41); alt gruplar bellekte hesaplanır.
  gruplar(): Promise<GrupDugumu[]>;
}

export const YETKI_VERISI_REPO = new RepoBelirteci<
  YetkiVerisiOkumaRepo,
  YetkiVerisiOkumaRepo
>('YetkiVerisiRepo');
