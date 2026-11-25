// Üyeliği oku işinin işleyicisi (TS-002 AK-39; "Uçlar ve izinler": Uyelik:oku). Bulunamayan ya da
// görülemeyen kayıt bulunamadi alır.
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { UYELIK_OKUMA_REPO } from '../../../domain/repositories/i-uyelik.repository.js';
import type { UyelikOkuSorgusu } from './uyelik-oku.query.js';
import type { UyelikOkuSonucu } from './uyelik-oku.result.js';

@Injectable()
export class UyelikOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir({ id }: UyelikOkuSorgusu): Promise<UyelikOkuSonucu> {
    return this.uow.read(UYELIK_OKUMA_REPO).tek(id);
  }
}
