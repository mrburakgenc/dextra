// Rol sil işinin işleyicisi (TS-002 "İşlem sınırları": rol sil; KR-008 Seçim 15 ve 22).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/domain/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import {
  type RolSilmeReddi,
  rolSilmeKarari,
} from '../../../domain/entities/rol.entity.js';
import {
  type IRolYazmaRepo,
  ROL_YAZMA_REPO,
} from '../../../domain/repositories/i-rol.repository.js';
import type { RolSilKomutu } from './rol-sil.command.js';

// İşin adı; değişiklik kaydı notunun işin adı alanına yazılır.
const IS_ADI = 'kimlik:rol-sil';

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_ILETISI: Record<RolSilmeReddi, string> = {
  sistem_rolu: 'Sistem rolü silinemez',
  dolu: 'Rolün canlı üyeliği ya da yeteneği var; silinemez',
};

// Tek run'dır ve önce genel sayaç satırını kilitleyip artırır. Olgular kapı rolü sildikten sonra
// sorulur: isteyenin silemediği (görmediği) rol böylece cakisma değil bulunamadi alır (TS-002 AK-39).
// Sistem rolü olgusu, kod okuma kapısından okunmadığı için bütünlük sorusuyla sorulur (AK-43). Ret
// yazmayı ve notu geri alır.
@Injectable()
export class RolSilHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    @Inject(ROL_YAZMA_REPO) private readonly yazma: IRolYazmaRepo,
  ) {}

  async calistir({ id }: RolSilKomutu): Promise<void> {
    await this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      await this.yazma.sil(islem, IS_ADI, id);
      const karar = rolSilmeKarari({
        sistemRoluMu: await this.butunluk.rolSistemRoluMu(islem, id),
        bosMu: await this.butunluk.rolBosMu(islem, id),
      });
      if (karar.tur === 'ret') {
        throw new KodluHata('cakisma', RET_ILETISI[karar.neden]);
      }
    });
  }
}
