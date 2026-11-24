import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/database/unit-of-work.js';
import { KodluHata } from '../../../../shared/http/kodlu-hata.js';
import { ButunlukSorusu } from '../../_shared/butunluk-sorusu.js';
import { GenelSayac } from '../../_shared/genel-sayac.js';
import { GrupYazmaRepo } from '../domain/grup.repository.js';

// İşin adı; kapının notuna yazılır.
const IS_ADI = 'kimlik:grup-tasi';

// Grubu başka bir grubun altına taşı (TS-002 "İşlem sınırları"; AK-39; KR-008 Seçim 22 ve 27).
// Tek işlemde: genel sayaç satırı kilitlenir ve artırılır; denetimler kilit altında bütünlük
// sorusuyla sorulur (grup oluşturma, taşıma ve silme de aynı satırı kilitlediği için arada ağaç
// değişmez): silinmiş ya da var olmayan grup bulunamadi; kök grup, canlı olmayan hedef ve döngü
// cakisma. Üst grup yetki kapısından niyet eylemiyle (Grup:tasi) yazılır; grup zaten hedefin
// altındaysa kapı satıra yazmaz. Olay yazılmaz (AK-39).
@Injectable()
export class GrupTasiHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly repo: GrupYazmaRepo,
    private readonly genelSayac: GenelSayac,
    private readonly butunluk: ButunlukSorusu,
  ) {}

  calistir(id: string, ustGrupId: string): Promise<void> {
    return this.uow.run(async (islem) => {
      await this.genelSayac.kilitle(islem, { artir: true });
      if (!(await this.butunluk.grupCanliMi(islem, id))) {
        throw new KodluHata('bulunamadi', 'Kayıt bulunamadı');
      }
      if (await this.butunluk.grupKokMu(islem, id)) {
        throw new KodluHata('cakisma', 'Kök grup taşınamaz');
      }
      if (!(await this.butunluk.grupCanliMi(islem, ustGrupId))) {
        throw new KodluHata('cakisma', 'Üst grup yok ya da silinmiş');
      }
      if (await this.butunluk.tasimaDonguYaparMi(islem, id, ustGrupId)) {
        throw new KodluHata(
          'cakisma',
          'Grup kendisinin ya da altındakilerden birinin altına taşınamaz',
        );
      }
      await this.repo.tasi(islem, IS_ADI, id, ustGrupId);
    });
  }
}
