import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import {
  YETENEK_REPO,
  YetenekYazmaRepo,
} from '../domain/yetenek.repository.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:yetenek-sil';

// Yetenek sil (TS-002 "İşlem sınırları", AK-39; değişmez 6 ve 8). Tek işlemde: genel sayaç satırı
// kilitlenir ve artırılır; kayıt yetki kapısından okunur (görülemeyen ya da var olmayan kayıt
// bulunamadi); sistem satırı silinmez, sistem satırı işaretini göremeyen kişi de silemez (kapalı
// düşer); satır yetki kapısından (Yetenek:sil yeteneğiyle) yumuşak silinir. Sistem satırı işareti
// yazıldıktan sonra değişmediği ve yetenek silen işler aynı sayaç satırını kilitlediği için okuma ile
// silme arasında karar bayatlamaz. Olay yazılmaz (AK-39).
@Injectable()
export class YetenekSilHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: YetenekYazmaRepo,
    private readonly genelSayac: GenelSayac,
  ) {}

  calistir(id: string): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const kayit = await islem.repo(YETENEK_REPO).tek(id);
      if (kayit['sistemSatiri'] !== false) {
        throw new KodluHata('cakisma', 'Sistem satırı silinemez');
      }
      await this.repo.sil(islem, IS_ADI, id);
    });
  }
}
