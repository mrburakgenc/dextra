// Yetenekleri listele işinin işleyicisi (TS-002 AK-39; "Uçlar ve izinler": Yetenek:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { YETENEK_REPO } from '../../../domain/repositories/i-yetenek.repository.js';
import type { YetenekListeleSorgusu } from './yetenek-listele.query.js';
import type { YetenekListeleSonucu } from './yetenek-listele.result.js';

// Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class YetenekListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    sirala,
    grupId,
    rolId,
    izinId,
  }: YetenekListeleSorgusu): Promise<YetenekListeleSonucu> {
    const kayitlar = await this.uow.read(YETENEK_REPO).liste({
      ...(sirala === undefined ? {} : { siralama: sirala }),
      ...(grupId === undefined ? {} : { grupId }),
      ...(rolId === undefined ? {} : { rolId }),
      ...(izinId === undefined ? {} : { izinId }),
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
