// Yetenek teşhisinin repository arayüzü ve belirteci (TS-008 "Yönetim, izinler ve teşhis"; kapanan
// AU-32). Gerçeklemesi infrastructure/repositories altındadır. Okumalar yetki kapısından, isteyenin okuma
// yeteneğiyle geçer; yetki kapısından geçmeyen okuma yoktur.
import { RepoBelirteci } from '../../../../../shared/database/domain/repo-belirteci.js';
import type { Teshis } from '../../../../../shared/yetki/domain/okuma-tipleri.js';

export interface TeshisIstegi {
  // Teşhis edilen kişi.
  readonly kullaniciId: string;
  readonly kaynak: string;
  readonly eylem: string;
  readonly kayitId: string;
}

export interface IYetenekTeshisRepo {
  // Kaynak ve eylem isteyenin görebildiği izin kataloğunda yoksa dogrulama_hatasi; isteyen kişiyi ya da
  // kaydı göremiyorsa (ya da yoksa) bulunamadi.
  teshis(istek: TeshisIstegi): Promise<Teshis>;
}

export const YETENEK_TESHIS_REPO = new RepoBelirteci<
  IYetenekTeshisRepo,
  IYetenekTeshisRepo
>('IYetenekTeshisRepo');
