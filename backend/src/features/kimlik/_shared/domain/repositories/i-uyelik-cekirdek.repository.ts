// Çekirdek repository: uyelik tablosuna yetenek satırı olmadan yazar ve kök kümeyi okur (KR-010
// Seçim 48'in adıyla istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır. Gerçeklemesi
// infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/registrar.js';

export interface YeniUyelik {
  id: string;
  kullaniciId: string;
  grupId: string;
  rolId: string;
}

export interface KapananUyelik {
  id: string;
  silinmeZamani: Date;
}

export interface UyelikCekirdekRepo {
  // Kök grubun (üstü olmayan, silinmemiş tek grup) ve temel rolün kimlikleri; biri yoksa Prisma'nın
  // "kayıt yok" hatası atılır.
  kokKume(): Promise<{ grupId: string; rolId: string }>;
  // Üyeliği yazar; aynı kişide aynı (grup, rol) canlıysa tekil kısıt reddeder (P2002, cakisma).
  ekle(uyelik: YeniUyelik): Promise<{ olusturmaZamani: Date }>;
  // Kişinin bütün canlı üyeliklerine silinme zamanı yazar ve kapananları döner.
  hepsiniKapat(kullaniciId: string): Promise<KapananUyelik[]>;
}

export const UYELIK_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  UyelikCekirdekRepo
>('UyelikCekirdekRepo');
