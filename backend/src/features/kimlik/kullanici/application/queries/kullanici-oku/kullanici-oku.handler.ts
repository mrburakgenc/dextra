// Kullanıcıyı oku işinin işleyicisi (TS-002 AK-39; izin Kullanici:oku): tek kullanıcı kaydı;
// bulunamayan ya da görülemeyen kayıt bulunamadi.
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { KULLANICI_OKUMA_REPO } from '../../../domain/repositories/i-kullanici.repository.js';
import type { KullaniciOkuSorgusu } from './kullanici-oku.query.js';
import type { KullaniciOkuSonucu } from './kullanici-oku.result.js';

@Injectable()
export class KullaniciOkuHandler {
  constructor(private readonly uow: UnitOfWork) {}

  calistir({ id }: KullaniciOkuSorgusu): Promise<KullaniciOkuSonucu> {
    return this.uow.read(KULLANICI_OKUMA_REPO).tek(id);
  }
}
