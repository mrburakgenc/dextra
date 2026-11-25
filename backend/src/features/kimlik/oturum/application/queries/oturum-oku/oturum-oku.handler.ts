// Oturumu oku işinin işleyicisi (TS-002 "Uçlar ve izinler": Oturum:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { OTURUM_YONETIM_OKUMA_REPO } from '../../../domain/repositories/i-oturum-yonetim.repository.js';
import type { OturumOkuSorgusu } from './oturum-oku.query.js';
import type { OturumOkuSonucu } from './oturum-oku.result.js';

// Tek oturum kaydı; bulunamayan ya da görülemeyen kayıt bulunamadi (TS-002 AK-39, AK-51).
@Injectable()
export class OturumOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir({ id }: OturumOkuSorgusu): Promise<OturumOkuSonucu> {
    return this.uow.read(OTURUM_YONETIM_OKUMA_REPO).tek(id);
  }
}
