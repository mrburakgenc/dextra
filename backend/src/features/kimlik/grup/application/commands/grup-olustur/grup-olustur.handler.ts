// Grup oluştur işinin işleyicisi (TS-002 "İşlem sınırları"; AK-39).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/genel-sayac.js';
import {
  type GrupOlusturmaReddi,
  grupOlustur,
} from '../../../domain/entities/grup.entity.js';
import {
  GRUP_YAZMA_REPO,
  type IGrupYazmaRepo,
} from '../../../domain/repositories/i-grup.repository.js';
import type { GrupOlusturKomutu } from './grup-olustur.command.js';
import type { GrupOlusturSonucu } from './grup-olustur.result.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-olustur';

// Varlığın reddi bugünkü HTTP cevabına çevrilir.
const RET_ILETISI: Record<GrupOlusturmaReddi, string> = {
  ust_grup_yok: 'Üst grup yok ya da silinmiş',
};

// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır; üst grubun canlı olduğu kilit altında
// bütünlük sorusuyla sorulur (grup silme de aynı satırı kilitlediği için arada üst grup silinemez),
// karar varlıktandır (ret cakisma); satır yetki kapısından (Grup:olustur yeteneğiyle) yazılır. Olay
// yazılmaz (AK-39).
@Injectable()
export class GrupOlusturHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    @Inject(GRUP_YAZMA_REPO) private readonly yazma: IGrupYazmaRepo,
  ) {}

  calistir({ ad, ustGrupId }: GrupOlusturKomutu): Promise<GrupOlusturSonucu> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const grup = grupOlustur(ad, ustGrupId, {
        ustGrupCanliMi: await this.butunluk.grupCanliMi(islem, ustGrupId),
      });
      if (grup.tur === 'ret') {
        throw new KodluHata('cakisma', RET_ILETISI[grup.neden]);
      }
      return { id: await this.yazma.olustur(islem, IS_ADI, grup.deger) };
    });
  }
}
