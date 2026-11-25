// Yeteneği oku işinin işleyicisi (TS-002 AK-39; "Uçlar ve izinler": Yetenek:oku). Görülemeyen ya da
// var olmayan kayıt bulunamadi alır.
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { YETENEK_REPO } from '../../../domain/repositories/i-yetenek.repository.js';
import type { YetenekOkuSorgusu } from './yetenek-oku.query.js';
import type { YetenekOkuSonucu } from './yetenek-oku.result.js';

@Injectable()
export class YetenekOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir({ id }: YetenekOkuSorgusu): Promise<YetenekOkuSonucu> {
    return this.uow.read(YETENEK_REPO).tek(id);
  }
}
