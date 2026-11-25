// Üyelikleri listele işinin işleyicisi (TS-002 AK-39; "Uçlar ve izinler": Uyelik:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { UYELIK_OKUMA_REPO } from '../../../domain/repositories/i-uyelik.repository.js';
import type { UyelikListeleSorgusu } from './uyelik-listele.query.js';
import type { UyelikListeleSonucu } from './uyelik-listele.result.js';

// Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek anlaşılır; fazla kayıt cevaba girmez.
@Injectable()
export class UyelikListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    sirala,
    kullaniciId,
    grupId,
    rolId,
  }: UyelikListeleSorgusu): Promise<UyelikListeleSonucu> {
    const kayitlar = await this.uow.read(UYELIK_OKUMA_REPO).liste({
      ...(sirala === undefined ? {} : { siralama: sirala }),
      ...(kullaniciId === undefined ? {} : { kullaniciId }),
      ...(grupId === undefined ? {} : { grupId }),
      ...(rolId === undefined ? {} : { rolId }),
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
