import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { YETENEK_REPO } from '../domain/yetenek.repository.js';
import type {
  YetenekListeleSorgusu,
  YetenekListesi,
} from './yetenek-listele.query.js';

// Yetenek listesi (TS-002 AK-39). Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek
// anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class YetenekListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    ...suzgecler
  }: YetenekListeleSorgusu): Promise<YetenekListesi> {
    const kayitlar = await this.uow.read(YETENEK_REPO).liste({
      ...suzgecler,
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
