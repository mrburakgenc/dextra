// Rol adını değiştir işinin işleyicisi (TS-002 "İşlem sınırları": rol yaz, "Durum geçişleri"; AK-43).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/infrastructure/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/domain/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/application/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/application/genel-sayac.js';
import { rolAdDegistirmeKarari } from '../../../domain/entities/rol.entity.js';
import {
  type IRolYazmaRepo,
  ROL_YAZMA_REPO,
} from '../../../domain/repositories/i-rol.repository.js';
import type { RolAdiniDegistirKomutu } from './rol-adini-degistir.command.js';

// İşin adı; değişiklik kaydı notunun işin adı alanına yazılır.
const IS_ADI = 'kimlik:rol-adini-degistir';

// Tek run'dır ve önce genel sayaç satırını kilitleyip artırır. Yazma kapısının güncellemesi silinme
// zamanını süzmediği için canlılık bütünlük sorusuyla, sayaç kilidinin altında sorulur; karar
// varlıktandır, silinmiş rol bulunamadi alır. Hata bütün işi geri alır.
@Injectable()
export class RolAdiniDegistirHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    @Inject(ROL_YAZMA_REPO) private readonly yazma: IRolYazmaRepo,
  ) {}

  async calistir({ id, ad }: RolAdiniDegistirKomutu): Promise<void> {
    await this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const karar = rolAdDegistirmeKarari({
        canliMi: await this.butunluk.rolCanliMi(islem, id),
      });
      if (karar.tur === 'ret') {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      await this.yazma.adDegistir(islem, IS_ADI, id, ad);
    });
  }
}
