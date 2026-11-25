// Yetenek sil işinin işleyicisi (TS-002 "İşlem sınırları", AK-39; değişmez 6 ve 8).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/kodlu-hata.js';
import { GenelSayac } from '../../../../_shared/genel-sayac.js';
import {
  type YetenekSilmeReddi,
  yetenekSilmeKarari,
} from '../../../domain/entities/yetenek.entity.js';
import {
  type IYetenekYazmaRepo,
  YETENEK_REPO,
  YETENEK_YAZMA_REPO,
} from '../../../domain/repositories/i-yetenek.repository.js';
import type { YetenekSilKomutu } from './yetenek-sil.command.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:yetenek-sil';

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_ILETISI: Record<YetenekSilmeReddi, string> = {
  sistem_satiri: 'Sistem satırı silinemez',
};

// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır; kayıt yetki kapısından okunur (görülemeyen
// ya da var olmayan kayıt bulunamadi); karar varlıktandır (sistem satırı ve işareti göremeyen kişi
// cakisma alır); satır yetki kapısından (Yetenek:sil yeteneğiyle) yumuşak silinir. Sistem satırı
// işareti yazıldıktan sonra değişmediği ve yetenek silen işler aynı sayaç satırını kilitlediği için
// okuma ile silme arasında karar bayatlamaz. Olay yazılmaz (AK-39).
@Injectable()
export class YetenekSilHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    @Inject(YETENEK_YAZMA_REPO) private readonly yazma: IYetenekYazmaRepo,
  ) {}

  calistir({ id }: YetenekSilKomutu): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const { sistemSatiri } = await islem.repo(YETENEK_REPO).tek(id);
      const karar = yetenekSilmeKarari({
        sistemSatiri:
          typeof sistemSatiri === 'boolean' ? sistemSatiri : undefined,
      });
      if (karar.tur === 'ret') {
        throw new KodluHata('cakisma', RET_ILETISI[karar.neden]);
      }
      await this.yazma.sil(islem, IS_ADI, id);
    });
  }
}
