// Grupları listele işinin işleyicisi (TS-002 AK-39; "Uçlar ve izinler": Grup:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { GRUP_OKUMA_REPO } from '../../../domain/repositories/i-grup.repository.js';
import type { GrupListeleSorgusu } from './grup-listele.query.js';
import type { GrupListeleSonucu } from './grup-listele.result.js';

// Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class GrupListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    sirala,
    ustGrupId,
  }: GrupListeleSorgusu): Promise<GrupListeleSonucu> {
    const kayitlar = await this.uow.read(GRUP_OKUMA_REPO).liste({
      ...(ustGrupId === undefined ? {} : { ustGrupId }),
      ...(sirala === undefined ? {} : { siralama: sirala }),
      atla: (sayfa - 1) * boyut,
      al: boyut + 1,
    });
    return {
      kayitlar: kayitlar.slice(0, boyut),
      sayfa,
      boyut,
      sonrakiVar: kayitlar.length > boyut,
    };
  }
}
