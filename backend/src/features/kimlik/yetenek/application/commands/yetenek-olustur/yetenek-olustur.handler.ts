// Yetenek yaz işinin işleyicisi (TS-002 "İşlem sınırları", AK-39; KR-008 Seçim 5, 7, 11, 17, 21, 34).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import {
  type IYetenekYazmaRepo,
  YETENEK_YAZMA_REPO,
} from '../../../domain/repositories/i-yetenek.repository.js';
import { YetenekYazimi } from '../../_shared/yetenek-yazimi.js';
import type { YetenekOlusturKomutu } from './yetenek-olustur.command.js';
import type { YetenekOlusturSonucu } from './yetenek-olustur.result.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:yetenek-olustur';

// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır; satır yazma kararından geçer (grup ve rol
// canlılığı, izin, kolonlar, şartın derlenmesi, korunan kaynak); satır yetki kapısından
// (Yetenek:olustur yeteneğiyle) yazılır. Olay yazılmaz (AK-39).
@Injectable()
export class YetenekOlusturHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly yazim: YetenekYazimi,
    @Inject(YETENEK_YAZMA_REPO) private readonly yazma: IYetenekYazmaRepo,
  ) {}

  calistir({
    grupId,
    rolId,
    izinId,
    icerik,
  }: YetenekOlusturKomutu): Promise<YetenekOlusturSonucu> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const yetenek = await this.yazim.kur(
        islem,
        { grupId, rolId, izinId },
        icerik,
      );
      return { id: await this.yazma.olustur(islem, IS_ADI, yetenek) };
    });
  }
}
