// Rolleri listele işinin işleyicisi (TS-002 "Uçlar ve izinler": Rol:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { ROL_OKUMA_REPO } from '../../../domain/repositories/i-rol.repository.js';
import { sayfala } from '../../_shared/liste.js';
import type { RolListeleSorgusu } from './rol-listele.query.js';
import type { RolListeleSonucu } from './rol-listele.result.js';

@Injectable()
export class RolListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir(sorgu: RolListeleSorgusu): Promise<RolListeleSonucu> {
    return sayfala(sorgu, (siralama, sayfa) =>
      this.uow.read(ROL_OKUMA_REPO).roller(siralama, sayfa),
    );
  }
}
