import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { UYELIK_REPO } from '../domain/uyelik.repository.js';

// Tek üyelik kaydı; bulunamayan ya da görülemeyen kayıt bulunamadi (TS-002 AK-39).
@Injectable()
export class UyelikOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir(id: string): Promise<Kayit> {
    return this.uow.read(UYELIK_REPO).tek(id);
  }
}
