import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { UYELIK_REPO } from '../domain/uyelik.repository.js';
import type {
  UyelikListeleSorgusu,
  UyelikListesi,
} from './uyelik-listele.query.js';

// Üyelik listesi (TS-002 AK-39). Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek
// anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class UyelikListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    ...suzgec
  }: UyelikListeleSorgusu): Promise<UyelikListesi> {
    const kayitlar = await this.uow.read(UYELIK_REPO).liste({
      ...suzgec,
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
