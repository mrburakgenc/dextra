// Grubu oku işinin işleyicisi (TS-002 AK-39; "Uçlar ve izinler": Grup:oku). Bulunamayan ya da
// görülemeyen kayıt bulunamadi alır.
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { GRUP_OKUMA_REPO } from '../../../domain/repositories/i-grup.repository.js';
import type { GrupOkuSorgusu } from './grup-oku.query.js';
import type { GrupOkuSonucu } from './grup-oku.result.js';

@Injectable()
export class GrupOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir({ id }: GrupOkuSorgusu): Promise<GrupOkuSonucu> {
    return this.uow.read(GRUP_OKUMA_REPO).tek(id);
  }
}
