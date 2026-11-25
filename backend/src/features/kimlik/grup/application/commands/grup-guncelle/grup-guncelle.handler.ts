// Grubun adını değiştir işinin işleyicisi (TS-002 "İşlem sınırları"; AK-39).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import {
  GRUP_YAZMA_REPO,
  type IGrupYazmaRepo,
} from '../../../domain/repositories/i-grup.repository.js';
import type { GrupGuncelleKomutu } from './grup-guncelle.command.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-guncelle';

// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır; ad yetki kapısından (Grup:guncelle
// yeteneğiyle) yazılır. Üst grup burada değişmez, yalnız "taşı" işiyle değişir. Olay yazılmaz (AK-39).
@Injectable()
export class GrupGuncelleHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    @Inject(GRUP_YAZMA_REPO) private readonly yazma: IGrupYazmaRepo,
  ) {}

  calistir({ id, ad }: GrupGuncelleKomutu): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      await this.yazma.adiniDegistir(islem, IS_ADI, id, ad);
    });
  }
}
