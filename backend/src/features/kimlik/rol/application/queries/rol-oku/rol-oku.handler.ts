// Rolü oku işinin işleyicisi (TS-002 "Uçlar ve izinler": Rol:oku). Silinmiş rol de okunur; görülemeyen
// ya da var olmayan rol bulunamadi alır.
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { ROL_OKUMA_REPO } from '../../../domain/repositories/i-rol.repository.js';
import type { RolOkuSorgusu } from './rol-oku.query.js';
import type { RolOkuSonucu } from './rol-oku.result.js';

@Injectable()
export class RolOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir({ id }: RolOkuSorgusu): Promise<RolOkuSonucu> {
    return this.uow.read(ROL_OKUMA_REPO).rol(id);
  }
}
