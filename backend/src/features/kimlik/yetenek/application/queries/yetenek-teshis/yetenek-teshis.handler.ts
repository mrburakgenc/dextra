// Yetenek teşhisi işinin işleyicisi (TS-008 "Yönetim, izinler ve teşhis"; kapanan AU-14, AU-19 ve AU-32;
// Yetenek:teshis). Kuralları ve kararı repository, kişinin son ret kayıtlarını ortak koddaki okuyucu
// verir; ret kayıtları yalnız teşhis verildiyse okunur.
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { RetKaydiOkuyucu } from '../../../../../../shared/observability/erisim/ret-kaydi.js';
import { YETENEK_TESHIS_REPO } from '../../../domain/repositories/i-yetenek-teshis.repository.js';
import type { YetenekTeshisSorgusu } from './yetenek-teshis.query.js';
import type { YetenekTeshisSonucu } from './yetenek-teshis.result.js';

// Cevaba giren ret kaydı sayısı (kapanan AU-32).
const RET_KAYDI_SAYISI = 20;

@Injectable()
export class YetenekTeshisHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly retler: RetKaydiOkuyucu,
  ) {}

  async calistir(sorgu: YetenekTeshisSorgusu): Promise<YetenekTeshisSonucu> {
    const teshis = await this.uow.read(YETENEK_TESHIS_REPO).teshis(sorgu);
    return {
      ...teshis,
      retKayitlari: await this.retler.sonRetler(
        sorgu.kullaniciId,
        RET_KAYDI_SAYISI,
      ),
    };
  }
}
