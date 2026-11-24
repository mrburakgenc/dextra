import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import type { Kayit } from '../../../../shared/yetki/okuma-kapisi.js';
import { KULLANICI_REPO } from '../domain/kullanici.repository.js';

// Tek kullanıcı kaydı; bulunamayan ya da görülemeyen kayıt bulunamadi (TS-002 AK-39).
@Injectable()
export class KullaniciOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir(id: string): Promise<Kayit> {
    return this.uow.read(KULLANICI_REPO).tek(id);
  }
}
