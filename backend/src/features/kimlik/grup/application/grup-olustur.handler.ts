import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import { GrupYazmaRepo, type YeniGrup } from '../domain/grup.repository.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-olustur';

// Grup oluştur (TS-002 "İşlem sınırları"; AK-39). Tek işlemde: genel sayaç satırı kilitlenir ve
// artırılır; üst grubun canlı olduğu kilit altında bütünlük sorusuyla sorulur (grup silme de aynı
// satırı kilitlediği için arada üst grup silinemez); satır yetki kapısından (Grup:olustur
// yeteneğiyle) yazılır. Üst grup zorunludur: bu uçla ikinci bir kök açılamaz. Olay yazılmaz (AK-39).
@Injectable()
export class GrupOlusturHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: GrupYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
  ) {}

  calistir(grup: YeniGrup): Promise<string> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      if (!(await this.butunluk.grupCanliMi(islem, grup.ustGrupId))) {
        throw new KodluHata('cakisma', 'Üst grup yok ya da silinmiş');
      }
      return this.repo.olustur(islem, IS_ADI, grup);
    });
  }
}
