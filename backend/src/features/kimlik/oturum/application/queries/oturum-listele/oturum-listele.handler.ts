// Oturumları listele işinin işleyicisi (TS-002 "Uçlar ve izinler": Oturum:oku).
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { istekBaglami } from '../../../../../../shared/http/istek-baglami.js';
import { OTURUM_YONETIM_OKUMA_REPO } from '../../../domain/repositories/i-oturum-yonetim.repository.js';
import type { OturumListeleSorgusu } from './oturum-listele.query.js';
import type { OturumListeleSonucu } from './oturum-listele.result.js';

// Oturum listesi (TS-002 AK-39, AK-51). Sonraki sayfanın varlığı, sayfadan bir fazla kayıt istenerek
// anlaşılır; fazla kayıt cevaba girmez. buOturumId isteği yapan oturumdur.
@Injectable()
export class OturumListeleHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async calistir({
    sayfa,
    boyut,
    siralama,
    kullaniciId,
    acik,
  }: OturumListeleSorgusu): Promise<OturumListeleSonucu> {
    const { oturum } = istekBaglami();
    // İzin işaretli uçta guard'lar oturumu bağlama yazmadan isteği geçirmez.
    if (oturum === undefined) {
      throw new Error('İstek bağlamında oturum yok');
    }
    const kayitlar = await this.uow.read(OTURUM_YONETIM_OKUMA_REPO).liste({
      ...(kullaniciId === undefined ? {} : { kullaniciId }),
      ...(acik === undefined ? {} : { acik }),
      simdi: new Date(),
      siralama,
      atla: (sayfa - 1) * boyut,
      al: boyut + 1,
    });
    return {
      kayitlar: kayitlar.slice(0, boyut),
      sayfa,
      boyut,
      sonrakiVar: kayitlar.length > boyut,
      buOturumId: oturum.oturumId,
    };
  }
}
