// İzinleri listele işinin işleyicisi (TS-002 "Uçlar ve izinler": Izin:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { ROL_OKUMA_REPO } from '../../../domain/repositories/i-rol.repository.js';
import { sayfala } from '../../_shared/liste.js';
import type { IzinListeleSorgusu } from './izin-listele.query.js';
import type { IzinListeleSonucu } from './izin-listele.result.js';

@Injectable()
export class IzinListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir(sorgu: IzinListeleSorgusu): Promise<IzinListeleSonucu> {
    return sayfala(sorgu, (siralama, sayfa) =>
      this.uow.read(ROL_OKUMA_REPO).izinler(siralama, sayfa),
    );
  }
}
