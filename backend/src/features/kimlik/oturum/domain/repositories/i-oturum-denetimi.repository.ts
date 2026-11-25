// Oturum denetiminin repository arayüzleri ve belirteci: oturum, kullanici ve yetki_surumu tablolarına
// yetki kapısından geçmeden erişir. Oturum denetimi bir çekirdek yoldur (TS-002 "Çekirdek yollar";
// KR-010 Seçim 48'in adıyla istisnası); gerçeklemesi infrastructure/repositories altındadır.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';
import type { DenetimSatiri } from '../entities/oturum.entity.js';

export interface IOturumDenetimiOkumaRepo {
  // Tek deyimle okunur (KR-010 Seçim 49). Oturum ya da genel sayaç satırı yoksa null.
  oku(oturumId: string): Promise<DenetimSatiri | null>;
  // Kimlik feature'ının sistem aktörü (TS-002 AK-2); hiç ya da birden çok satır varsa hata atılır.
  kimlikSistemAktoru(): Promise<string>;
}

export interface IOturumDenetimiRepo extends IOturumDenetimiOkumaRepo {
  // Oturum kapatılmamışsa adres_degisti nedeniyle kapatır; kapattıysa true döner.
  adresleKapat(oturumId: string, kapatilmaZamani: Date): Promise<boolean>;
}

export const OTURUM_DENETIMI_REPO = new RepoBelirteci<
  IOturumDenetimiOkumaRepo,
  IOturumDenetimiRepo
>('IOturumDenetimiRepo');
