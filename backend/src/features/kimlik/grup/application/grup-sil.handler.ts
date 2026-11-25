import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import { GrupYazmaRepo } from '../domain/grup.repository.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-sil';

// Grubu sil (TS-002 "İşlem sınırları"; AK-39; KR-008 Seçim 22 ve 27). Tek işlemde: genel sayaç
// satırı kilitlenir ve artırılır; kök grup ve dolu grup (canlı alt grubu, üyeliği ya da yeteneği
// olan) kilit altında bütünlük sorusuyla reddedilir (cakisma); grup oluşturma, taşıma, üyelik verme
// ve yetenek yazma da aynı satırı kilitlediği için arada grup dolmaz. Satır yetki kapısından
// (Grup:sil yeteneğiyle) yumuşak silinir. Olay yazılmaz (AK-39).
@Injectable()
export class GrupSilHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: GrupYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
  ) {}

  calistir(id: string): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      if (await this.butunluk.grupKokMu(islem, id)) {
        throw new KodluHata('cakisma', 'Kök grup silinemez');
      }
      if (!(await this.butunluk.grupBosMu(islem, id))) {
        throw new KodluHata('cakisma', 'Dolu grup silinemez');
      }
      await this.repo.sil(islem, IS_ADI, id);
    });
  }
}
