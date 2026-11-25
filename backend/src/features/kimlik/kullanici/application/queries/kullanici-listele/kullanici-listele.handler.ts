// Kullanıcıları listele işinin işleyicisi (TS-002 AK-39; izin Kullanici:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { KULLANICI_OKUMA_REPO } from '../../../domain/repositories/i-kullanici.repository.js';
import type { KullaniciListeleSorgusu } from './kullanici-listele.query.js';
import type { KullaniciListeleSonucu } from './kullanici-listele.result.js';

// Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class KullaniciListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    sirala,
    pasif,
  }: KullaniciListeleSorgusu): Promise<KullaniciListeleSonucu> {
    const kayitlar = await this.uow.read(KULLANICI_OKUMA_REPO).liste({
      ...(pasif === undefined ? {} : { pasif }),
      ...(sirala === undefined ? {} : { siralama: sirala }),
      atla: (sayfa - 1) * boyut,
      al: boyut + 1,
    });
    return {
      kayitlar: kayitlar.slice(0, boyut),
      sayfa,
      boyut,
      sonrakiVar: kayitlar.length > boyut,
    };
  }
}
