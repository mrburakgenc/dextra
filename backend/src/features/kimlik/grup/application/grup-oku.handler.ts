import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { GRUP_REPO } from '../domain/grup.repository.js';

// Tek grup kaydı; bulunamayan ya da görülemeyen kayıt bulunamadi (TS-002 AK-39).
@Injectable()
export class GrupOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir(id: string): Promise<Kayit> {
    return this.uow.read(GRUP_REPO).tek(id);
  }
}
