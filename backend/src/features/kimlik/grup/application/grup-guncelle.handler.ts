import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import { GrupYazmaRepo } from '../domain/grup.repository.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-guncelle';

// Grubun adını değiştir (TS-002 "İşlem sınırları"; AK-39). Tek işlemde: genel sayaç satırı kilitlenir
// ve artırılır; ad yetki kapısından (Grup:guncelle yeteneğiyle) yazılır. Üst grup burada değişmez,
// yalnız "taşı" işiyle değişir. Olay yazılmaz (AK-39).
@Injectable()
export class GrupGuncelleHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: GrupYazmaRepo,
    private readonly genelSayac: GenelSayac,
  ) {}

  calistir(id: string, ad: string): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      await this.repo.adiniDegistir(islem, IS_ADI, id, ad);
    });
  }
}
