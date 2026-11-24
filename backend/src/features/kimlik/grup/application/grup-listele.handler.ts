import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { GRUP_REPO } from '../domain/grup.repository.js';
import type {
  GrupListeleSorgusu,
  GrupListesi,
} from './grup-listele.query.js';

// Grup listesi (TS-002 AK-39). Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek
// anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class GrupListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    siralama,
    ustGrupId,
  }: GrupListeleSorgusu): Promise<GrupListesi> {
    const kayitlar = await this.uow.read(GRUP_REPO).liste({
      ...(ustGrupId === undefined ? {} : { ustGrupId }),
      ...(siralama === undefined ? {} : { siralama }),
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
