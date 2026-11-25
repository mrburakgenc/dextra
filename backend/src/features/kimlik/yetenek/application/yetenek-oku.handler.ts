import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { YETENEK_REPO } from '../domain/yetenek.repository.js';

// Tek yetenek kaydı; bulunamayan ya da görülemeyen kayıt bulunamadi (TS-002 AK-39).
@Injectable()
export class YetenekOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir(id: string): Promise<Kayit> {
    return this.uow.read(YETENEK_REPO).tek(id);
  }
}
