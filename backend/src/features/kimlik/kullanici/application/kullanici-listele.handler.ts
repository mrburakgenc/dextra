import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KULLANICI_REPO } from '../domain/kullanici.repository.js';
import type {
  KullaniciListeleSorgusu,
  KullaniciListesi,
} from './kullanici-listele.query.js';

// Kullanıcı listesi (TS-002 AK-39). Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek
// anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class KullaniciListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    siralama,
    pasif,
  }: KullaniciListeleSorgusu): Promise<KullaniciListesi> {
    const kayitlar = await this.uow.read(KULLANICI_REPO).liste({
      ...(pasif === undefined ? {} : { pasif }),
      ...(siralama === undefined ? {} : { siralama }),
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
