// Çekirdek repository: oturum tablosuna yetki kapısından geçmeden erişir (KR-010 Seçim 48'in adıyla
// istisnası). Yalnız kimlik/_shared içindeki parçalar kullanır. Gerçeklemesi
// infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';
import type { KapatilmaNedeni } from '../kapatilma-nedeni.js';

export interface KapananOturum {
  id: string;
  kapatilmaZamani: Date;
}

export interface OturumCekirdekRepo {
  // Kişinin kapatılmamış bütün oturumlarını verilen nedenle kapatır ve kapananları döner.
  hepsiniKapat(
    kullaniciId: string,
    neden: KapatilmaNedeni,
  ): Promise<KapananOturum[]>;
}

export const OTURUM_CEKIRDEK_REPO = new RepoBelirteci<
  object,
  OturumCekirdekRepo
>('OturumCekirdekRepo');
