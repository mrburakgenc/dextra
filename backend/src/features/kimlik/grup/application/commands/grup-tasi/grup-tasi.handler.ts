// Grubu başka bir grubun altına taşı işinin işleyicisi (TS-002 "İşlem sınırları"; AK-39; KR-008
// Seçim 22 ve 27).
import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../../../shared/database/unit-of-work.js';
import {
  type HataKodu,
  KodluHata,
} from '../../../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../../../_shared/genel-sayac.js';
import {
  type GrupTasimaReddi,
  grupTasimaKarari,
} from '../../../domain/entities/grup.entity.js';
import {
  GRUP_YAZMA_REPO,
  type IGrupYazmaRepo,
} from '../../../domain/repositories/i-grup.repository.js';
import type { GrupTasiKomutu } from './grup-tasi.command.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-tasi';

// Varlığın reddi bugünkü HTTP cevabına çevrilir: silinmiş ya da var olmayan grup bulunamadi; kök
// grup, canlı olmayan hedef ve döngü cakisma.
const RET_HATASI: Record<
  GrupTasimaReddi,
  { readonly kod: HataKodu; readonly ileti: string }
> = {
  silinmis: { kod: 'bulunamadi', ileti: 'Kayıt bulunamadı' },
  kok: { kod: 'cakisma', ileti: 'Kök grup taşınamaz' },
  ust_grup_yok: { kod: 'cakisma', ileti: 'Üst grup yok ya da silinmiş' },
  dongu: {
    kod: 'cakisma',
    ileti: 'Grup kendisinin ya da altındakilerden birinin altına taşınamaz',
  },
};

// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır; olgular kilit altında bütünlük sorusuyla
// sorulur (grup oluşturma, taşıma ve silme de aynı satırı kilitlediği için arada ağaç değişmez), karar
// ve denetimlerin sırası varlıktandır. Üst grup yetki kapısından niyet eylemiyle (Grup:tasi) yazılır;
// grup zaten hedefin altındaysa kapı satıra yazmaz. Olay yazılmaz (AK-39).
@Injectable()
export class GrupTasiHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
    @Inject(GRUP_YAZMA_REPO) private readonly yazma: IGrupYazmaRepo,
  ) {}

  calistir({ id, ustGrupId }: GrupTasiKomutu): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      const karar = grupTasimaKarari({
        canliMi: await this.butunluk.grupCanliMi(islem, id),
        kokMu: await this.butunluk.grupKokMu(islem, id),
        hedefCanliMi: await this.butunluk.grupCanliMi(islem, ustGrupId),
        donguYaparMi: await this.butunluk.tasimaDonguYaparMi(
          islem,
          id,
          ustGrupId,
        ),
      });
      if (karar.tur === 'ret') {
        const { kod, ileti } = RET_HATASI[karar.neden];
        throw new KodluHata(kod, ileti);
      }
      await this.yazma.tasi(islem, IS_ADI, id, ustGrupId);
    });
  }
}
