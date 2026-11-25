// Grubu sil işinin işleyicisi (TS-002 "İşlem sınırları"; AK-39; KR-008 Seçim 22 ve 27).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import {
  type GrupSilmeReddi,
  grupSilmeKarari,
} from '../../../domain/entities/grup.entity.js';
import {
  GRUP_YAZMA_REPO,
  type IGrupYazmaRepo,
} from '../../../domain/repositories/i-grup.repository.js';
import type { GrupSilKomutu } from './grup-sil.command.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-sil';

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_ILETISI: Record<GrupSilmeReddi, string> = {
  kok: 'Kök grup silinemez',
  dolu: 'Dolu grup silinemez',
};

// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır; kök grup ve dolu grup (canlı alt grubu,
// üyeliği ya da yeteneği olan) kilit altında bütünlük sorusuyla sorulup varlığın kararıyla reddedilir
// (cakisma); grup oluşturma, taşıma, üyelik verme ve yetenek yazma da aynı satırı kilitlediği için
// arada grup dolmaz. Satır yetki kapısından (Grup:sil yeteneğiyle) yumuşak silinir. Olay yazılmaz (AK-39).
@Injectable()
export class GrupSilHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    @Inject(GRUP_YAZMA_REPO) private readonly yazma: IGrupYazmaRepo,
  ) {}

  calistir({ id }: GrupSilKomutu): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const karar = grupSilmeKarari({
        kokMu: await this.butunluk.grupKokMu(islem, id),
        bosMu: await this.butunluk.grupBosMu(islem, id),
      });
      if (karar.tur === 'ret') {
        throw new KodluHata('cakisma', RET_ILETISI[karar.neden]);
      }
      await this.yazma.sil(islem, IS_ADI, id);
    });
  }
}
