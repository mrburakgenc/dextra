import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { OTURUM_YONETIM_REPO } from '../domain/oturum-yonetim.repository.js';

// Tek oturum kaydı; bulunamayan ya da görülemeyen kayıt bulunamadi (TS-002 AK-39, AK-51).
@Injectable()
export class OturumOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir(id: string): Promise<Kayit> {
    return this.uow.read(OTURUM_YONETIM_REPO).tek(id);
  }
}
